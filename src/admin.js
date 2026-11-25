import { createClient } from '@supabase/supabase-js';

const loginPanel = document.querySelector('[data-login-panel]');
const loginForm = document.querySelector('[data-login-form]');
const loginStatus = document.querySelector('[data-login-status]');
const passwordResetButton = document.querySelector('[data-password-reset]');
const passwordRecoveryPanel = document.querySelector('[data-password-recovery]');
const passwordForm = document.querySelector('[data-password-form]');
const passwordStatus = document.querySelector('[data-password-status]');
const cancelDialog = document.querySelector('[data-cancel-dialog]');
const cancelDialogHeading = document.querySelector('[data-cancel-dialog-heading]');
const cancelDialogMessage = document.querySelector('[data-cancel-dialog-message]');
const previewLink = document.querySelector('[data-preview-link]');
const previewNotice = document.querySelector('[data-preview-notice]');
const settingsForm = document.querySelector('[data-settings-form]');
const settingsStatus = document.querySelector('[data-settings-status]');
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
const previewMode = import.meta.env.DEV;
const adminRedirectUrl = 'https://www.foreverflorals.store/admin';
const recoveryLink = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
  || new URLSearchParams(window.location.search).get('type') === 'recovery';
let session = null;

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function confirmCancellation(order) {
  if (
    !(cancelDialog instanceof HTMLDialogElement) ||
    !(cancelDialogHeading instanceof HTMLElement) ||
    !(cancelDialogMessage instanceof HTMLElement)
  ) {
    return Promise.reject(new Error('The cancellation confirmation dialog is unavailable.'));
  }
  const isInquiry = order.order_status === 'inquiry';
  cancelDialogHeading.textContent = isInquiry ? 'Cancel this inquiry?' : 'Cancel this order?';
  cancelDialogMessage.textContent = `Are you sure you want to cancel ${order.customer_name}'s ${isInquiry ? 'inquiry' : 'order'}? This cannot be undone from the dashboard.`;
  cancelDialog.returnValue = '';

  return new Promise((resolve, reject) => {
    const handleClose = () => resolve(cancelDialog.returnValue === 'confirm');
    cancelDialog.addEventListener('close', handleClose, { once: true });
    try {
      cancelDialog.showModal();
    } catch (error) {
      cancelDialog.removeEventListener('close', handleClose);
      reject(error);
    }
  });
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
  if (loginPanel) {
    loginPanel.classList.remove('login-enter');
    if (isSignedIn) {
      loginPanel.classList.add('login-exit');
      window.setTimeout(() => {
        loginPanel.hidden = true;
        loginPanel.classList.remove('login-exit');
      }, 280);
    } else {
      loginPanel.hidden = false;
      loginPanel.classList.add('login-enter');
      window.setTimeout(() => loginPanel.classList.remove('login-enter'), 320);
    }
  }
  if (passwordRecoveryPanel) passwordRecoveryPanel.hidden = true;
  if (dashboard) {
    dashboard.hidden = !isSignedIn;
    dashboard.classList.remove('dashboard-enter');
    if (isSignedIn) {
      void dashboard.offsetWidth;
      dashboard.classList.add('dashboard-enter');
    }
  }
  if (signOutButton) signOutButton.hidden = !isSignedIn;
}

