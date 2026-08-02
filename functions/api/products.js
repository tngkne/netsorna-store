/**
 * functions/api/products.js
 * Cloudflare Worker Endpoint: Serves JSON Catalogue from Cloudflare CONTENT_KV
 * Fallback to default catalog array if KV key is empty or unavailable.
 */

export async function onRequestGet(context) {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  try {
    // 1. Query Cloudflare CONTENT_KV for products catalog key
    let productsJson = null;
    if (env.CONTENT_KV) {
      productsJson = await env.CONTENT_KV.get('products_catalog');
    }

    // 2. If KV returns data, parse and respond
    if (productsJson) {
      return new Response(productsJson, {
        status: 200,
        headers: corsHeaders
      });
    }

    // 3. Fallback Catalogue Matrix (Ensures app works before KV sync)
    const fallbackProducts = [
      {
        sku: 'NET-CUST-PORTRAIT',
        title: 'Bespoke Custom Portrait Relief',
        price: 3450,
        type: 'custom-1',
        description: 'Handcrafted linear relief sculpture rendered from your reference photograph. Capped weekly slots.',
        image: '/images/products/portrait-hero.jpg',
        images: [
          '/images/products/portrait-hero.jpg',
          '/images/products/portrait-detail.jpg'
        ]
      },
      {
        sku: 'NET-CUST-OBJECT',
        title: 'Custom Architectural & Object Relief',
        price: 2850,
        type: 'custom-2',
        description: 'Minimalist relief capture for architectural structures, heirlooms, or organic forms.',
        image: '/images/products/object-hero.jpg',
        images: [
          '/images/products/object-hero.jpg'
        ]
      },
      {
        sku: 'NET-LUX-PIECE',
        title: 'Grand Relief Monument — Atelier Series',
        price: 18500,
        type: 'ready-made',
        inquiryOnly: true,
        description: 'Large-scale gallery original piece. Consult via WhatsApp for acquisition and transport details.',
        image: '/images/products/luxury-main.jpg',
        images: [
          '/images/products/luxury-main.jpg'
        ]
      },
      {
        sku: 'NET-READY-ITEM',
        title: 'Studio Sculptural Tile — Limited Edition',
        price: 1200,
        type: 'ready-made',
        description: 'Ready-to-ship hand-cast studio sculpture tile. Pre-packaged and dispatches within 48 hours.',
        image: '/images/products/ready-main.jpg',
        images: [
          '/images/products/ready-main.jpg'
        ]
      }
    ];

    return new Response(JSON.stringify(fallbackProducts), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch catalogue.', details: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
