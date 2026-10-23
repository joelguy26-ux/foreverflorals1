const products = {
  '9-ct': { name: '9 ct bouquet', price: 4500, image: '/images/IMG_3108.jpeg' },
  '15-ct': { name: '15 ct bouquet', price: 6500, image: '/images/IMG_2346.jpg' },
  '24-ct': { name: '24 ct bouquet', price: 8500, image: '/images/IMG_2347.jpg' },
  '36-ct': { name: '36 ct bouquet', price: 10000, image: '/images/IMG_2349.jpg' },
  '50-ct': { name: '50 ct bouquet', price: 15000, image: '/images/pink-rose-bouquet-18.png' },
  'money-bouquet': { name: 'Money bouquet', price: null, image: '/images/IMG_3110.jpeg' },
  'special-request': { name: 'Special request bouquet', price: null, image: '/images/ChatGPT%20Image%20Oct%204,%202026,%2010_11_12%20PM.png' },
};

const cartKey = 'foreverflorals.order.cart';
const topperKey = 'foreverflorals.order.toppers';
const form = document.getElementById('orderForm');
const cartItems = document.querySelector('[data-cart-items]');
const cartMessage = document.querySelector('[data-cart-message]');
const cartSubtotal = document.querySelector('[data-cart-subtotal]');
const cartTopperSubtotal = document.querySelector('[data-cart-topper-subtotal]');
const cartTotal = document.querySelector('[data-cart-total]');
const cartCount = document.querySelector('[data-cart-count]');
const emptyCart = document.querySelector('[data-empty-cart]');
const status = document.querySelector('[data-form-status]');
const submitButton = document.querySelector('[data-submit-order]');
const orderSummary = document.querySelector('[data-order-summary]');
const deliverySelect = document.querySelector('[data-delivery]');
const deliveryDetails = document.querySelector('[data-delivery-details]');
const deliveryDetailsInput = deliveryDetails?.querySelector('textarea');
const moneyOptions = document.querySelector('[data-money-options]');
const cashAmount = document.querySelector('[data-cash-amount]');
const orderDetails = document.querySelector('[data-order-details]');
const dateNeeded = document.querySelector('[data-date-needed]');
const orderFormId = import.meta.env.VITE_FORMSPREE_FORM_ID?.trim();
const validFormId = Boolean(orderFormId && /^[a-zA-Z0-9]+$/.test(orderFormId));
let cart = [];
let cartReady = false;

function setStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('form-error', isError);
}

function formatPrice(value) {
  return `$${value.toLocaleString('en-JM')}`;
}

function saveCart() {
  try {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    return true;
  } catch (error) {
    console.error('Unable to save the Forever Florals cart.', error);
    cartMessage.textContent = 'Your cart could not be saved. Check your browser storage settings and try again.';
    return false;
  }
}

function loadCart() {
  const stored = localStorage.getItem(cartKey);
  if (!stored) return [];
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new TypeError('Saved cart data must be a list.');
  return parsed.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !products[item.id] ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      throw new TypeError('Saved cart contains an invalid bouquet or quantity.');
    }
    return { id: item.id, quantity: item.quantity };
  });
}