function showPasswordRecovery(recoverySession) {
  const email = recoverySession?.user.email?.trim().toLowerCase();
  if (!recoverySession || !adminEmails.has(email || '')) {
    setMessage(loginStatus, 'This password reset link is invalid or expired. Request a new one using an allowed admin email.', true);
    if (loginPanel) loginPanel.hidden = false;
    if (passwordRecoveryPanel) passwordRecoveryPanel.hidden = true;
    return false;
  }
  session = recoverySession;
  if (loginPanel) loginPanel.hidden = true;
  if (dashboard) dashboard.hidden = true;
  if (passwordRecoveryPanel) passwordRecoveryPanel.hidden = false;
  if (signOutButton) signOutButton.hidden = true;
  setMessage(passwordStatus, 'Choose a new password for your admin account.');
  return true;
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
  const notificationStatus = createTextElement(
    'p',
    'order-meta',
    `Shop email: ${(order.notification_status || 'unknown').replaceAll('_', ' ')} · Customer email: ${(order.customer_notification_status || 'unknown').replaceAll('_', ' ')}`,
  );
  notificationStatus.classList.toggle(
    'error',
    order.notification_status === 'failed' || order.customer_notification_status === 'failed',
  );

  const columns = document.createElement('div');
  columns.className = 'order-columns';
  const contact = createTextElement('p', 'order-details', `${order.customer_email}\n${order.customer_phone}`);
  const details = createTextElement('p', 'order-details',
    `${bouquetDescription(order)}\nToppers: ${topperDescription(order.toppers)}\nWrap: ${order.wrap_color}\nDelivery: ${order.delivery}${order.delivery_details ? `\nDetails: ${order.delivery_details}` : ''}\nDate needed: ${order.date_needed}\nOccasion: ${order.occasion || 'Not specified'}${order.cash_amount ? `\nMoney bouquet cash: ${order.cash_amount}` : ''}${order.cash_denominations?.length ? `\nCash denominations: ${order.cash_denominations.join(', ')}` : ''}${order.special_instructions ? `\nInstructions: ${order.special_instructions}` : ''}`);
  columns.append(contact, details);
  card.append(top, notificationStatus, columns);

  const notes = document.createElement('div');
  notes.className = 'order-notes';
  const notesLabel = document.createElement('label');
  const noteLocked = Boolean(order.invoice_sent_at);
  notesLabel.textContent = 'Message for customer (included in invoice)';
  const notesInput = document.createElement('textarea');
  notesInput.maxLength = 2000;
  notesInput.value = order.customer_note || '';
  notesInput.readOnly = noteLocked;
  notesInput.setAttribute('aria-label', `Message for customer for order ${order.id.slice(0, 8)}`);
  notes.append(notesLabel, notesInput);
  if (noteLocked) {
    notes.append(createTextElement('p', 'order-meta', 'Locked because the first invoice has been sent.'));
  } else {
    const saveNote = document.createElement('button');
    saveNote.type = 'button';
    saveNote.className = 'secondary';
    saveNote.textContent = 'Save customer message';
    saveNote.addEventListener('click', () => updateOrder(order.id, {
      action: 'save_customer_note',
      note: notesInput.value,
    }));
    notes.append(saveNote, createTextElement('p', 'order-meta', 'Save before sending the invoice. This message will be locked after the invoice is sent.'));
  }
  card.append(notes);

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
    cancel.addEventListener('click', async () => {
      try {
        if (await confirmCancellation(order)) await updateOrder(order.id, { action: 'cancel' });
      } catch (error) {
        setMessage(dashboardStatus, error instanceof Error ? error.message : 'The cancellation could not be confirmed.', true);
      }
    });
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
    cancel.addEventListener('click', async () => {
      try {
        if (await confirmCancellation(order)) await updateOrder(order.id, { action: 'cancel' });
      } catch (error) {
        setMessage(dashboardStatus, error instanceof Error ? error.message : 'The cancellation could not be confirmed.', true);
      }
    });
    controls.append(resend, paid, cancel);
    card.append(controls);
  } else if (order.order_status === 'paid') {
    card.append(createTextElement('p', 'order-meta',
      `Paid ${order.paid_at ? new Date(order.paid_at).toLocaleString() : ''} · Total: ${formatJmd(order.confirmed_total_jmd)}`));
  } else {
    card.append(createTextElement('p', 'order-meta', 'This inquiry was cancelled.'));
  }
  if (previewMode) {
    card.querySelectorAll('button, input, textarea').forEach((control) => { control.disabled = true; });
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
  if (previewMode) {
    const orders = [
      {
        id: 'a1b2c3d4-1111-4111-8111-111111111111',
        created_at: '2026-11-15T14:30:00.000Z',
        customer_name: 'Sample Customer',
        customer_email: 'customer@example.com',
        customer_phone: '876-555-0100',
        date_needed: '2026-12-10',
        occasion: 'Birthday',
        wrap_color: 'Pink',
        delivery: "St. Ann's Bay, face-to-face ($500)",
        delivery_details: 'Sample delivery details',
        bouquet_items: [{ name: '24 ct bouquet', quantity: 1, unitPrice: 8500 }],
        toppers: ['Bow ($100 ea)'],
        cash_denominations: [],
        estimated_total_jmd: 8600,
        order_status: 'inquiry',
        notification_status: 'sent',
        customer_notification_status: 'sent',
        customer_note: 'Please call before delivery.',
      },
      {
        id: 'a1b2c3d4-2222-4222-8222-222222222222',
        created_at: '2026-11-14T10:15:00.000Z',
        customer_name: 'Example Client',
        customer_email: 'client@example.com',
        customer_phone: '876-555-0101',
        date_needed: '2026-12-05',
        occasion: 'Anniversary',
        wrap_color: 'White',
        delivery: 'Pickup',
        delivery_details: null,
        bouquet_items: [{ name: '36 ct bouquet', quantity: 1, unitPrice: 10000 }],
        toppers: ['Glitter ($300)'],
        cash_denominations: [],
        order_status: 'confirmed',
        confirmed_total_jmd: 12500,
        invoice_sent_at: '2026-11-14T11:00:00.000Z',
        notification_status: 'sent',
        customer_notification_status: 'sent',
        customer_note: 'Happy anniversary! We hope you enjoy your bouquet.',
      },
      {
        id: 'a1b2c3d4-3333-4333-8333-333333333333',
        created_at: '2026-11-12T09:00:00.000Z',
        customer_name: 'Demo Buyer',
        customer_email: 'buyer@example.com',
        customer_phone: '876-555-0102',
        date_needed: '2026-11-20',
        occasion: 'Graduation',
        wrap_color: 'Black',
        delivery: 'Pickup',
        delivery_details: null,
        bouquet_items: [{ name: '50 ct bouquet', quantity: 1, unitPrice: 15000 }],
        toppers: [],
        cash_denominations: [],
        order_status: 'paid',
        confirmed_total_jmd: 15000,
        paid_at: '2026-11-13T12:00:00.000Z',
        notification_status: 'failed',
        customer_notification_status: 'sent',
        customer_note: '',
      },
    ];
    if (lifetimeCount) lifetimeCount.textContent = '2';
    if (lifetimeRevenue) lifetimeRevenue.textContent = formatJmd(27500);
    orderList?.replaceChildren(...orders.map(createOrderCard));
    setMessage(dashboardStatus, `${orders.length} sample inquiries or orders loaded.`);
    return;
  }

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

async function loadPaymentSettings() {
  if (previewMode) return;
  if (!(settingsForm instanceof HTMLFormElement)) return;

  try {
    const { settings } = await apiRequest('/api/admin/settings');
    for (const [field, value] of Object.entries(settings)) {
      const input = settingsForm.elements.namedItem(field);
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        input.value = value || '';
      }
    }
    setMessage(settingsStatus, 'Payment details loaded.');
  } catch (error) {
    setMessage(settingsStatus, error instanceof Error ? error.message : 'Payment details could not be loaded.', true);
  }
}

