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
const topperQuantityKey = 'foreverflorals.order.topper-quantities';
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
const inspirationInput = document.querySelector('[data-inspiration]');
const inspirationName = document.querySelector('[data-inspiration-name]');
let cart = [];
let topperQuantities = {};
let cartReady = false;
let orderServiceReady = false;
let isSubmitting = false;

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
    value: input.value,
    name: input.dataset.name || input.value,
    price: input.dataset.price === undefined ? null : Number(input.dataset.price),
    quantity: topperQuantities[input.value] || 1,
  }));
}

function getTopperSubtotal() {
  return getSelectedToppers().reduce((total, topper) => total + (topper.price ?? 0) * topper.quantity, 0);
}

function getExpandedToppers() {
  return getSelectedToppers().flatMap(({ value, quantity }) => Array(quantity).fill(value));
}

function saveTopperSelections() {
  const selected = [...document.querySelectorAll('input[name="toppers"]:checked')];
  localStorage.setItem(topperKey, JSON.stringify(selected.map((option) => option.value)));
  localStorage.setItem(topperQuantityKey, JSON.stringify(topperQuantities));
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
    : `${formatPrice(topper.price)} each`;

  const controls = document.createElement('div');
  controls.className = 'cart-controls';
  if (topper.price !== null) {
    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.dataset.topperAction = 'decrease';
    decrease.dataset.topperValue = topper.value;
    decrease.setAttribute('aria-label', `Remove one ${topper.name}`);
    decrease.textContent = '-';
    const quantity = document.createElement('span');
    quantity.textContent = String(topper.quantity);
    quantity.setAttribute('aria-label', `${topper.name} quantity`);
    const increase = document.createElement('button');
    increase.type = 'button';
    increase.dataset.topperAction = 'increase';
    increase.dataset.topperValue = topper.value;
    increase.disabled = topper.quantity >= 20;
    increase.setAttribute('aria-label', `Add one ${topper.name}`);
    increase.textContent = '+';
    controls.append(decrease, quantity, increase);
    price.textContent = `${formatPrice(topper.price)} each · ${formatPrice(topper.price * topper.quantity)} total`;
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.dataset.topperAction = 'remove';
  remove.dataset.topperValue = topper.value;
  remove.textContent = 'Remove';
  controls.append(remove);
  article.append(title, price, controls);
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
    toppers: getSelectedToppers(),
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
  if (submitButton) submitButton.disabled = !orderServiceReady || count === 0 || !cartReady || isSubmitting;
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

function updateTopperQuantity(value, action) {
  const checkbox = [...document.querySelectorAll('input[name="toppers"]')].find((input) => input.value === value);
  if (!checkbox) return;
  const quantity = topperQuantities[value] || 1;
  if (action === 'increase' && quantity < 20) {
    topperQuantities[value] = quantity + 1;
  } else if (action === 'decrease' && quantity > 1) {
    topperQuantities[value] = quantity - 1;
  } else if (action === 'decrease' || action === 'remove') {
    checkbox.checked = false;
    delete topperQuantities[value];
  }
  saveTopperSelections();
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
  const savedQuantities = JSON.parse(localStorage.getItem(topperQuantityKey) || '{}');
  if (!savedQuantities || typeof savedQuantities !== 'object' || Array.isArray(savedQuantities)) {
    throw new TypeError('Saved topper quantities must be an object.');
  }
  topperQuantities = {};
  document.querySelectorAll('input[name="toppers"]').forEach((input) => {
    input.checked = selectedToppers.includes(input.value);
    const quantity = savedQuantities[input.value];
    if (input.checked) {
      topperQuantities[input.value] = Number.isInteger(quantity) && quantity >= 1 && quantity <= 20 ? quantity : 1;
    }
  });
} catch (error) {
  console.error('Unable to load saved topper selections.', error);
  cartMessage.textContent = 'Saved topper selections could not be loaded. Please review them before sending your enquiry.';
}

renderCart();

document.querySelector('[data-cart-items]')?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  if (target.dataset.topperAction) {
    try {
      updateTopperQuantity(target.dataset.topperValue, target.dataset.topperAction);
      cartMessage.textContent = '';
      renderCart();
    } catch (error) {
      console.error('Unable to update topper quantities.', error);
      cartMessage.textContent = 'Your topper selection could not be updated.';
    }
    return;
  }
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
      if (input.checked) {
        topperQuantities[input.value] = topperQuantities[input.value] || 1;
      } else {
        delete topperQuantities[input.value];
      }
      saveTopperSelections();
    } catch (error) {
      console.error('Unable to save order topper selections.', error);
      cartMessage.textContent = 'Your topper selections could not be saved.';
    }
    renderCart();
  });
});