function cartQuantity() {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function getSubtotal() {
  return cart.reduce((total, item) => {
    const price = products[item.id].price;
    return total + (price === null ? 0 : price * item.quantity);
  }, 0);
}

function getSelectedToppers() {
  return [...document.querySelectorAll('input[name="toppers"]:checked')].map((input) => ({
    name: input.dataset.name || input.value,
    price: input.dataset.price === undefined ? null : Number(input.dataset.price),
  }));
}

function getTopperSubtotal() {
  return getSelectedToppers().reduce((total, topper) => total + (topper.price ?? 0), 0);
}

function createCartItem(item) {
  const product = products[item.id];
  const article = document.createElement('article');
  article.className = 'cart-item';

  const image = document.createElement('img');
  image.src = product.image;
  image.alt = '';
  image.loading = 'lazy';

  const details = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'cart-item-title';
  title.textContent = product.name;

  const price = document.createElement('div');
  price.className = 'cart-item-price';
  price.textContent = product.price === null ? 'Price confirmed by quote' : `${formatPrice(product.price)} each`;

  const controls = document.createElement('div');
  controls.className = 'cart-controls';
  const decrease = document.createElement('button');
  decrease.type = 'button';
  decrease.dataset.cartAction = 'decrease';
  decrease.dataset.productId = item.id;
  decrease.setAttribute('aria-label', `Remove one ${product.name}`);
  decrease.textContent = '-';
  const quantity = document.createElement('span');
  quantity.textContent = String(item.quantity);
  quantity.setAttribute('aria-label', 'Quantity');
  const increase = document.createElement('button');
  increase.type = 'button';
  increase.dataset.cartAction = 'increase';
  increase.dataset.productId = item.id;
  increase.disabled = item.quantity >= 20;
  increase.setAttribute('aria-label', `Add one ${product.name}`);
  increase.textContent = '+';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.dataset.cartAction = 'remove';
  remove.dataset.productId = item.id;
  remove.textContent = 'Remove';

  controls.append(decrease, quantity, increase, remove);
  details.append(title, price, controls);
  article.append(image, details);
  return article;
}

function createCartTopper(topper) {
  const article = document.createElement('article');
  article.className = 'cart-item cart-addon';

  const title = document.createElement('div');
  title.className = 'cart-item-title';
  title.textContent = topper.name;

  const price = document.createElement('div');
  price.className = 'cart-item-price';
  price.textContent = topper.price === null
    ? 'Price confirmed by quote'
    : `${formatPrice(topper.price)} (one selected)`;

  article.append(title, price);
  return article;
}

function updateOrderSummary() {
  if (!(form instanceof HTMLFormElement) || !orderSummary) return;
  const values = new FormData(form);
  orderSummary.value = JSON.stringify({
    bouquets: cart.map(({ id, quantity }) => ({
      name: products[id].name,
      quantity,
      unitPrice: products[id].price,
    })),
    bouquetSubtotal: getSubtotal(),
    topperSubtotal: getTopperSubtotal(),
    estimatedTotal: getSubtotal() + getTopperSubtotal(),
    wrap: values.get('wrap_color'),
    toppers: values.getAll('toppers'),
    delivery: values.get('delivery'),
    deliveryDetails: values.get('delivery_details'),
    dateNeeded: values.get('date_needed'),
    occasion: values.get('occasion'),
    cashAmount: values.get('cash_amount'),
    cashDenominations: values.getAll('cash_denominations'),
    specialInstructions: values.get('details'),
  });
}

function updateConditionalFields() {
  const needsDeliveryDetails = ['Knutsford Express shipping (free to courier)', 'Pickup'].includes(deliverySelect?.value || '');
  if (deliveryDetails) deliveryDetails.hidden = !needsDeliveryDetails;
  if (deliveryDetailsInput) deliveryDetailsInput.required = needsDeliveryDetails;

  const hasMoneyBouquet = cart.some((item) => item.id === 'money-bouquet');
  if (moneyOptions) moneyOptions.hidden = !hasMoneyBouquet;
  if (cashAmount) cashAmount.required = hasMoneyBouquet;
  const denominations = [...document.querySelectorAll('input[name="cash_denominations"]')];
  denominations.forEach((input) => {
    input.required = false;
    input.setCustomValidity('');
  });
  if (hasMoneyBouquet && denominations.length > 0) {
    denominations[0].setCustomValidity(
      denominations.some((input) => input.checked) ? '' : 'Choose at least one note denomination.',
    );
  }

  const needsDetails = cart.some((item) => item.id === 'money-bouquet' || item.id === 'special-request');
  if (orderDetails) orderDetails.required = needsDetails;
}

function renderCart() {
  if (!(cartItems instanceof HTMLElement)) return;
  cartItems.replaceChildren(
    ...cart.map(createCartItem),
    ...getSelectedToppers().map(createCartTopper),
  );
  const topperSubtotal = getTopperSubtotal();
  if (cartTopperSubtotal) cartTopperSubtotal.textContent = formatPrice(topperSubtotal);
  if (cartTotal) cartTotal.textContent = formatPrice(getSubtotal() + topperSubtotal);
  const count = cartQuantity();
  if (cartCount) cartCount.textContent = String(count);
  if (emptyCart) emptyCart.hidden = count > 0;
  if (cartSubtotal) cartSubtotal.textContent = formatPrice(getSubtotal());
  if (submitButton) submitButton.disabled = !validFormId || count === 0 || !cartReady;
  updateConditionalFields();
  updateOrderSummary();
}

function addProduct(id) {
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    if (existing.quantity >= 20) {
      cartMessage.textContent = 'You can add up to 20 of each bouquet.';
      return false;
    }
    existing.quantity += 1;
  } else {
    cart.push({ id, quantity: 1 });
  }
  if (!saveCart()) return false;
  return true;
}

