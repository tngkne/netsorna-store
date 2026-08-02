/**
 * Netsorna Product Page Engine (public/js/product.js)
 * Handles SKU fetching, gallery swapping, R2 direct upload, ownership gating,
 * dynamic Buttons A vs B rendering, and Buy List storage integration.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Extract SKU from URL params (?sku=NET-PRT-001)
  const urlParams = new URLSearchParams(window.location.search);
  const currentSku = urlParams.get('sku');

  // Page State
  const state = {
    product: null,
    uploadedFileKey: null,
    uploadedFileName: null,
    termsAccepted: false,
    quantity: 1,
    isAvailable: true
  };

  const container = document.getElementById('productContainer');
  const modal = document.getElementById('customAgreementModal');
  const agreeCheckbox = document.getElementById('agreeTermsCheckbox');
  const confirmAgreementBtn = document.getElementById('confirmAgreementBtn');
  const closeAgreementBtn = document.getElementById('closeAgreementBtn');

  if (!currentSku) {
    show404('No product SKU provided.');
    return;
  }

  // --- 1. FETCH PRODUCT DATA & CHECK AVAILABILITY ---
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch catalogue data');
    
    const products = await res.json();
    state.product = products.find(p => p.sku === currentSku);

    if (!state.product) {
      show404(`Product with SKU "${currentSku}" was not found.`);
      return;
    }

    // Check store status & capacity limits
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
    show404('Unable to load product details at this time.');
  }

  // Helper: Display 404 error
  function show404(msg) {
    if (!container) return;
    // Remove skeleton class to restore normal container padding
    container.classList.remove('product-skeleton');
    container.innerHTML = `
      <div style="text-align:center; padding: 60px 20px; width:100%;">
        <h1 style="font-size: 2rem; margin-bottom: 12px;">Product Not Found</h1>
        <p style="color: var(--text-muted); margin-bottom: 24px;">${msg}</p>
        <a href="/shop.html" class="btn btn-solid">← Back to Shop</a>
      </div>
    `;
  }

  // --- 2. RENDER PRODUCT PAGE HTML ---
  function renderProductPage() {
    if (!container || !state.product) return;

    // Clear skeleton loader state
    container.classList.remove('product-skeleton');

    const isCustom = state.product.customType && state.product.customType.startsWith('custom');
    const isHighValue = state.product.inquiryOnly || state.product.price >= 15000;
    
    // Build image paths relative to product folder
    const folderPath = `/content/products/${getFolderFromSku(state.product.sku)}`;
    const images = (state.product.images && state.product.images.length > 0)
      ? state.product.images.map(img => img.startsWith('/') ? img : `${folderPath}/${img}`)
      : ['/images/placeholder.jpg'];

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
        
        ${state.product.specs ? `
          <div class="product-specs" style="font-size: 0.82rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 12px;">
            <strong>Specifications:</strong> ${state.product.specs}
          </div>
        ` : ''}

        <!-- Custom Upload Dropzone -->
        ${isCustom ? `
          <div class="custom-upload-section" style="margin-top: 10px;">
            <label style="font-size:0.85rem; font-weight:600; margin-bottom:6px; display:block;">Reference Photo Upload (Required)</label>
            <div class="upload-zone" id="uploadDropzone">
              <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p><strong>Click to upload</strong> or drag & drop image</p>
              <span style="font-size:0.75rem; color:var(--text-muted);">JPG, PNG, WEBP or HEIC up to 10MB</span>
            </div>
            <input type="file" id="fileInput" accept="image/*" style="display: none;" />
            <div id="filePreviewStrip" class="file-preview-strip" style="display: none; margin-top: 8px;"></div>
          </div>
        ` : ''}

        <!-- Quantity Selector (Hidden for inquiry-only items) -->
        ${!isHighValue ? `
          <div class="quantity-selector" style="margin-top: 10px;">
            <button type="button" class="qty-btn" id="qtyMinus">-</button>
            <input type="text" class="qty-input" id="qtyValue" value="1" readonly />
            <button type="button" class="qty-btn" id="qtyPlus">+</button>
          </div>
        ` : ''}

        <!-- Dynamic Action Buttons -->
        <div class="product-action-wrapper" id="actionControlsArea" style="margin-top: 12px;">
          ${renderActionButtons(isCustom, isHighValue)}
        </div>
      </div>
    `;

    bindInteractiveEvents(isCustom);
  }

  // Derive folder name based on SKU mapping
  function getFolderFromSku(sku) {
    const map = {
      'NET-PRT-001': 'custom-portrait',
      'NET-OBJ-002': 'custom-object',
      'NET-LUX-003': 'luxury-art-piece',
      'NET-RDY-004': 'ready-made-item'
    };
    return map[sku] || 'custom-portrait';
  }

  // --- 3. DYNAMIC BUTTONS (A vs B vs Inquiry) RENDERER ---
  function renderActionButtons(isCustom, isHighValue) {
    if (isHighValue) {
      return `
        <div class="buttons-group-inquiry" style="display:flex; flex-direction:column; gap:10px;">
          <a href="https://wa.me/27XXXXXXXXX?text=${encodeURIComponent('Hi Netsorna, I am interested in inquiring about ' + state.product.title + ' (' + state.product.sku + ')')}" target="_blank" class="btn btn-solid btn-lg" style="background:#25D366; color:#fff; border:none;">
            WhatsApp Private Consultation
          </a>
          <a href="/customer-details.html?sku=${state.product.sku}&type=inquiry" class="btn btn-outline btn-lg">
            Email Inquiry
          </a>
        </div>
      `;
    }

    // Custom items require file upload + copyright terms
    const isLocked = isCustom && (!state.uploadedFileKey || !state.termsAccepted);

    if (state.isAvailable) {
      // Buttons A (Available State)
      return `
        <div class="buttons-group-a" style="display:flex; flex-direction:column; gap:10px;">
          <button type="button" class="btn btn-solid btn-lg" id="btnBuyNow" ${isLocked ? 'disabled' : ''}>
            ${isLocked ? 'Upload Image & Confirm Terms to Unlock' : 'Buy Now'}
          </button>
          <button type="button" class="btn btn-outline btn-lg" id="btnAddBuyList" ${isLocked ? 'disabled' : ''}>
            Add to Buy List
          </button>
        </div>
      `;
    } else {
      // Buttons B (Unavailable State)
      return `
        <div class="buttons-group-b" style="display:flex; flex-direction:column; gap:10px;">
          <button type="button" class="btn btn-subtle btn-lg" id="btnGetNotified">
            Get Notified When Available
          </button>
          <button type="button" class="btn btn-outline btn-lg" id="btnAddReminder">
            Add to Reminder List
          </button>
        </div>
      `;
    }
  }

  // --- 4. EVENT BINDINGS & UPLOAD PIPELINE ---
  function bindInteractiveEvents(isCustom) {
    // Gallery Swap
    const thumbs = container.querySelectorAll('.thumb-img');
    const mainImg = container.querySelector('#mainProductImg');
    const counter = container.querySelector('#imageCounter');

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

    // Custom File Dropzone
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

  // --- 5. R2 UPLOAD EXECUTION ---
  async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, WEBP, or HEIC).');
      return;
    }

    const previewStrip = container.querySelector('#filePreviewStrip');
    if (previewStrip) {
      previewStrip.style.display = 'flex';
      previewStrip.innerHTML = `<span>Uploading: <strong>${file.name}</strong>...</span>`;
    }

    try {
      // Step 1: Request upload endpoint from Worker
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      });

      if (!res.ok) throw new Error('Failed to generate upload authorization.');
      const { fileKey, uploadEndpoint } = await res.json();

      // Step 2: Binary transfer to R2
      const uploadRes = await fetch(uploadEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (!uploadRes.ok) throw new Error('Direct R2 binary upload failed.');

      state.uploadedFileKey = fileKey;
      state.uploadedFileName = file.name;

      if (previewStrip) {
        previewStrip.innerHTML = `
          <span>Uploaded: <strong>${file.name}</strong></span>
          <button type="button" class="remove-file-btn" id="removeFileBtn">Remove</button>
        `;
        const removeBtn = document.getElementById('removeFileBtn');
        if (removeBtn) removeBtn.addEventListener('click', resetFileUpload);
      }

      // Step 3: Open Copyright Modal
      openCopyrightModal();

    } catch (err) {
      console.error('Upload Error:', err);
      alert('Upload failed. Please try again.');
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

  // --- 6. COPYRIGHT MODAL STATE ---
  function openCopyrightModal() {
    if (modal) {
      if (agreeCheckbox) agreeCheckbox.checked = state.termsAccepted;
      if (confirmAgreementBtn) confirmAgreementBtn.disabled = !state.termsAccepted;
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', 'true');
      }
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
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
      
      updateActionControls();
      if (typeof showToast === 'function') {
        showToast('Photo uploaded & terms confirmed!');
      }
    });
  }

  if (closeAgreementBtn) {
    closeAgreementBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
      
      if (!state.termsAccepted) {
        resetFileUpload();
      }
    });
  }

  function updateActionControls() {
    const controlsArea = container.querySelector('#actionControlsArea');
    if (controlsArea && state.product) {
      const isCustom = state.product.customType && state.product.customType.startsWith('custom');
      const isHighValue = state.product.inquiryOnly || state.product.price >= 15000;
      controlsArea.innerHTML = renderActionButtons(isCustom, isHighValue);
      bindActionButtons();
    }
  }

  // --- 7. ACTION BUTTON LISTENERS ---
  function bindActionButtons() {
    const btnAddBuyList = container.querySelector('#btnAddBuyList');
    if (btnAddBuyList) {
      btnAddBuyList.addEventListener('click', () => {
        addToBuyList();
        if (typeof showToast === 'function') {
          showToast('Added to your Buy List!');
        }
      });
    }

    const btnBuyNow = container.querySelector('#btnBuyNow');
    if (btnBuyNow) {
      btnBuyNow.addEventListener('click', () => {
        addToBuyList();
        window.location.href = `/customer-details.html?sku=${state.product.sku}&direct=true`;
      });
    }

    const btnGetNotified = container.querySelector('#btnGetNotified');
    if (btnGetNotified) {
      btnGetNotified.addEventListener('click', () => {
        window.location.href = `/customer-details.html?sku=${state.product.sku}&type=notify`;
      });
    }

    const btnAddReminder = container.querySelector('#btnAddReminder');
    if (btnAddReminder) {
      btnAddReminder.addEventListener('click', () => {
        window.location.href = `/customer-details.html?sku=${state.product.sku}&type=reminder`;
      });
    }
  }

  // --- 8. LOCAL STORAGE MANAGEMENT ---
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

      if (typeof updateCartBadge === 'function') {
        updateCartBadge();
      }
    } catch (err) {
      console.error('Failed to write to local Buy List:', err);
    }
  }
});
