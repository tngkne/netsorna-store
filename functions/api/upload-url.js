/**
 * functions/api/upload-url.js
 * Generates presigned URLs for direct customer binary file uploads to Cloudflare R2
 * Context: Cloudflare Workers (Module Worker syntax)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { fileName, fileType } = body;

    if (!fileName || !fileType) {
      return new Response(
        JSON.stringify({ error: 'fileName and fileType are required parameters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate file type (Images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Please upload a JPEG, PNG, WEBP, or HEIC image.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate unique storage key and file ID
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const objectKey = `custom-uploads/${timestamp}-${randomString}.${fileExtension}`;

    // Verify R2 Bucket Binding
    if (!env.CUSTOM_UPLOADS) {
      return new Response(
        JSON.stringify({ error: 'R2 bucket binding (CUSTOM_UPLOADS) is missing in server environment.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Return object key and target upload endpoint for direct R2 binary transfer
    return new Response(
      JSON.stringify({
        success: true,
        fileKey: objectKey,
        uploadEndpoint: `/api/upload-url?key=${encodeURIComponent(objectKey)}`,
        publicUrl: `https://uploads.netsorna.website/${objectKey}`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to generate upload target.', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// Direct R2 Binary Upload Direct Receiver (handles PUT/POST with raw file payload)
export async function onRequestPut(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing object key.' }), { status: 400 });
  }

  try {
    const blob = await request.arrayBuffer();
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

    // Store binary directly into R2 Bucket
    await env.CUSTOM_UPLOADS.put(key, blob, {
      httpMetadata: { contentType: contentType },
    });

    return new Response(
      JSON.stringify({ success: true, key: key }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to store image in R2.', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// Handle CORS Preflight Options Request
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
