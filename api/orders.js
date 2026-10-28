import { randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const products = {
  '9-ct': { name: '9 ct bouquet', price: 4500 },
  '15-ct': { name: '15 ct bouquet', price: 6500 },
  '24-ct': { name: '24 ct bouquet', price: 8500 },
  '36-ct': { name: '36 ct bouquet', price: 10000 },
  '50-ct': { name: '50 ct bouquet', price: 15000 },
  'money-bouquet': { name: 'Money bouquet', price: null },
  'special-request': { name: 'Special request bouquet', price: null },
};

const toppers = new Set([
  'Glitter ($300)',
  'Butterfly ($100 ea)',
  'Bow ($100 ea)',
  'Banner ($100 ea)',
  'Crown ($500)',
  'Tiara ($1,000)',
  "Baby's breath ($800)",
  'Pearl Bows ($300 per)',
  'Mesh wrapping ($800)',
  'Pins ($200)',
  'Other (quote)',
]);
const topperPrices = new Map([
  ['Glitter ($300)', 300],
  ['Butterfly ($100 ea)', 100],
  ['Bow ($100 ea)', 100],
  ['Banner ($100 ea)', 100],
  ['Crown ($500)', 500],
  ['Tiara ($1,000)', 1000],
  ["Baby's breath ($800)", 800],
  ['Pearl Bows ($300 per)', 300],
  ['Mesh wrapping ($800)', 800],
  ['Pins ($200)', 200],
]);
const denominations = new Set(['$5,000', '$2,000', '$1,000', '$500', '$100', '$50']);
const occasions = new Set(['', 'Birthday', 'Anniversary', 'Graduation', 'New baby', 'Just because', 'Sympathy', 'Other']);
const wraps = new Set(['Black', 'White', 'Pink', 'Mesh texture']);
const deliveries = new Set([
  "Ocho Rios, face-to-face (free)",
  "St. Ann's Bay, face-to-face ($500)",
  'Knutsford Express shipping (free to courier)',
  'Pickup',
]);
const requiredEnvironment = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ORDER_RATE_LIMIT_SECRET',
  'RESEND_API_KEY',
  'ORDER_NOTIFICATION_EMAIL',
  'ORDER_FROM_EMAIL',
];
const maxPhotoBytes = 2 * 1024 * 1024;

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function isReady() {
  return requiredEnvironment.every((name) => Boolean(process.env[name]?.trim()));
}

function text(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function validate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Invalid order data.';
  const { customer, cart } = payload;
  if (!customer || typeof customer !== 'object') return 'Customer details are required.';
  if (!text(customer.name, 100)) return 'Enter a name (up to 100 characters).';
  if (!text(customer.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return 'Enter a valid email address.';
  if (!text(customer.phone, 40)) return 'Enter a phone number (up to 40 characters).';
  if (!Array.isArray(cart) || cart.length < 1 || cart.length > Object.keys(products).length) return 'Add at least one bouquet.';

  const seenProducts = new Set();
  for (const item of cart) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !products[item.id] ||
      seenProducts.has(item.id) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      return 'The cart contains an invalid bouquet or quantity.';
    }
    seenProducts.add(item.id);
  }

  if (!text(payload.dateNeeded, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dateNeeded)) return 'Choose a valid date needed.';
  if (!occasions.has(payload.occasion) || !wraps.has(payload.wrapColor) || !deliveries.has(payload.delivery)) {
    return 'Choose valid occasion, wrapping, and delivery options.';
  }
  if (
    !Array.isArray(payload.toppers) ||
    payload.toppers.length > toppers.size * 20 ||
    payload.toppers.some((item) => !toppers.has(item))
  ) {
    return 'The topper selection is invalid.';
  }
  const topperCounts = new Map();
  for (const item of payload.toppers) {
    const count = (topperCounts.get(item) || 0) + 1;
    if (count > (topperPrices.has(item) ? 20 : 1)) return 'Choose no more than 20 of each priced topper.';
    topperCounts.set(item, count);
  }
  if (typeof payload.deliveryDetails !== 'string' || payload.deliveryDetails.length > 1000) return 'Delivery details are too long.';
  if (
    ['Knutsford Express shipping (free to courier)', 'Pickup'].includes(payload.delivery) &&
    !text(payload.deliveryDetails, 1000)
  ) {
    return 'Add delivery or pickup details.';
  }
  if (typeof payload.specialInstructions !== 'string' || payload.specialInstructions.length > 2000) return 'Special instructions are too long.';

  const hasMoneyBouquet = cart.some((item) => item.id === 'money-bouquet');
  if (
    !Array.isArray(payload.cashDenominations) ||
    payload.cashDenominations.length > denominations.size ||
    payload.cashDenominations.some((item) => !denominations.has(item))
  ) {
    return 'The money bouquet note selection is invalid.';
  }
  if (hasMoneyBouquet && (!text(payload.cashAmount, 30) || payload.cashDenominations.length === 0)) {
    return 'Choose note denominations and enter the money bouquet cash amount.';
  }
  if (typeof payload.cashAmount !== 'string' || payload.cashAmount.length > 30) return 'The cash amount is invalid.';
  if (payload.inspiration !== null && payload.inspiration !== undefined) {
    if (
      !payload.inspiration ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(payload.inspiration.type) ||
      typeof payload.inspiration.data !== 'string' ||
      payload.inspiration.data.length > Math.ceil(maxPhotoBytes * 4 / 3) + 8 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(payload.inspiration.data)
    ) {
      return 'The inspiration photo must be a JPEG, PNG, WebP, or GIF no larger than 2 MB.';
    }
  }
  return null;
}

