/**
 * functions/api/customer-details.js
 * Captures order/lead details before forwarding to Yoco or WhatsApp.
 * Writes to Cloudflare ORDERS_KV and appends row to Google Sheets CRM.
 */

import { appendOrderToGoogleSheet } from './lib/google-sheets.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const payload = await request.json();
    const { fullName, email, phone, shippingAddress, sku, uploadedFileKey, type } = payload;

    // Validation
    if (!fullName || !email || !phone) {
      return new Response(
        JSON.stringify({ error: 'Full name, email, and phone number are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const record = {
      orderId,
      timestamp,
      fullName,
      email,
      phone,
      shippingAddress: shippingAddress || 'N/A',
      sku: sku || 'NET-CUSTOM',
      uploadedFileKey: uploadedFileKey || null,
      type: type || 'direct-purchase',
      status: 'Captured - Redirecting to Payment'
    };

    // 1. Write to Cloudflare ORDERS_KV
    if (env.ORDERS_KV) {
      await env.ORDERS_KV.put(`order:${orderId}`, JSON.stringify(record));
      
      // Update store order counter for weekly capacity limits
      const currentCountStr = await env.ORDERS_KV.get('stats:weekly_orders_count');
      const currentCount = parseInt(currentCountStr || '0', 10);
      await env.ORDERS_KV.put('stats:weekly_orders_count', (currentCount + 1).toString());
    }

    // 2. Append order row & calculated +14 / +20 day delivery dates to Google Sheets
    let sheetsResult = null;
    try {
      sheetsResult = await appendOrderToGoogleSheet({ env, orderData: record });
    } catch (sheetErr) {
      console.error('Google Sheets logging failed:', sheetErr);
      // Non-blocking failure: proceed with checkout flow even if Google Sheet sync delays
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        redirectUrl: `/pay/${record.sku}?orderId=${orderId}`,
        deliveryRange: sheetsResult?.deliveryRange || null
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to record customer details.', details: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
