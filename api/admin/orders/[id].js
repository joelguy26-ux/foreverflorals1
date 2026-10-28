import { Resend } from 'resend';
import { authorizeAdmin, json } from '../../../lib/admin.js';

const paymentEnvironment = [
  'PAYMENT_BANK_NAME',
  'PAYMENT_ACCOUNT_NAME',
  'PAYMENT_ACCOUNT_NUMBER',
];

function formatJmd(amount) {
  return `JMD ${amount.toLocaleString('en-JM')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function groupToppers(toppers) {
  const counts = new Map();
  toppers.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts].map(([item, quantity]) => ({ item, quantity }));
}

function invoiceEmail(order) {
  const bankName = process.env.PAYMENT_BANK_NAME.trim();
  const accountName = process.env.PAYMENT_ACCOUNT_NAME.trim();
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER.trim();
  const branch = process.env.PAYMENT_BANK_BRANCH?.trim();
  const instructions = process.env.PAYMENT_INSTRUCTIONS?.trim();
  const reference = order.id.slice(0, 8).toUpperCase();
  const bouquets = Array.isArray(order.bouquet_items) ? order.bouquet_items : [];
  const bouquetLines = bouquets.map((item) => {
    const amount = item.unitPrice === null ? 'Price confirmed in total' : `${formatJmd(item.unitPrice)} each`;
    return `<li>${item.quantity} × ${escapeHtml(item.name)} — ${amount}</li>`;
  });
  const groupedToppers = groupToppers(order.toppers);
  const topperLines = groupedToppers.map(({ item, quantity }) => `<li>${quantity} × ${escapeHtml(item)}</li>`);
  const textLines = [
    `Forever Florals invoice — ${reference}`,
    `Order reference: ${order.id}`,
    `Hello ${order.customer_name},`,
    '',
    'Your order has been confirmed. Please use the bank transfer details below.',
    '',
    'Order:',
    ...bouquets.map((item) => `- ${item.quantity} x ${item.name}: ${item.unitPrice === null ? 'included in confirmed total' : `${formatJmd(item.unitPrice)} each`}`),
    ...groupedToppers.map(({ item, quantity }) => `- ${quantity} x Topper: ${item}`),
    `Delivery: ${order.delivery}`,
    '',
    `Amount due: ${formatJmd(order.confirmed_total_jmd)}`,
    '',
    `Bank: ${bankName}`,
    `Account name: ${accountName}`,
    `Account number: ${accountNumber}`,
    ...(branch ? [`Branch: ${branch}`] : []),
    `Payment reference: ${reference}`,
    ...(instructions ? ['', instructions] : []),
    '',
    'Please reply to this email with your payment confirmation. Thank you for choosing Forever Florals.',
  ];
  const html = `
    <div style="max-width:620px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;color:#2c0f1e">
      <h1 style="color:#5c0e33">Forever Florals invoice</h1>
      <p>Invoice <strong>${reference}</strong> · Order ${escapeHtml(order.id)}</p>
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Your order has been confirmed. Please use the bank transfer details below.</p>
      <h2>Order details</h2>
      <ul>${[...bouquetLines, ...topperLines].join('') || '<li>Custom bouquet order</li>'}</ul>
      <p>Delivery: ${escapeHtml(order.delivery)}</p>
      <p style="padding:16px;background:#fff3f6;font-size:1.2rem"><strong>Amount due: ${formatJmd(order.confirmed_total_jmd)}</strong></p>
      <h2>Bank transfer details</h2>
      <p><strong>Bank:</strong> ${escapeHtml(bankName)}<br>
        <strong>Account name:</strong> ${escapeHtml(accountName)}<br>
        <strong>Account number:</strong> ${escapeHtml(accountNumber)}${branch ? `<br><strong>Branch:</strong> ${escapeHtml(branch)}` : ''}<br>
        <strong>Payment reference:</strong> ${reference}</p>
      ${instructions ? `<p>${escapeHtml(instructions).replace(/\n/g, '<br>')}</p>` : ''}
      <p>Please reply to this email with your payment confirmation. Thank you for choosing Forever Florals.</p>
    </div>`;
  return { text: textLines.join('\n'), html };
}

async function sendInvoice(order) {
  const missingPaymentFields = paymentEnvironment.filter((name) => !process.env[name]?.trim());
  if (missingPaymentFields.length) {
    return { error: `Configure payment details before sending invoices: ${missingPaymentFields.join(', ')}.` };
  }
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.ORDER_FROM_EMAIL?.trim()) {
    return { error: 'Email delivery is not configured. Set RESEND_API_KEY and ORDER_FROM_EMAIL.' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const reference = order.id.slice(0, 8).toUpperCase();
    const { error } = await resend.emails.send({
      from: process.env.ORDER_FROM_EMAIL,
      to: [order.customer_email],
      replyTo: process.env.ORDER_NOTIFICATION_EMAIL,
      subject: `Forever Florals invoice ${reference}`,
      ...invoiceEmail(order),
    });
    return error ? { error: error.message } : {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown invoice email error.' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const authorization = await authorizeAdmin(req);
  if (authorization.error) return json(res, authorization.status, { error: authorization.error });

  const orderId = req.query?.id;
  if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return json(res, 400, { error: 'A valid order ID is required.' });
  }

  try {
    const { data: order, error: fetchError } = await authorization.supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) return json(res, 404, { error: 'Order not found.' });

    const action = req.body?.action;
    if (action === 'confirm' || action === 'resend_invoice') {
      const total = action === 'confirm' ? req.body?.confirmedTotalJmd : order.confirmed_total_jmd;
      if (!Number.isSafeInteger(total) || total <= 0) {
        return json(res, 400, { error: 'Enter a confirmed total in whole JMD dollars greater than zero.' });
      }
      if (action === 'confirm' && order.order_status !== 'inquiry') {
        return json(res, 409, { error: 'Only new inquiries can be confirmed. Refresh the dashboard and try again.' });
      }
      if (action === 'resend_invoice' && order.order_status !== 'confirmed') {
        return json(res, 409, { error: 'Only confirmed orders can receive an invoice.' });
      }

      let confirmedOrder = order;
      if (action === 'confirm') {
        const { data, error } = await authorization.supabase
          .from('orders')
          .update({
            order_status: 'confirmed',
            confirmed_total_jmd: total,
            confirmed_at: new Date().toISOString(),
            invoice_sent_at: null,
          })
          .eq('id', orderId)
          .eq('order_status', 'inquiry')
          .select('*')
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(res, 409, { error: 'This inquiry has already changed. Refresh the dashboard.' });
        confirmedOrder = data;
      }

      const invoiceResult = await sendInvoice(confirmedOrder);
      if (invoiceResult.error) {
        console.error('Order confirmed but invoice delivery failed.', invoiceResult.error);
        return json(res, 502, {
          error: 'The order is confirmed, but the invoice email was not sent.',
          details: invoiceResult.error,
          orderStatus: 'confirmed',
        });
      }

      const sentAt = new Date().toISOString();
      const { error: updateError } = await authorization.supabase
        .from('orders')
        .update({ invoice_sent_at: sentAt })
        .eq('id', orderId);
      if (updateError) throw updateError;
      return json(res, 200, { ok: true, orderStatus: 'confirmed', invoiceSentAt: sentAt });
    }

    if (action === 'mark_paid') {
      if (order.order_status !== 'confirmed' || !order.invoice_sent_at) {
        return json(res, 409, { error: 'Send the invoice before marking this order as paid.' });
      }
      const { data, error } = await authorization.supabase
        .from('orders')
        .update({ order_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('order_status', 'confirmed')
        .select('id, order_status, paid_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(res, 409, { error: 'This order has already changed. Refresh the dashboard.' });
      return json(res, 200, { ok: true, ...data });
    }

    if (action === 'cancel') {
      if (!['inquiry', 'confirmed'].includes(order.order_status)) {
        return json(res, 409, { error: 'Only unpaid inquiries or confirmed orders can be cancelled.' });
      }
      const { data, error } = await authorization.supabase
        .from('orders')
        .update({ order_status: 'cancelled' })
        .eq('id', orderId)
        .in('order_status', ['inquiry', 'confirmed'])
        .select('id, order_status')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(res, 409, { error: 'This order has already changed. Refresh the dashboard.' });
      return json(res, 200, { ok: true, ...data });
    }

    return json(res, 400, { error: 'Choose a supported order action.' });
  } catch (error) {
    console.error('Unable to update admin order.', error instanceof Error ? error.message : 'Unknown error.');
    return json(res, 500, { error: 'The order could not be updated. Please try again.' });
  }
}