function photoDetails(inspiration) {
  if (!inspiration) return null;
  const buffer = Buffer.from(inspiration.data, 'base64');
  if (buffer.length === 0 || buffer.length > maxPhotoBytes) throw new Error('The inspiration photo must be no larger than 2 MB.');
  const signatures = {
    'image/jpeg': buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/webp': buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
    'image/gif': buffer.toString('ascii', 0, 3) === 'GIF',
  };
  if (!signatures[inspiration.type]) throw new Error('The inspiration photo file could not be verified as an image.');
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return { buffer, contentType: inspiration.type, extension: extensions[inspiration.type] };
}

function orderEmail(payload, orderId, imageUrl) {
  const bouquets = payload.cart.map(({ id, quantity }) => ({
    name: products[id].name,
    quantity,
    unitPrice: products[id].price,
  }));
  const subtotal = payload.cart.reduce((sum, item) => sum + (products[item.id].price || 0) * item.quantity, 0);
  const topperSubtotal = payload.toppers.reduce((sum, item) => sum + (topperPrices.get(item) || 0), 0);
  const topperCounts = new Map();
  payload.toppers.forEach((item) => topperCounts.set(item, (topperCounts.get(item) || 0) + 1));
  const topperLines = [...topperCounts].map(([item, quantity]) => `- ${quantity} x ${item}`);
  const lines = [
    `Order reference: ${orderId}`,
    `Customer: ${payload.customer.name}`,
    `Email: ${payload.customer.email}`,
    `Phone / WhatsApp: ${payload.customer.phone}`,
    `Date needed: ${payload.dateNeeded}`,
    `Occasion: ${payload.occasion || 'Not specified'}`,
    `Wrap: ${payload.wrapColor}`,
    `Delivery: ${payload.delivery}`,
    `Delivery / pickup details: ${payload.deliveryDetails || 'Not provided'}`,
    '',
    'Bouquets:',
    ...bouquets.map((item) => `- ${item.quantity} x ${item.name}${item.unitPrice === null ? ' (quote)' : ` (JMD ${item.unitPrice.toLocaleString()} each)`}`),
    `Priced bouquet subtotal: JMD ${subtotal.toLocaleString()}`,
    'Toppers and extras:',
    ...(topperLines.length ? topperLines : ['- None']),
    `Priced topper estimate: JMD ${topperSubtotal.toLocaleString()}`,
    `Estimated subtotal: JMD ${(subtotal + topperSubtotal).toLocaleString()} (delivery and quoted items may change the confirmed invoice total)`,
    `Money bouquet cash amount: ${payload.cashAmount || 'N/A'}`,
    `Money bouquet denominations: ${payload.cashDenominations.join(', ') || 'N/A'}`,
    `Special instructions: ${payload.specialInstructions || 'None'}`,
    `Inspiration photo: ${imageUrl || 'None'}`,
  ];
  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, { ready: isReady() });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  if (!isReady()) return json(res, 503, { error: 'Online ordering is not configured yet. Please contact us on WhatsApp.' });

  const payload = req.body;
  const validationError = validate(payload);
  if (validationError) return json(res, 400, { error: validationError });

  const orderId = randomUUID();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cart = payload.cart.map(({ id, quantity }) => ({
    id,
    name: products[id].name,
    quantity,
    unitPrice: products[id].price,
  }));
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0);
  const topperSubtotal = payload.toppers.reduce((sum, item) => sum + (topperPrices.get(item) || 0), 0);
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = typeof forwardedFor === 'string' ? forwardedFor.split(',').at(-1)?.trim() : '';
  if (!clientIp) return json(res, 400, { error: 'We could not verify this request. Please try again.' });
  const ipHash = createHmac('sha256', process.env.ORDER_RATE_LIMIT_SECRET).update(clientIp).digest('hex');
  let inspirationPath = null;
  let inspirationUrl = null;

  try {
    const { data: allowed, error: limitError } = await supabase.rpc('claim_order_submission', { p_ip_hash: ipHash });
    if (limitError) {
      console.error('Unable to check order submission rate limit.', limitError.message);
      return json(res, 503, { error: 'Online ordering is temporarily unavailable. Please contact us on WhatsApp.' });
    }
    if (allowed !== true) return json(res, 429, { error: 'Please wait a few minutes before sending another order.' });

    if (payload.inspiration) {
      const photo = photoDetails(payload.inspiration);
      inspirationPath = `${orderId}.${photo.extension}`;
      const { error } = await supabase.storage
        .from('order-inspiration')
        .upload(inspirationPath, photo.buffer, { contentType: photo.contentType, upsert: false });
      if (error) throw new Error('The inspiration photo could not be saved.');
      const { data, error: urlError } = await supabase.storage
        .from('order-inspiration')
        .createSignedUrl(inspirationPath, 60 * 60 * 24 * 7);
      if (urlError) throw new Error('The inspiration photo could not be linked to the order.');
      inspirationUrl = data.signedUrl;
    }

    const row = {
      id: orderId,
      customer_name: payload.customer.name.trim(),
      customer_email: payload.customer.email.trim().toLowerCase(),
      customer_phone: payload.customer.phone.trim(),
      date_needed: payload.dateNeeded,
      occasion: payload.occasion || null,
      wrap_color: payload.wrapColor,
      delivery: payload.delivery,
      delivery_details: payload.deliveryDetails.trim() || null,
      bouquet_items: cart,
      bouquet_subtotal_jmd: subtotal,
      toppers: payload.toppers,
      topper_subtotal_jmd: topperSubtotal,
      estimated_total_jmd: subtotal + topperSubtotal,
      cash_amount: payload.cashAmount.trim() || null,
      cash_denominations: payload.cashDenominations,
      special_instructions: payload.specialInstructions.trim() || null,
      inspiration_path: inspirationPath,
      notification_status: 'pending',
    };
    const { error: insertError } = await supabase.from('orders').insert(row);
    if (insertError) {
      console.error('Unable to save an order to Supabase.', insertError.message);
      if (inspirationPath) await supabase.storage.from('order-inspiration').remove([inspirationPath]);
      return json(res, 500, { error: 'We could not save your order. Please try again or contact us on WhatsApp.' });
    }

    let emailSent = false;
    let notificationError;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.ORDER_FROM_EMAIL,
        to: [process.env.ORDER_NOTIFICATION_EMAIL],
        replyTo: payload.customer.email.trim(),
        subject: `New Forever Florals order (${orderId.slice(0, 8)})`,
        text: orderEmail(payload, orderId, inspirationUrl),
      });
      if (error) throw new Error(error.message);
      emailSent = true;
    } catch (error) {
      notificationError = error instanceof Error ? error.message : 'Unknown email delivery error.';
      console.error('Order was saved, but its email notification failed.', notificationError);
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ notification_status: emailSent ? 'sent' : 'failed' })
      .eq('id', orderId);
    if (updateError) console.error('Unable to update the order notification status.', updateError.message);

    return json(res, 201, {
      ok: true,
      orderId,
      emailSent,
      ...(notificationError ? { error: 'Order saved, but the shop notification could not be sent.' } : {}),
    });
  } catch (error) {
    console.error('Order processing failed.', error instanceof Error ? error.message : 'Unknown order processing error.');
    if (inspirationPath) await supabase.storage.from('order-inspiration').remove([inspirationPath]);
    return json(res, 500, { error: error instanceof Error ? error.message : 'We could not process your order. Please try again.' });
  }
}
