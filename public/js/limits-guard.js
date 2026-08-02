/**
 * public/js/limits-guard.js
 * Checks store limits & weekly order caps. Dynamically toggles
 * Buttons A (Available) vs Buttons B (Unavailable) across shop views.
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/status').catch(() => null);
    if (!res) return;

    if (res.ok) {
      const status = await res.json();
      
      const globalCapReached = status.globalCapReached || (status.ordersThisWeek >= 40);
      const disabledSkus = status.disabledSkus || [];

      if (globalCapReached) {
        applyGlobalCapState();
      } else if (disabledSkus.length > 0) {
        applyDisabledSkusState(disabledSkus);
      }
    }
  } catch (err) {
    console.warn('Limits guard check skipped:', err);
  }
});

function applyGlobalCapState() {
  const buttonsAGroup = document.getElementById('buttonsAGroup');
  const buttonsBGroup = document.getElementById('buttonsBGroup');

  if (buttonsAGroup && buttonsBGroup) {
    buttonsAGroup.style.display = 'none';
    buttonsBGroup.style.display = 'flex';
  }
}

function applyDisabledSkusState(disabledSkus) {
  const currentUrl = window.location.href;
  disabledSkus.forEach(sku => {
    if (currentUrl.includes(`sku=${sku}`)) {
      applyGlobalCapState();
    }
  });
}