document.querySelector('[data-add-product]')?.addEventListener('click', () => {
  const selector = document.querySelector('[data-add-product-select]');
  if (!(selector instanceof HTMLSelectElement) || !products[selector.value]) {
    cartMessage.textContent = 'Choose a valid bouquet to add.';
    return;
  }
  if (addProduct(selector.value)) {
    cartMessage.textContent = `${products[selector.value].name} added to your cart.`;
    renderCart();
  }
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

inspirationInput?.addEventListener('change', () => {
  if (inspirationInput instanceof HTMLInputElement && inspirationName) {
    inspirationName.textContent = inspirationInput.files?.[0]?.name || 'No photo selected';
  }
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

async function fileToBase64(file) {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('The inspiration photo must be 2 MB or smaller.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function checkOrderService() {
  try {
    const response = await fetch('/api/orders', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Order service check returned ${response.status}.`);
    const result = await response.json();
    orderServiceReady = result.ready === true;
    setStatus(
      orderServiceReady
        ? 'Your order will be securely saved and sent to Forever Florals.'
        : 'Online orders are being set up. Please contact us on WhatsApp for now.',
      !orderServiceReady,
    );
  } catch (error) {
    console.error('Unable to check order submission availability.', error);
    setStatus('Online ordering is temporarily unavailable. Please contact us on WhatsApp.', true);
  }
  renderCart();
}

checkOrderService();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  updateConditionalFields();
  updateOrderSummary();
  if (isSubmitting) return;
  if (cartQuantity() === 0) {
    setStatus('Add at least one bouquet to your cart before sending your enquiry.', true);
    return;
  }
  if (!orderServiceReady) {
    setStatus('Online ordering is not connected yet. Please use the WhatsApp link for now.', true);
    return;
  }
  if (!form.checkValidity()) {
    form.reportValidity();
    setStatus('Please complete the required order details.', true);
    return;
  }

  const values = new FormData(form);
  const inspiration = values.get('inspiration');
  try {
    isSubmitting = true;
    renderCart();
    setStatus('Sending your order securely…');
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        customer: {
          name: values.get('name'),
          email: values.get('email'),
          phone: values.get('phone'),
        },
        cart,
        dateNeeded: values.get('date_needed'),
        occasion: values.get('occasion'),
        wrapColor: values.get('wrap_color'),
        toppers: getExpandedToppers(),
        delivery: values.get('delivery'),
        deliveryDetails: values.get('delivery_details'),
        cashAmount: values.get('cash_amount'),
        cashDenominations: values.getAll('cash_denominations'),
        specialInstructions: values.get('details'),
        inspiration: inspiration instanceof File && inspiration.size > 0
          ? {
              type: inspiration.type,
              data: await fileToBase64(inspiration),
            }
          : null,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'We could not submit your order. Please try again.');
    }
    if (result.emailSent) {
      setStatus('Your order was received. Forever Florals will follow up with you soon.');
    } else {
      setStatus('Your order was saved, but the shop notification could not be sent. Please also contact us on WhatsApp.', true);
    }
    cart = [];
    saveCart();
    renderCart();
    form.reset();
    document.querySelectorAll('input[name="toppers"]').forEach((input) => {
      input.checked = false;
    });
    topperQuantities = {};
    if (inspirationName) inspirationName.textContent = 'No photo selected';
    try {
      localStorage.removeItem(topperKey);
      localStorage.removeItem(topperQuantityKey);
    } catch (error) {
      console.error('Unable to clear saved order topper selections.', error);
    }
  } catch (error) {
    console.error('Unable to submit Forever Florals order.', error);
    setStatus(error instanceof Error ? error.message : 'We could not submit your order. Please try again.', true);
  } finally {
    isSubmitting = false;
    renderCart();
  }
});
