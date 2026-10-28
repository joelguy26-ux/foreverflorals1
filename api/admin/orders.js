import { authorizeAdmin, json } from '../../lib/admin.js';

const pageSize = 500;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const authorization = await authorizeAdmin(req);
  if (authorization.error) return json(res, authorization.status, { error: authorization.error });

  try {
    const orders = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await authorization.supabase
        .from('orders')
        .select('id, created_at, customer_name, customer_email, customer_phone, date_needed, occasion, wrap_color, delivery, delivery_details, bouquet_items, bouquet_subtotal_jmd, toppers, topper_subtotal_jmd, cash_amount, cash_denominations, special_instructions, order_status, confirmed_total_jmd, confirmed_at, invoice_sent_at, paid_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      orders.push(...data);
      if (data.length < pageSize) break;
    }

    const paidOrders = orders.filter((order) => order.order_status === 'paid');
    return json(res, 200, {
      orders,
      metrics: {
        lifetimePurchaseCount: paidOrders.length,
        lifetimeRevenueJmd: paidOrders.reduce((total, order) => total + (order.confirmed_total_jmd || 0), 0),
      },
    });
  } catch (error) {
    console.error('Unable to load admin orders.', error instanceof Error ? error.message : 'Unknown error.');
    return json(res, 500, { error: 'Orders could not be loaded. Please try again.' });
  }
}
