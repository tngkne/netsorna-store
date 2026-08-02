
        /**
 * public/js/main.js
 * Global Application Execution: Handles GA4 initialization, 
 * expanding header Buy List drawer widget, cart badges, and toast notifications.
 */

document.addEventListener('DOMContentLoaded', () => {
  initGoogleAnalytics();
  initHeaderDrawer();
  updateCartBadge();
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

// --- 3. BADGE COUNTER UPDATER ---
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

// --- 4. TOAST NOTIFICATION HELPER ---
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
