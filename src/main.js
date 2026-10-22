const header = document.getElementById('header');
const menuButton = document.getElementById('menuBtn');
const mobilePanel = document.getElementById('mobilePanel');
const mobileClose = document.getElementById('mobileClose');

window.addEventListener(
  'scroll',
  () => header?.classList.toggle('shrink', window.scrollY > 30),
  { passive: true },
);

function closeMobileMenu() {
  mobilePanel?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}

menuButton?.addEventListener('click', () => {
  mobilePanel?.classList.add('open');
  menuButton.setAttribute('aria-expanded', 'true');
  mobileClose?.focus();
});

mobileClose?.addEventListener('click', () => {
  closeMobileMenu();
  menuButton?.focus();
});

mobilePanel?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMobileMenu);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mobilePanel?.classList.contains('open')) {
    closeMobileMenu();
    menuButton?.focus();
  }
});

const gallery = document.querySelector('.hero-gallery');
const galleryImages = gallery ? [...gallery.querySelectorAll('.gallery-frame img')] : [];
const galleryIndex = document.getElementById('galleryIndex');
const galleryAnnouncement = document.getElementById('galleryAnnouncement');
const galleryPhotos = [
  { src: '/images/IMG_2349.jpg', alt: "Handcrafted ribbon rose bouquet in Forever Florals' collection" },
  { src: '/images/IMG_2346.jpg', alt: 'A second handcrafted Forever Florals bouquet' },
  { src: '/images/IMG_2345.jpg', alt: 'A colorful ribbon rose bouquet' },
  { src: '/images/IMG_2351.jpg', alt: 'A gift-ready Forever Florals bouquet' },
  { src: '/images/IMG_2347.jpg', alt: 'A detailed view of ribbon roses' },
  { src: '/images/ChatGPT%20Image%20Oct%204,%202026,%2010_11_12%20PM.jpg', alt: 'A special Forever Florals arrangement' },
  { src: '/images/IMG_2350.jpg', alt: 'Another bouquet from the Forever Florals collection' },
];
if (gallery && galleryImages.length > 0) {
  let activeIndex = 0;
  let activeImageIndex = 0;
  let timer;
  let showRequest = 0;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const galleryCount = document.getElementById('galleryCount');
  if (galleryCount) galleryCount.textContent = String(galleryPhotos.length).padStart(2, '0');

  async function showSlide(index) {
    const nextIndex = (index + galleryPhotos.length) % galleryPhotos.length;
    const request = ++showRequest;
    const nextImageIndex = (activeImageIndex + 1) % galleryImages.length;
    const image = galleryImages[nextImageIndex];
    image.src = galleryPhotos[nextIndex].src;

    try {
      await image.decode();
    } catch (error) {
      console.error(`Unable to load gallery image: ${image.currentSrc || image.src}`, error);
      if (galleryAnnouncement) galleryAnnouncement.textContent = 'A gallery image could not be loaded.';
      return;
    }

    if (request !== showRequest) return;
    galleryImages[activeImageIndex].classList.remove('active');
    image.classList.add('active');
    activeImageIndex = nextImageIndex;
    activeIndex = nextIndex;
    image.alt = galleryPhotos[activeIndex].alt;

    if (galleryIndex) galleryIndex.textContent = String(activeIndex + 1).padStart(2, '0');
    if (galleryAnnouncement) galleryAnnouncement.textContent = `Bouquet ${activeIndex + 1} of ${galleryPhotos.length}`;
  }

  function stopSlideshow() {
    window.clearInterval(timer);
  }

  function startSlideshow() {
    stopSlideshow();
    if (
      prefersReducedMotion.matches ||
      document.hidden ||
      gallery.matches(':hover') ||
      gallery.contains(document.activeElement)
    ) {
      return;
    }
    timer = window.setInterval(() => void showSlide(activeIndex + 1), 5000);
  }

  document.getElementById('galleryPrevious')?.addEventListener('click', () => {
    void showSlide(activeIndex - 1);
  });
  document.getElementById('galleryNext')?.addEventListener('click', () => {
    void showSlide(activeIndex + 1);
  });
  gallery.addEventListener('mouseenter', stopSlideshow);
  gallery.addEventListener('mouseleave', startSlideshow);
  gallery.addEventListener('focusin', stopSlideshow);
  gallery.addEventListener('focusout', () => window.setTimeout(startSlideshow, 0));
  document.addEventListener('visibilitychange', startSlideshow);
  prefersReducedMotion.addEventListener('change', startSlideshow);
  startSlideshow();
}

const handcraftedSlideshow = document.querySelector('.handcrafted-slideshow');
const handcraftedImages = handcraftedSlideshow
  ? [...handcraftedSlideshow.querySelectorAll('img')]
  : [];
