/**
 * Netsorna Product Page Engine (public/js/product.js)
 * 
 * Key Responsibilities:
 * 1. Query SKU from URL params and load metadata from `/api/products`.
 * 2. Handle direct binary file upload to Cloudflare R2 using presigned URLs (`/api/upload-url`).
 * 3. Enforce the Image Ownership & Copyright Modal state before unlocking actions.
 * 4. Manage dynamic UI state for Buttons A (Available) vs. Buttons B (Unavailable).
 * 5. Handle "Add to Buy List" and direct "Buy Now" checkout redirections.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentSku = urlParams.get('sku') || 'NET-CUST-PORTRAIT'; // Default fallback SKU

  // --- STATE MANAGEMENT ---
  const state = {
    product: null,
    uploadedFileKey: null,
    uploadedFileName: null,
    termsAccepted: false,
    quantity: 1,
    isAvailable: true // Controlled by backend availability check
  };

  const container = document.getElementById('productContainer');
  const modal = document.getElementById('customAgreementModal');
  const agreeCheckbox = document.getElementById('agreeTermsCheckbox');
  const confirmAgreementBtn = document.getElementById('confirmAgreementBtn');
  const closeAgreementBtn = document.getElementById('closeAgreementBtn');

  // --- 1. FETCH PRODUCT DATA & AVAILABILITY ---
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch catalogue data');
    
    const products = await res.json();
    state.product = products.find(p => p.sku === currentSku) || products[0];

    // Check store limits / availability toggle
    const statusRes = await fetch('/api/status').catch(() => null);
    if (statusRes && statusRes.ok) {
      const status = await statusRes.json();
      const isGlobalCap = status.globalCapReached || status.ordersThisWeek >= 40;
      const isSkuDisabled = status.disabledSkus && status.disabledSkus.includes(state.product.sku);
      
      if (isGlobalCap || isSkuDisabled) {
        state.isAvailable = false;
      }
    }

    renderProductPage();
  } catch (err) {
    console.error('Error initializing product page:', err);
    if (container) {
      container.innerHTML = `<div class="error-box"><p>Unable to load product details. Please return to the shop.</p></div>`;
    }
  }

  // --- 2. RENDER PRODUCT UI ---
  function renderProductPage() {
    if (!container || !state.product) return;

    const isCustom = state.product.type && state.product.type.startsWith('custom');
    const images = (state.product.images && state.product.images.length > 0) 
      ? state.product.images 
      : [state.product.image || '/images/placeholder.jpg'];

    const heroImage = images[0];

    container.innerHTML = `
      <div class="product-gallery">
        <div class="main-image-wrapper">
          <img id="mainProductImg" src="${heroImage}" alt="${state.product.title}" />
          ${images.length > 1 ? `<span class="image-counter-badge" id="imageCounter">1 / ${images.length}</span>` : ''}
        </div>
        ${images.length > 1 ? `
          <div class="thumbnail-row">
            ${images.map((img, idx) => `
              <img src="${img}" class="thumb-img ${idx === 0 ? 'active' : ''}" data-index="${idx}" alt="Thumbnail ${idx + 1}" />
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="product-details-box">
        <h1 class="product-header-title">${state.product.title}</h1>
        <div class="product-price-tag">R ${Number(state.product.price).toLocaleString()}</div>
        <p class="product-description">${state.product.description || 'Handcrafted bespoke artwork made with linear relief precision.'}</p>

        <!-- 1.3 Upload Selector (Rendered for custom items) -->
        ${isCustom ? `
          <div class="custom-upload-section">
            <label style="font-size:0.85rem; font-weight:600; margin-bottom:6px; display:block;">Reference Photo Upload</label>
            <div class="upload-zone" id="uploadDropzone">
              <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p><strong>Click to upload</strong> or drag & drop image</p>
              <span style="font-size:0.75rem; color:var(--text-muted);">JPG, PNG or WEBP up to 10MB</span>
            </div>
            <input type="file" id="fileInput" accept="image/*" style="display: none;" />
            <div id="filePreviewStrip" class="file-preview-strip" style="display: none;"></div>
          </div>
        ` : ''}

        <!-- Quantity Selector -->
        <div class="quantity-selector">
          <button type="button" class="qty-btn" id="qtyMinus">-</button>
          <input type="text" class="qty-input" id="qtyValue" value="1" readonly />
          <button type="button" class="qty-btn" id="qtyPlus">+</button>
        </div>

        <!-- 1.4 Image Ownership Widget / Gated Action Controls -->
        <div class="product-action-wrapper" id="actionControlsArea">
          ${renderActionButtons()}
        </div>
      </div>
    `;

    bindInteractiveEvents(isCustom);
  }

  // --- 3. DYNAMIC BUTTONS (A vs B) RENDERER ---
  function renderActionButtons() {
    const isCustom = state.product.type && state.product.type.startsWith('custom');
    
    // Gating check: Custom items require file upload + terms agreement
    const isLocked = isCustom && (!state.uploadedFileKey || !state.termsAccepted);

    if (state.isAvailable) {
      // 1.1 Buttons A (Available State)
      return `
        <div class="buttons-group-a" style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
          <button type="button" class="btn btn-solid btn-lg" id="btnBuyNow" ${isLocked ? 'disabled' : ''}>
            ${isLocked ? 'Upload Reference Image to Unlock' : '4. Buy Now'}
          </button>
          <button type="button" class="btn btn-outline" id="btnAddBuyList" ${isLocked ? 'disabled' : ''}>
            1.1.1 Add To Buy List
          </button>
        </div>
      `;
    } else {
      // 1.2 Buttons B (Unavailable State)
      return `
        <div class="buttons-group-b" style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
          <button type="button" class="btn btn-subtle btn-lg" id="btnGetNotified">
            1.2.1 Get Notified
          </button>
          <button type="button" class="btn btn-outline" id="btnAddReminder">
            1.2.2 Add To Reminder List
          </button>
        </div>
      `;
    }
  }

  // --- 4. EVENT BINDINGS & BINARY UPLOAD EXECUTION ---
  function bindInteractiveEvents(isCustom) {
    // Gallery Thumbnails
    const thumbs = container.querySelectorAll('.thumb-img');
    const mainImg = container.getElementById('mainProductImg');
    const counter = container.getElementById('imageCounter');

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        if (mainImg) mainImg.src = thumb.src;
        if (counter) counter.textContent = `${Number(thumb.dataset.index) + 1} / ${thumbs.length}`;
      });
    });

    // Quantity controls
    const qtyMinus = container.querySelector('#qtyMinus');
    const qtyPlus = container.querySelector('#qtyPlus');
    const qtyInput = container.querySelector('#qtyValue');

    if (qtyMinus && qtyPlus && qtyInput) {
      qtyMinus.addEventListener('click', () => {
        if (state.quantity > 1) {
          state.quantity--;
          qtyInput.value = state.quantity;
        }
      });
      qtyPlus.addEventListener('click', () => {
        state.quantity++;
        qtyInput.value = state.quantity;
      });
    }

    // Custom File Dropzone & Binary Upload
    if (isCustom) {
      const dropzone = container.querySelector('#uploadDropzone');
      const fileInput = container.querySelector('#fileInput');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
          }
        });

        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.style.background = '#ebe7df';
        });

        dropzone.addEventListener('dragleave', () => {
          dropzone.style.background = '';
        });

        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.style.background = '';
          if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        });
      }
    }

    bindActionButtons();
  }

  // --- 5. R2 BINARY UPLOAD PIPELINE ---
  async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    const previewStrip = container.querySelector('#filePreviewStrip');
    if (previewStrip) {
      previewStrip.style.display = 'flex';
      previewStrip.innerHTML = `<span>Uploading: <strong>${file.name}</strong>...</span>`;
    }

    try {
      // Step A: Request presigned R2 URL from Worker backend
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size
        })
      });

      if (!res.ok) throw new Error('Failed to generate upload authorization.');
      const { uploadUrl, fileKey } = await res.json();

      // Step B: Direct binary upload to R2 Bucket
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (!uploadRes.ok) throw new Error('Direct R2 file upload failed.');

      state.uploadedFileKey = fileKey;
      state.uploadedFileName = file.name;

      if (previewStrip) {
        previewStrip.innerHTML = `
          <span>Ready: <strong>${file.name}</strong></span>
          <button type="button" class="remove-file-btn" id="removeFileBtn">Remove</button>
        `;
        document.getElementById('removeFileBtn').addEventListener('click', resetFileUpload);
      }

      // Step C: Trigger 1.4 Copyright Ownership Modal
      openCopyrightModal();

    } catch (err) {
      console.error('Upload Error:', err);
      alert('Upload failed. Please check your network connection and try again.');
      resetFileUpload();
    }
  }

  function resetFileUpload() {
    state.uploadedFileKey = null;
    state.uploadedFileName = null;
    state.termsAccepted = false;
    if (agreeCheckbox) agreeCheckbox.checked = false;

    const previewStrip = container.querySelector('#filePreviewStrip');
    if (previewStrip) {
      previewStrip.style.display = 'none';
      previewStrip.innerHTML = '';
    }

    updateActionControls();
  }

  // --- 6. COPYRIGHT MODAL GATING LOGIC ---
  function openCopyrightModal() {
    if (modal) {
      if (agreeCheckbox) agreeCheckbox.checked = state.termsAccepted;
      if (confirmAgreementBtn) confirmAgreementBtn.disabled = !state.termsAccepted;
      modal.showModal();
    }
  }

  if (agreeCheckbox) {
    agreeCheckbox.addEventListener('change', (e) => {
      if (confirmAgreementBtn) confirmAgreementBtn.disabled = !e.target.checked;
    });
  }

  if (confirmAgreementBtn) {
    confirmAgreementBtn.addEventListener('click', () => {
      state.termsAccepted = true;
      modal.close();
      updateActionControls();
      if (typeof showToast === 'function') {
        showToast('Image uploaded & terms confirmed!');
      }
    });
  }

  if (closeAgreementBtn) {
    closeAgreementBtn.addEventListener('click', () => {
      modal.close();
      if (!state.termsAccepted) {
        resetFileUpload();
      }
    });
  }

  function updateActionControls() {
    const controlsArea = container.querySelector('#actionControlsArea');
    if (controlsArea) {
      controlsArea.innerHTML = renderActionButtons();
      bindActionButtons();
    }
  }

  // --- 7. ACTION BUTTON LISTENERS (1.1 & 1.2) ---
  function bindActionButtons() {
    // 1.1.1 Add to Buy List
    const btnAddBuyList = container.querySelector('#btnAddBuyList');
    if (btnAddBuyList) {
      btnAddBuyList.addEventListener('click', () => {
        addToBuyList();
        if (typeof showToast === 'function') {
          showToast('Added to your Buy List!');
        }
      });
    }

    // 4. Buy Now
    const btnBuyNow = container.querySelector('#btnBuyNow');
    if (btnBuyNow) {
      btnBuyNow.addEventListener('click', () => {
        addToBuyList();
        // Redirect directly to 4.1 Customer Details capture page
        window.location.href = `/customer-details.html?sku=${state.product.sku}&direct=true`;
      });
    }

    // 1.2.1 Get Notified (When unavailable)
    const btnGetNotified = container.querySelector('#btnGetNotified');
    if (btnGetNotified) {
      btnGetNotified.addEventListener('click', () => {
        window.location.href = `/customer-details.html?sku=${state.product.sku}&type=notify`;
      });
    }

    // 1.2.2 Add to Reminder List (When unavailable)
    const btnAddReminder = container.querySelector('#btnAddReminder');
    if (btnAddReminder) {
      btnAddReminder.addEventListener('click', () => {
        window.location.href = `/customer-details.html?sku=${state.product.sku}&type=reminder`;
      });
    }
  }

  // --- 8. LOCAL BUY LIST STORAGE MANAGER ---
  function addToBuyList() {
    try {
      const existingList = JSON.parse(localStorage.getItem('netsorna_buylist') || '[]');
      
      const itemPayload = {
        sku: state.product.sku,
        title: state.product.title,
        price: state.product.price,
        quantity: state.quantity,
        uploadedFileKey: state.uploadedFileKey || null,
        uploadedFileName: state.uploadedFileName || null,
        addedAt: new Date().toISOString()
      };

      const existingIndex = existingList.findIndex(item => item.sku === itemPayload.sku);
      if (existingIndex > -1) {
        existingList[existingIndex] = itemPayload;
      } else {
        existingList.push(itemPayload);
      }

      localStorage.setItem('netsorna_buylist', JSON.stringify(existingList));

      // Trigger global header badge counter update if main.js is loaded
      if (typeof updateCartBadge === 'function') {
        updateCartBadge();
      }
    } catch (err) {
      console.error('Failed to write to local Buy List:', err);
    }
  }
});
