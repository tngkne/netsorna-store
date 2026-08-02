/**
 * functions/api/whatsapp-lead.js
 * Tracks WhatsApp consultation inquiries and checks weekly lead limits (e.g., 10/week).
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
    const body = await request.json();
    const { sku, clientName } = body;

    let currentWaCount = 0;
    if (env.ORDERS_KV) {
      const countStr = await env.ORDERS_KV.get('stats:weekly_wa_count');
      currentWaCount = parseInt(countStr || '0', 10);

      // Weekly cap enforcement (e.g. max 10 WhatsApp leads per week)
      if (currentWaCount >= 10) {
        return new Response(
          JSON.stringify({ 
            capReached: true, 
            message: 'Consultation slots for this week are full. Please check back next Monday.' 
          }),
          { status: 429, headers: corsHeaders }
        );
      }

      // Log lead
      const leadId = `WA-${Date.now()}`;
      await env.ORDERS_KV.put(`lead:${leadId}`, JSON.stringify({
        sku,
        clientName: clientName || 'Anonymous',
        timestamp: new Date().toISOString()
      }));

      // Increment count
      await env.ORDERS_KV.put('stats:weekly_wa_count', (currentWaCount + 1).toString());
    }

    return new Response(
      JSON.stringify({ success: true, remainingSlots: 10 - (currentWaCount + 1) }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Error logging WhatsApp consultation lead.', details: err.message }),
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
