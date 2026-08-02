/**
 * functions/api/lib/google-sheets.js
 * Appends customer orders and calculated delivery ranges (+14 / +20 days) to Google Sheets.
 * Context: Cloudflare Workers / Edge Runtime
 */

import { getGoogleAccessToken } from './google-auth.js';

/**
 * Calculates delivery date range offsets from a base date.
 * @param {Date} baseDate - Order creation date
 * @param {number} minDays - Minimum lead time (e.g. 14 days)
 * @param {number} maxDays - Maximum lead time (e.g. 20 days)
 * @returns {Object} Calculated dates and formatted ISO/human strings
 */
export function calculateDeliveryRange(baseDate = new Date(), minDays = 14, maxDays = 20) {
  const minDeliveryDate = new Date(baseDate);
  minDeliveryDate.setDate(minDeliveryDate.getDate() + minDays);

  const maxDeliveryDate = new Date(baseDate);
  maxDeliveryDate.setDate(maxDeliveryDate.getDate() + maxDays);

  // ISO Format YYYY-MM-DD
  const formatISO = (date) => date.toISOString().split('T')[0];

  // Human Readable Format e.g., "16 Aug 2026"
  const formatHuman = (date) =>
    date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

  return {
    orderDateISO: formatISO(baseDate),
    minDeliveryISO: formatISO(minDeliveryDate),
    maxDeliveryISO: formatISO(maxDeliveryDate),
    deliveryRangeFormatted: `${formatHuman(minDeliveryDate)} - ${formatHuman(maxDeliveryDate)}`
  };
}

/**
 * Appends a customer order record to Google Sheets via REST API
 * @param {Object} params
 * @param {Object} params.env - Cloudflare Workers environment bindings (secrets)
 * @param {Object} params.orderData - Order payload from customer-details.js
 * @returns {Promise<Object>} API Response
 */
export async function appendOrderToGoogleSheet({ env, orderData }) {
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const tabName = env.GOOGLE_SHEETS_TAB_NAME || 'Orders';

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error('Google Sheets Error: Missing required credentials or GOOGLE_SPREADSHEET_ID.');
  }

  // 1. Calculate +14 and +20 Day Lead Time Range
  const now = new Date(orderData.timestamp || Date.now());
  const delivery = calculateDeliveryRange(now, 14, 20);

  // 2. Fetch OAuth2 Bearer Access Token from google-auth.js
  const accessToken = await getGoogleAccessToken({
    clientEmail,
    privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  // 3. Map Order Payload into Row Cells
  // Order: Timestamp | Order ID | SKU | Customer Name | Email | Phone | Shipping Address | Reference Image | Min Delivery Date | Max Delivery Date | Delivery Status
  const rowValues = [
    now.toISOString(),
    orderData.orderId || `ORD-${Date.now()}`,
    orderData.sku || 'NET-CUSTOM',
    orderData.fullName || '',
    orderData.email || '',
    orderData.phone || '',
    orderData.shippingAddress || '',
    orderData.uploadedFileKey ? `https://uploads.netsorna.website/${orderData.uploadedFileKey}` : 'N/A',
    delivery.minDeliveryISO,
    delivery.maxDeliveryISO,
    delivery.deliveryRangeFormatted,
    orderData.status || 'Pending Payment'
  ];

  // 4. Append Row to Google Sheets API v4
  const range = `${tabName}!A:L`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: range,
      majorDimension: 'ROWS',
      values: [rowValues]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets Append Failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return {
    success: true,
    updatedRange: result.updates?.updatedRange,
    deliveryRange: delivery
  };
}