async function savePaymentSettings(event) {
  event.preventDefault();
  if (previewMode || !(settingsForm instanceof HTMLFormElement)) return;

  const values = Object.fromEntries(new FormData(settingsForm));
  const button = settingsForm.querySelector('button[type="submit"]');
  if (button instanceof HTMLButtonElement) button.disabled = true;
  setMessage(settingsStatus, 'Saving payment details…');
  try {
    await apiRequest('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    setMessage(settingsStatus, 'Payment details saved. They will be used in new and resent invoices.');
  } catch (error) {
    setMessage(settingsStatus, error instanceof Error ? error.message : 'Payment details could not be saved.', true);
  } finally {
    if (button instanceof HTMLButtonElement) button.disabled = false;
  }
}

async function updateOrder(orderId, action) {
  if (previewMode) return;
  const buttons = orderList?.querySelectorAll('button');
  buttons?.forEach((button) => { button.disabled = true; });
  setMessage(dashboardStatus, action.action === 'confirm'
    ? 'Confirming order and sending invoice…'
    : action.action === 'save_notes' ? 'Saving internal notes…' : 'Updating order…');
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
  if (previewMode) return;
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
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session || !adminEmails.has(data.user.email?.trim().toLowerCase() || '')) {
      await supabase.auth.signOut();
      throw new Error('This account is not allowed to access the admin dashboard.');
    }
    session = data.session;
    showDashboard(true);
    await loadOrders();
    await loadPaymentSettings();
  } catch (error) {
    setMessage(loginStatus, error instanceof Error ? error.message : 'Sign in could not be completed.', true);
  }
}

async function requestPasswordReset() {
  if (previewMode) return;
  if (!supabase || adminEmails.size === 0 || !(loginForm instanceof HTMLFormElement)) {
    setMessage(loginStatus, 'Admin sign-in is not configured. Set the public Supabase URL, anon key, and allowed admin email build variable.', true);
    return;
  }
  const emailInput = loginForm.elements.namedItem('email');
  const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim().toLowerCase() : '';
  if (!adminEmails.has(email)) {
    setMessage(loginStatus, 'Enter an allowed admin email address first.', true);
    return;
  }

  setMessage(loginStatus, 'Sending a password setup/reset link…');
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: adminRedirectUrl,
    });
    if (error) throw error;
    setMessage(loginStatus, 'If this admin account exists, a secure password setup/reset link has been sent. Check your inbox and spam folder.');
  } catch (error) {
    setMessage(loginStatus, error instanceof Error ? error.message : 'The password setup/reset email could not be sent.', true);
  }
}

