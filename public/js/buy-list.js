/**
 * public/js/buy-list.js
 * Buy List storage manager & WhatsApp receipt builder.
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('buyListContainer');
  const summaryBox = document.getElementById('buyListSummary');
  const totalDisplay = document.getElementById('buyListTotal');
  const btnMessageToBuy = document.getElementById('btnMessageToBuy');

  const WHATSAPP_PHONE = '27820000000'; // Replace with your WhatsApp Business Number (e.g. 27XXXXXXXXX)

  function loadBuyList() {
    if (!container) return;

    try {
      const items = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');

      if (items.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding: 40px 16px; background: var(--accent-light); border-radius: 6px;">
            <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">Your Buy List is currently empty.</p>
            <a href="/shop.html" class="btn btn-solid">Browse Artworks</a>
          </div>
        `;
        if (summaryBox) summaryBox.style.display = 'none';
        return;
      }

      let grandTotal = 0;

      container.innerHTML = items.map((item, index) => {
        const itemTotal = Number(item.price) * (item.quantity || 1);
        grandTotal += itemTotal;

        return `
          <div class="buy-list-item-card" style="display:flex; justify-content:space-between; align-items:center; padding: 16px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 12px; background:#fff;">
            <div>
              <h3 style="font-size:0.95rem; font-weight:600;">${item.title}</h3>
              <p style="font-size:0.8rem; color:var(--text-muted);">SKU: ${item.sku} | Qty: ${item.quantity || 1}</p>
              ${item.uploadedFileName ? `<span style="font-size:0.75rem; color:#2e7d32;">📎 Reference: ${item.uploadedFileName}</span>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:600; font-size:0.95rem;">R ${itemTotal.toLocaleString()}</div>
              <button type="button" class="btn-remove-item" data-index="${index}" style="background:none; border:none; color:red; font-size:0.75rem; cursor:pointer; margin-top:4px;">Remove</button>
            </div>
          </div>
        `;
      }).join('');

      if (totalDisplay) totalDisplay.textContent = `R ${grandTotal.toLocaleString()}`;
      if (summaryBox) summaryBox.style.display = 'block';

      // Bind remove buttons
      document.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index, 10);
          removeItem(idx);
        });
      });

      // Bind WhatsApp message builder button
      if (btnMessageToBuy) {
        btnMessageToBuy.onclick = () => generateWhatsAppMessage(items, grandTotal);
      }

    } catch (err) {
      console.error('Failed to load buy list:', err);
    }
  }

  function removeItem(index) {
    try {
      const items = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');
      items.splice(index, 1);
      localStorage.setItem('netsorna_buylist', JSON.stringify(items));
      loadBuyList();
      if (typeof updateCartBadge === 'function') updateCartBadge();
    } catch (err) {
      console.error('Error removing item:', err);
    }
  }

  // Constructs pre-formatted text payload for WhatsApp consultation/purchase
  function generateWhatsAppMessage(items, total) {
    let message = `*NETSORNA STUDIO - BUY LIST ORDER INQUIRY*\n`;
    message += `===================================\n\n`;

    items.forEach((item, i) => {
      message += `${i + 1}. *${item.title}*\n`;
      message += `   • SKU: ${item.sku}\n`;
      message += `   • Qty: ${item.quantity || 1}\n`;
      message += `   • Price: R ${Number(item.price).toLocaleString()}\n`;
      if (item.uploadedFileKey) {
        message += `   • Upload Ref: https://uploads.netsorna.website/${item.uploadedFileKey}\n`;
      }
      message += `\n`;
    });

    message += `===================================\n`;
    message += `*Estimated Total: R ${total.toLocaleString()}*\n\n`;
    message += `Hello Netsorna Team, I would like to confirm slot availability and payment details for these items.`;

    const encodedText = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodedText}`, '_blank');
  }

  loadBuyList();
});
