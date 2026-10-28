import { createClient } from '@supabase/supabase-js';

const loginPanel = document.querySelector('[data-login-panel]');
const loginForm = document.querySelector('[data-login-form]');
const loginStatus = document.querySelector('[data-login-status]');
const dashboard = document.querySelector('[data-dashboard]');
const dashboardStatus = document.querySelector('[data-dashboard-status]');
const orderList = document.querySelector('[data-order-list]');
const signOutButton = document.querySelector('[data-sign-out]');
const lifetimeCount = document.querySelector('[data-lifetime-count]');
const lifetimeRevenue = document.querySelector('[data-lifetime-revenue]');
const adminEmails = new Set(
  (import.meta.env.VITE_ORDER_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
let session = null;

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function formatJmd(amount) {
  return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(amount || 0);
}

function createTextElement(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = content;
  return element;
}

function showDashboard(isSignedIn) {
  if (loginPanel) loginPanel.hidden = isSignedIn;
  if (dashboard) dashboard.hidden = !isSignedIn;
  if (signOutButton) signOutButton.hidden = !isSignedIn;
}

function bouquetDescription(order) {
  if (!Array.isArray(order.bouquet_items)) return 'Bouquet details unavailable';
  return order.bouquet_items.map((item) => {
    const price = item.unitPrice === null ? 'quote' : `${formatJmd(item.unitPrice)} each`;
    return `${item.quantity} × ${item.name} (${price})`;
  }).join(', ') || 'No bouquet details';
}

function topperDescription(toppers) {
  if (!Array.isArray(toppers) || toppers.length === 0) return 'None';
  const counts = new Map();
  toppers.forEach((topper) => counts.set(topper, (counts.get(topper) || 0) + 1));
  return [...counts].map(([topper, quantity]) => quantity > 1 ? `${quantity} × ${topper}` : topper).join(', ');
}

function createOrderCard(order) {
  const card = document.createElement('article');
  card.className = 'panel order';

  const top = document.createElement('div');
  top.className = 'order-top';
  const heading = document.createElement('div');
  heading.append(
    createTextElement('h3', '', order.customer_name),
    createTextElement('p', 'order-meta', `Order ${order.id.slice(0, 8).toUpperCase()} · ${new Date(order.created_at).toLocaleString()}`),
  );
  const badge = createTextElement('span', `badge ${order.order_status}`, order.order_status);
  top.append(heading, badge);

  const columns = document.createElement('div');
  columns.className = 'order-columns';
  const contact = createTextElement('p', 'order-details', `${order.customer_email}\n${order.customer_phone}`);
  const details = createTextElement('p', 'order-details',
    `${bouquetDescription(order)}\nToppers: ${topperDescription(order.toppers)}\nWrap: ${order.wrap_color}\nDelivery: ${order.delivery}${order.delivery_details ? `\nDetails: ${order.delivery_details}` : ''}\nDate needed: ${order.date_needed}\nOccasion: ${order.occasion || 'Not specified'}${order.cash_amount ? `\nMoney bouquet cash: ${order.cash_amount}` : ''}${order.cash_denominations?.length ? `\nCash denominations: ${order.cash_denominations.join(', ')}` : ''}${order.special_instructions ? `\nInstructions: ${order.special_instructions}` : ''}`);
  columns.append(contact, details);
  card.append(top, columns);

  if (order.order_status === 'inquiry') {
    const controls = document.createElement('div');
    controls.className = 'order-controls';
    const label = document.createElement('label');
    label.textContent = 'Confirmed total (JMD)';
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.required = true;
    amount.value = String(order.estimated_total_jmd || '');
    amount.setAttribute('aria-label', `Confirmed total for order ${order.id.slice(0, 8)}`);
    label.append(amount);
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Confirm and email invoice';
    confirm.addEventListener('click', () => updateOrder(order.id, {
      action: 'confirm',
      confirmedTotalJmd: Number(amount.value),
    }));
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'danger';
    cancel.textContent = 'Cancel inquiry';
    cancel.addEventListener('click', () => updateOrder(order.id, { action: 'cancel' }));
    controls.append(label, confirm, cancel);
    card.append(controls);
  } else if (order.order_status === 'confirmed') {
    card.append(createTextElement(
      'p',
      'order-meta',
      `Invoice ${order.invoice_sent_at ? `sent ${new Date(order.invoice_sent_at).toLocaleString()}` : 'not sent'} · Confirmed total: ${formatJmd(order.confirmed_total_jmd)}`,
    ));
    const controls = document.createElement('div');
    controls.className = 'order-controls';
    const resend = document.createElement('button');
    resend.type = 'button';
    resend.className = 'secondary';
    resend.textContent = 'Resend invoice';
    resend.addEventListener('click', () => updateOrder(order.id, { action: 'resend_invoice' }));
    const paid = document.createElement('button');
    paid.type = 'button';
    paid.textContent = 'Mark as paid';
    paid.disabled = !order.invoice_sent_at;
    paid.addEventListener('click', () => updateOrder(order.id, { action: 'mark_paid' }));
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'danger';
    cancel.textContent = 'Cancel order';
    cancel.addEventListener('click', () => updateOrder(order.id, { action: 'cancel' }));
    controls.append(resend, paid, cancel);
    card.append(controls);
  } else if (order.order_status === 'paid') {
    card.append(createTextElement('p', 'order-meta',
      `Paid ${order.paid_at ? new Date(order.paid_at).toLocaleString() : ''} · Total: ${formatJmd(order.confirmed_total_jmd)}`));
  } else {
    card.append(createTextElement('p', 'order-meta', 'This inquiry was cancelled.'));
  }
  return card;
}

async function apiRequest(path, options = {}) {
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const message = [result.error, result.details].filter(Boolean).join(' ');
    throw new Error(message || 'The request could not be completed.');
  }
  return result;
}

async function loadOrders() {
  setMessage(dashboardStatus, 'Loading orders…');
  try {
    const result = await apiRequest('/api/admin/orders');
    if (lifetimeCount) lifetimeCount.textContent = String(result.metrics.lifetimePurchaseCount);
    if (lifetimeRevenue) lifetimeRevenue.textContent = formatJmd(result.metrics.lifetimeRevenueJmd);
    orderList?.replaceChildren();
    if (!result.orders.length) {
      orderList?.append(createTextElement('p', 'panel empty', 'There are no inquiries yet.'));
    } else {
      orderList?.append(...result.orders.map(createOrderCard));
    }
    setMessage(dashboardStatus, `${result.orders.length} inquiry or order${result.orders.length === 1 ? '' : 's'} loaded.`);
  } catch (error) {
    setMessage(dashboardStatus, error instanceof Error ? error.message : 'Orders could not be loaded.', true);
  }
}

async function updateOrder(orderId, action) {
  const buttons = orderList?.querySelectorAll('button');
  buttons?.forEach((button) => { button.disabled = true; });
  setMessage(dashboardStatus, action.action === 'confirm' ? 'Confirming order and sending invoice…' : 'Updating order…');
  try {
    await apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      body: JSON.stringify(action),
    });
    await loadOrders();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The order could not be updated.';
    await loadOrders();
    setMessage(dashboardStatus, message, true);
    orderList?.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

async function signIn(event) {
  event.preventDefault();
  if (!supabase || adminEmails.size === 0) {
    setMessage(loginStatus, 'Admin sign-in is not configured. Set the public Supabase URL, anon key, and allowed admin email build variable.', true);
    return;
  }
  const values = new FormData(loginForm);
  const email = String(values.get('email') || '').trim().toLowerCase();
  const password = String(values.get('password') || '');
  if (!adminEmails.has(email)) {
    setMessage(loginStatus, 'This email is not allowed to access the admin dashboard.', true);
    return;
  }
  setMessage(loginStatus, 'Signing in…');
  let data;
  let error;
  try {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch (requestError) {
    setMessage(loginStatus, requestError instanceof Error ? requestError.message : 'Sign in could not be completed.', true);
    return;
  }
  if (error) {
    setMessage(loginStatus, error.message, true);
    return;
  }
  session = data.session;
  showDashboard(true);
  await loadOrders();
}

if (loginForm instanceof HTMLFormElement) loginForm.addEventListener('submit', (event) => void signIn(event));
if (signOutButton) {
  signOutButton.addEventListener('click', async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setMessage(dashboardStatus, error.message, true);
        return;
      }
    }
    session = null;
    showDashboard(false);
    setMessage(loginStatus, 'You have signed out.');
  });
}
document.querySelector('[data-refresh]')?.addEventListener('click', () => void loadOrders());

if (!supabase || adminEmails.size === 0) {
  setMessage(loginStatus, 'Admin sign-in is not configured. Set the public Supabase URL, anon key, and allowed admin email build variable.', true);
} else {
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      setMessage(loginStatus, error.message, true);
      return;
    }
    const userEmail = data.session?.user.email?.trim().toLowerCase();
    if (data.session && adminEmails.has(userEmail || '')) {
      session = data.session;
      showDashboard(true);
      void loadOrders();
    } else if (data.session) {
      void supabase.auth.signOut();
      setMessage(loginStatus, 'This account is not allowed to access the admin dashboard.', true);
    }
  }).catch((error) => {
    setMessage(loginStatus, error instanceof Error ? error.message : 'The admin session could not be loaded.', true);
  });
}