async function saveNewPassword(event) {
  event.preventDefault();
  if (!supabase || !(passwordForm instanceof HTMLFormElement) || !session) {
    setMessage(passwordStatus, 'This password reset link is invalid or expired. Request a new one.', true);
    return;
  }
  const values = new FormData(passwordForm);
  const password = String(values.get('password') || '');
  const confirmation = String(values.get('confirm-password') || '');
  if (password.length < 8) {
    setMessage(passwordStatus, 'Choose a password with at least 8 characters.', true);
    return;
  }
  if (password !== confirmation) {
    setMessage(passwordStatus, 'The passwords do not match.', true);
    return;
  }

  const submitButton = passwordForm.querySelector('button[type="submit"]');
  if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
  setMessage(passwordStatus, 'Saving your new password…');
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    const email = session.user.email?.trim().toLowerCase() || '';
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    session = null;
    passwordForm.reset();
    if (passwordRecoveryPanel) passwordRecoveryPanel.hidden = true;
    if (loginPanel) loginPanel.hidden = false;
    if (loginForm instanceof HTMLFormElement) {
      const emailInput = loginForm.elements.namedItem('email');
      if (emailInput instanceof HTMLInputElement) emailInput.value = email;
    }
    setMessage(loginStatus, 'Password saved. Sign in with your new password.');
  } catch (error) {
    setMessage(passwordStatus, error instanceof Error ? error.message : 'The new password could not be saved.', true);
  } finally {
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
  }
}

if (loginForm instanceof HTMLFormElement) loginForm.addEventListener('submit', (event) => void signIn(event));
if (passwordResetButton) passwordResetButton.addEventListener('click', () => void requestPasswordReset());
if (passwordForm instanceof HTMLFormElement) passwordForm.addEventListener('submit', (event) => void saveNewPassword(event));
document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const field = toggle.closest('.password-field')?.querySelector('input');
    if (!(field instanceof HTMLInputElement)) return;
    const reveal = field.type === 'password';
    field.type = reveal ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(reveal));
    toggle.setAttribute('aria-label', reveal
      ? toggle.getAttribute('aria-label')?.replace(/^Show/, 'Hide') || 'Hide password'
      : toggle.getAttribute('aria-label')?.replace(/^Hide/, 'Show') || 'Show password');
  });
});
if (settingsForm instanceof HTMLFormElement) settingsForm.addEventListener('submit', (event) => void savePaymentSettings(event));
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
if (import.meta.env.DEV && previewLink) previewLink.hidden = false;
window.setInterval(() => {
  if (session) void loadOrders();
}, 60_000);

if (previewMode) {
  showDashboard(true);
  if (signOutButton) signOutButton.hidden = true;
  if (previewNotice) previewNotice.hidden = false;
  if (settingsForm instanceof HTMLFormElement) {
    settingsForm.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
  }
  setMessage(settingsStatus, 'Payment settings are disabled in sample preview mode.');
  void loadOrders();
} else if (!supabase || adminEmails.size === 0) {
  setMessage(loginStatus, 'Admin sign-in is not configured. Set the public Supabase URL, anon key, and allowed admin email build variable.', true);
} else {
  supabase.auth.onAuthStateChange((event, authSession) => {
    if (event === 'PASSWORD_RECOVERY') showPasswordRecovery(authSession);
  });
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      setMessage(loginStatus, error.message, true);
      return;
    }
    if (recoveryLink) {
      showPasswordRecovery(data.session);
      return;
    }
    const userEmail = data.session?.user.email?.trim().toLowerCase();
    if (data.session && adminEmails.has(userEmail || '')) {
      session = data.session;
      showDashboard(true);
      void loadOrders();
      void loadPaymentSettings();
    } else if (data.session) {
      void supabase.auth.signOut();
      setMessage(loginStatus, 'This account is not allowed to access the admin dashboard.', true);
    }
  }).catch((error) => {
    setMessage(loginStatus, error instanceof Error ? error.message : 'The admin session could not be loaded.', true);
  });
}
