/**
 * functions/pay/[sku].js
 * Serverless HTTP 302 Redirect Handler
 * Maps SKU parameters directly to dynamic or static Yoco Hosted Payment URLs.
 */

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const sku = params.sku;

  // 1. Fetch query parameters (pass-through for order ID / metadata tracking)
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId') || '';

  // 2. Static SKU-to-Yoco Hosted Payment Link Map
  // Replace these URLs with your live Yoco Payment Links from your Yoco Dashboard
  const yocoLinkMap = {
    'NET-CUST-PORTRAIT': 'https://pay.yoco.com/netsorna-portrait',
    'NET-CUST-OBJECT': 'https://pay.yoco.com/netsorna-object',
    'NET-READY-ITEM': 'https://pay.yoco.com/netsorna-readymade',
    'DEFAULT': 'https://pay.yoco.com/netsorna-studio'
  };

  // Determine destination URL
  let destinationUrl = yocoLinkMap[sku] || yocoLinkMap['DEFAULT'];

  // Append order tracking ref if provided
  if (orderId) {
    const separator = destinationUrl.includes('?') ? '&' : '?';
    destinationUrl = `${destinationUrl}${separator}orderId=${encodeURIComponent(orderId)}`;
  }

  // 3. Return HTTP 302 Direct Redirect Response
  return new Response(null, {
    status: 302,
    headers: {
      'Location': destinationUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