if (handcraftedSlideshow && handcraftedImages.length === 2) {
  const handcraftedPhotos = [
    { src: '/images/IMG_2349.jpg', alt: 'Handcrafted ribbon rose bouquet' },
    { src: '/images/IMG_2346.jpg', alt: 'A Forever Florals bouquet' },
    { src: '/images/IMG_2345.jpg', alt: 'A colorful ribbon rose bouquet' },
    { src: '/images/IMG_2351.jpg', alt: 'A gift-ready Forever Florals bouquet' },
    { src: '/images/IMG_2347.jpg', alt: 'A detailed view of ribbon roses' },
    { src: '/images/ChatGPT%20Image%20Oct%204,%202026,%2010_11_12%20PM.jpg', alt: 'A special Forever Florals arrangement' },
    { src: '/images/IMG_2350.jpg', alt: 'Another bouquet from the Forever Florals collection' },
    { src: '/images/IMG_3108.jpeg', alt: 'A Forever Florals bouquet' },
    { src: '/images/IMG_3110.jpeg', alt: 'A money bouquet from Forever Florals' },
    { src: '/images/pink-rose-bouquet-18.png', alt: 'Pink rose bouquet with floral decoration' },
  ];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;
  let activeImageIndex = 0;
  let timer;
  let isLoading = false;

  async function showHandcraftedSlide() {
    if (isLoading) return;
    isLoading = true;
    const nextIndex = (activeIndex + 1) % handcraftedPhotos.length;
    const nextImageIndex = (activeImageIndex + 1) % handcraftedImages.length;
    const image = handcraftedImages[nextImageIndex];
    image.src = handcraftedPhotos[nextIndex].src;
    image.alt = handcraftedPhotos[nextIndex].alt;

    try {
      await image.decode();
    } catch (error) {
      console.error(`Unable to load bouquet image: ${image.currentSrc || image.src}`, error);
      isLoading = false;
      return;
    }

    handcraftedImages[activeImageIndex].classList.remove('active');
    handcraftedImages[activeImageIndex].setAttribute('aria-hidden', 'true');
    image.classList.add('active');
    image.removeAttribute('aria-hidden');
    activeImageIndex = nextImageIndex;
    activeIndex = nextIndex;
    isLoading = false;
  }

  function stopHandcraftedSlideshow() {
    window.clearInterval(timer);
  }

  function startHandcraftedSlideshow() {
    stopHandcraftedSlideshow();
    if (prefersReducedMotion.matches || document.hidden) return;
    timer = window.setInterval(() => void showHandcraftedSlide(), 4500);
  }

  document.addEventListener('visibilitychange', startHandcraftedSlideshow);
  prefersReducedMotion.addEventListener('change', startHandcraftedSlideshow);
  startHandcraftedSlideshow();
}

const productIds = [
  '9-ct',
  '15-ct',
  '24-ct',
  '36-ct',
  '50-ct',
  'money-bouquet',
  'special-request',
];
document.querySelectorAll('[data-order-products] > .card').forEach((card, index) => {
  const productId = productIds[index];
  if (!productId) return;
  const productName = card.querySelector('.count')?.textContent?.trim() || 'bouquet';
  const cardAction = card.querySelector('.view');
  const isCustomProduct = productId === 'money-bouquet' || productId === 'special-request';
  if (cardAction) cardAction.textContent = isCustomProduct ? 'Start order' : 'Add to cart';
  const link = document.createElement('a');
  link.className = 'card-order-link';
  link.href = `/order.html?product=${encodeURIComponent(productId)}`;
  link.setAttribute('aria-label', `${isCustomProduct ? 'Start an order for' : 'Add to cart'}: ${productName}`);
  card.append(link);
});

const topperCheckboxes = [...document.querySelectorAll('input[name="toppers"]')];
if (topperCheckboxes.length > 0) {
  const topperStatus = document.querySelector('[data-toppers-status]');
  try {
    const savedToppers = JSON.parse(localStorage.getItem('foreverflorals.order.toppers') || '[]');
    if (Array.isArray(savedToppers)) {
      topperCheckboxes.forEach((checkbox) => {
        checkbox.checked = savedToppers.includes(checkbox.value);
      });
    }
  } catch (error) {
    console.error('Unable to read saved bouquet customizations.', error);
    if (topperStatus) topperStatus.textContent = 'Saved selections could not be loaded. You can choose them again on the order page.';
  }

  topperCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      try {
        localStorage.setItem(
          'foreverflorals.order.toppers',
          JSON.stringify(topperCheckboxes.filter((option) => option.checked).map((option) => option.value)),
        );
        if (topperStatus) topperStatus.textContent = 'Your selections will be included when you continue to order.';
      } catch (error) {
        console.error('Unable to save bouquet customizations.', error);
        if (topperStatus) topperStatus.textContent = 'Selections could not be saved. Please choose them again on the order page.';
      }
    });
  });
}

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry, index) => {
      if (!entry.isIntersecting) return;
      window.setTimeout(() => entry.target.classList.add('in'), (index % 3) * 90);
      observer.unobserve(entry.target);
    });
  },
  { threshold: 0.15 },
);

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
