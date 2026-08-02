/**
 * public/js/details-form.js
 * Captures customer information, validates inputs, posts payload to Cloudflare API,
 * and triggers serverless HTTP 302 payment redirection.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('customerDetailsForm');
  const submitBtn = document.getElementById('submitDetailsBtn');

  if (!form) return;

  const urlParams = new URLSearchParams(window.location.search);
  const targetSku = urlParams.get('sku') || 'NET-CUST-PORTRAIT';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const shippingAddress = document.getElementById('shippingAddress')?.value.trim();

    if (!fullName || !email || !phone || !shippingAddress) {
      alert('Please fill out all required fields.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing & Reserving Slot...';
    }

    // Retrieve uploaded file reference key if saved in local state
    let uploadedFileKey = null;
    try {
      const list = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');
      const match = list.find(item => item.sku === targetSku);
      if (match && match.uploadedFileKey) {
        uploadedFileKey = match.uploadedFileKey;
      }
    } catch (err) {
      console.error('Error reading buy list uploaded key:', err);
    }

    try {
      // 1. Post details to Cloudflare Worker customer details pipeline
      const res = await fetch('/api/customer-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          shippingAddress,
          sku: targetSku,
          uploadedFileKey,
          type: 'direct-purchase'
        })
      });

      if (!res.ok) throw new Error('Failed to save customer order details.');

      const data = await res.json();

      // 2. Redirect to Yoco Serverless Payment Router (/pay/[sku])
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = `/pay/${targetSku}`;
      }

    } catch (err) {
      console.error('Error submitting customer details:', err);
      alert('There was a problem preparing your checkout session. Please try again.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proceed to Secure Checkout →';
      }
    }
  });
});