try {
  cart = loadCart();
  cartReady = true;
} catch (error) {
  console.error('Unable to read the Forever Florals cart.', error);
  cartMessage.textContent = 'Your saved cart could not be read. Clear this site’s saved cart data or try another browser.';
  cartReady = false;
}

const requestedProduct = new URLSearchParams(window.location.search).get('product');
if (requestedProduct) {
  if (products[requestedProduct]) {
    if (cartReady && addProduct(requestedProduct)) {
      cartMessage.textContent = `${products[requestedProduct].name} added to your cart.`;
    }
    window.history.replaceState(null, '', '/order.html');
  } else {
    cartMessage.textContent = 'That bouquet could not be identified. Please select one from the bouquet list.';
  }
}

try {
  const selectedToppers = JSON.parse(localStorage.getItem(topperKey) || '[]');
  if (!Array.isArray(selectedToppers)) throw new TypeError('Saved topper selections must be a list.');
  document.querySelectorAll('input[name="toppers"]').forEach((input) => {
    input.checked = selectedToppers.includes(input.value);
  });
} catch (error) {
  console.error('Unable to load saved topper selections.', error);
  cartMessage.textContent = 'Saved topper selections could not be loaded. Please review them before sending your enquiry.';
}

renderCart();

document.querySelector('[data-cart-items]')?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const item = cart.find((entry) => entry.id === target.dataset.productId);
  if (!item) return;
  if (target.dataset.cartAction === 'increase' && item.quantity < 20) {
    item.quantity += 1;
  } else if (target.dataset.cartAction === 'decrease') {
    item.quantity -= 1;
    if (item.quantity < 1) cart = cart.filter((entry) => entry.id !== item.id);
  } else if (target.dataset.cartAction === 'remove') {
    cart = cart.filter((entry) => entry.id !== item.id);
  } else {
    return;
  }
  if (saveCart()) {
    cartMessage.textContent = '';
    renderCart();
  }
});

document.querySelectorAll('input[name="toppers"]').forEach((input) => {
  input.addEventListener('change', () => {
    try {
      localStorage.setItem(
        topperKey,
        JSON.stringify([...document.querySelectorAll('input[name="toppers"]:checked')].map((option) => option.value)),
      );
    } catch (error) {
      console.error('Unable to save order topper selections.', error);
      cartMessage.textContent = 'Your topper selections could not be saved.';
    }
    renderCart();
  });
});

form?.addEventListener('input', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name === 'cash_denominations') {
    updateConditionalFields();
  }
  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    event.inputType?.startsWith('insert')
  ) {
    const field = target.closest('.field');
    if (field) {
      field.classList.remove('is-shaking');
      void field.offsetWidth;
      field.classList.add('is-shaking');
    }
  }
  updateOrderSummary();
});

form?.addEventListener('change', () => {
  updateConditionalFields();
  updateOrderSummary();
});

form?.addEventListener('animationend', (event) => {
  const field = event.target;
  if (event.animationName === 'field-glitch' && field instanceof HTMLElement) {
    field.classList.remove('is-shaking');
  }
});

if (dateNeeded instanceof HTMLInputElement) {
  const localDate = new Date();
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  dateNeeded.min = localDate.toISOString().slice(0, 10);
}

if (validFormId && form instanceof HTMLFormElement) {
  form.action = `https://formspree.io/f/${orderFormId}`;
  setStatus('Your enquiry will be sent securely. We will confirm pricing and availability by email.');
} else {
  setStatus('Email ordering is not connected yet. Configure VITE_FORMSPREE_FORM_ID to enable email orders.', true);
}

form?.addEventListener('submit', (event) => {
  updateConditionalFields();
  updateOrderSummary();
  if (cartQuantity() === 0) {
    event.preventDefault();
    setStatus('Add at least one bouquet to your cart before sending your enquiry.', true);
    return;
  }
  if (!validFormId) {
    event.preventDefault();
    setStatus('Email ordering is not connected yet. Please use the WhatsApp link while email is being set up.', true);
    return;
  }
  if (!form.checkValidity()) {
    event.preventDefault();
    form.reportValidity();
    setStatus('Please complete the required order details.', true);
  }
});
