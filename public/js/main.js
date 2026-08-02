/**
 * public/js/main.js
 * Global Application Execution: Handles GA4 initialization, 
 * expanding header Buy List drawer widget, cart badges, toast notifications,
 * and dynamic homepage content loading.
 */

document.addEventListener('DOMContentLoaded', () => {
  initGoogleAnalytics();
  initHeaderDrawer();
  updateCartBadge();
  initHomePageContent(); // Load dynamic CMS content for the homepage if present
});

// --- 1. GA4 TRACKING INITIALIZATION ---
function initGoogleAnalytics() {
  const gaId = 'G-XXXXXXXXXX'; // Replace with GA4 Measurement ID
  if (!gaId || gaId.includes('XXXXX')) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', gaId);
}

// --- 2. HEADER BUY LIST DRAWER WIDGET ---
function initHeaderDrawer() {
  const menuToggle = document.getElementById('menuToggle');
  const navbar = document.getElementById('navbar');
  const buyListHeaderBtn = document.getElementById('buyListHeaderBtn');

  if (menuToggle && navbar) {
    menuToggle.addEventListener('click', () => {
      const isExpanded = navbar.classList.contains('expanded');
      if (isExpanded) {
        navbar.classList.remove('expanded');
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      } else {
        navbar.classList.add('expanded');
        menuToggle.classList.add('active');
        menuToggle.setAttribute('aria-expanded', 'true');
        renderHeaderWidgetPreview();
      }
    });
  }

  if (buyListHeaderBtn) {
    buyListHeaderBtn.addEventListener('click', () => {
      window.location.href = '/buy-list.html';
    });
  }

  // Handle scroll backdrop effect
  window.addEventListener('scroll', () => {
    if (navbar) {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  });
}

// Render dynamic items inside the header Buy List preview widget
function renderHeaderWidgetPreview() {
  const previewBox = document.getElementById('widgetItemsPreview');
  if (!previewBox) return;

  try {
    const list = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');
    if (list.length === 0) {
      previewBox.innerHTML = `<p class="empty-msg" style="font-size:0.8rem; color:var(--text-muted); padding:8px 0;">Your Buy List is currently empty.</p>`;
      return;
    }

    previewBox.innerHTML = list.map(item => `
      <div class="drawer-item-row" style="display:flex; justify-content:space-between; font-size:0.82rem; padding:4px 0;">
        <span class="drawer-item-title" style="font-weight:600;">${item.title}</span>
        <span class="drawer-item-price" style="color:var(--text-muted);">R ${Number(item.price).toLocaleString()}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error rendering drawer preview:', e);
  }
}

// --- 3. DYNAMIC HOMEPAGE CMS LOADER ---
async function initHomePageContent() {
  const heroTitle = document.getElementById('heroTitle');
  if (!heroTitle) return; // Exit if we are not on the homepage

  try {
    const response = await fetch('/content/pages/home.json');
    if (!response.ok) return;
    const data = await response.json();

    // Populate Hero Section
    if (data.hero) {
      if (heroTitle && data.hero.title) heroTitle.textContent = data.hero.title;
      const heroImage = document.getElementById('heroImage');
      if (heroImage && data.hero.image) heroImage.src = data.hero.image;
    }

    // Populate Studio Bio Section
    if (data.bio) {
      const bioText = document.getElementById('bioText');
      if (bioText && data.bio.heading) bioText.textContent = data.bio.heading;
      const bioMediaImage = document.getElementById('bioMediaImage');
      if (bioMediaImage && data.bio.mediaImage) bioMediaImage.src = data.bio.mediaImage;
    }

    // Populate Feature Showcase Section
    if (data.feature) {
      const featureTitle = document.getElementById('featureTitle');
      if (featureTitle && data.feature.title) featureTitle.textContent = data.feature.title;
      const featureImage = document.getElementById('featureImage');
      if (featureImage && data.feature.image) featureImage.src = data.feature.image;
      const featureDescription = document.getElementById('featureDescription');
      if (featureDescription && data.feature.description) featureDescription.textContent = data.feature.description;
      const featureLink = document.getElementById('featureLink');
      if (featureLink) {
        if (data.feature.linkText) featureLink.textContent = data.feature.linkText;
        if (data.feature.linkUrl) featureLink.href = data.feature.linkUrl;
      }
    }
  } catch (err) {
    console.warn('CMS content sync offline or missing, falling back to static markup.', err);
  }
}

// --- 4. BADGE COUNTER UPDATER ---
function updateCartBadge() {
  const badge = document.getElementById('buyListBadge') || document.getElementById('cartBadge');
  if (!badge) return;

  try {
    const list = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');
    badge.textContent = list.length.toString();
  } catch (e) {
    badge.textContent = '0';
  }
}

// --- 5. TOAST NOTIFICATION HELPER ---
function showToast(message) {
  let toastBox = document.getElementById('netsorna-toast');
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.id = 'netsorna-toast';
    document.body.appendChild(toastBox);
  }

  toastBox.textContent = message;
  toastBox.classList.add('show');

  setTimeout(() => {
    toastBox.classList.remove('show');
  }, 3000);
}
