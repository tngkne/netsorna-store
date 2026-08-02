/**
 * public/js/buy-list.js
 * Manages rendering of client Buy List, price total calculation,
 * item removal, and WhatsApp receipt message generation (2.1 Message to Buy).
 */

document.addEventListener('DOMContentLoaded', () => {
  renderBuyList();
});

function renderBuyList() {
  const container = document.getElementById('buyListContainer');
  const summaryBox = document.getElementById('buyListSummary');
  const totalElement = document.getElementById('buyListTotal');
  const btnWhatsApp = document.getElementById('btnMessageToBuy');

  if (!container) return;

  try {
    const list = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-buy-list" style="text-align: center; padding: 40px 16px;">
          <p style="color: var(--text-muted); margin-bottom: 16px;">Your Buy List is currently empty.</p>
          <a href="/shop.html" class="btn btn-solid">Explore Artworks</a>
        </div>
      `;
      if (summaryBox) summaryBox.style.display = 'none';
      return;
    }

    let total = 0;
    container.innerHTML = list.map((item, index) => {
      const itemTotal = Number(item.price) * Number(item.quantity || 1);
      total += itemTotal;

      return `
        <div class="buy-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--border-color);">
          <div class="item-details">
            <h3 style="font-size: 0.95rem; font-weight: 600;">${item.title}</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              Qty: ${item.quantity || 1} — R ${Number(item.price).toLocaleString()} each
            </span>
            ${item.uploadedFileName ? `
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Reference Photo: <strong>${item.uploadedFileName}</strong>
              </div>
            ` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 600; font-size: 0.95rem;">R ${itemTotal.toLocaleString()}</span>
            <button type="button" class="btn-remove" onclick="removeBuyListItem(${index})" style="background:none; border:none; color: var(--error-color, #d9381e); cursor:pointer; font-size: 1.2rem;">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    if (totalElement) totalElement.textContent = `R ${total.toLocaleString()}`;
    if (summaryBox) summaryBox.style.display = 'block';

    // Configure 2.1 WhatsApp Message To Buy Button
    if (btnWhatsApp) {
      btnWhatsApp.addEventListener('click', () => {
        const messageText = buildWhatsAppReceiptMessage(list, total);
        const waUrl = `https://wa.me/27XXXXXXXXX?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
      });
    }

  } catch (err) {
    console.error('Error rendering Buy List:', err);
    container.innerHTML = `<p class="error">Failed to load your saved list.</p>`;
  }
}

function removeBuyListItem(index) {
  try {
    const list = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');
    list.splice(index, 1);
    localStorage.setItem('netsorna_buylist', JSON.stringify(list));
    
    if (typeof updateCartBadge === 'function') {
      updateCartBadge();
    }
    
    renderBuyList();
  } catch (e) {
    console.error('Error removing item:', e);
  }
}

function buildWhatsAppReceiptMessage(list, total) {
  let text = `Hello Netsorna, I would like to place an order for the following selected artwork(s):\n\n`;
  list.forEach((item, i) => {
    text += `${i + 1}. *${item.title}* (SKU: ${item.sku})\n`;
    text += `   Quantity: ${item.quantity || 1}\n`;
    text += `   Price: R ${Number(item.price).toLocaleString()}\n`;
    if (item.uploadedFileKey) {
      text += `   Reference Photo Upload Key: ${item.uploadedFileKey}\n`;
    }
    text += `\n`;
  });
  text += `*Estimated Total: R ${total.toLocaleString()}*\n\n`;
  text += `Please confirm availability and direct payment options.`;
  return text;
}
