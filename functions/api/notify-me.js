/**
 * functions/api/notify-me.js
 * Captures "Get Notified" email submissions when capacity is capped.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { email, sku } = await request.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const timestamp = new Date().toISOString();
    const entryKey = `notify:${Date.now()}`;

    if (env.ORDERS_KV) {
      await env.ORDERS_KV.put(entryKey, JSON.stringify({ email, sku: sku || 'GENERAL', timestamp }));
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Your email has been added to our priority notification list.' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Server error processing request.', details: err.message }),
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
