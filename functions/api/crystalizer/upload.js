/**
 * Upload a generated Crystalizer image to Sanity.
 *
 * Endpoint: POST /api/crystalizer/upload
 * Body: multipart/form-data
 *   - file: image/png (required)
 *   - title: string (optional)
 *
 * Required env:
 *   - SANITY_API_WRITE_TOKEN
 */

const PROJECT_ID = 'nacdthna';
const DATASET = 'production';
const API_VERSION = '2024-07-02';

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    },
    ...init
  });
}

export async function onRequestPost(context) {
  const token = context?.env?.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_WRITE_TOKEN;
  if (!token) {
    return json(
      {
        ok: false,
        error: 'Missing SANITY_API_WRITE_TOKEN env var.'
      },
      { status: 500 }
    );
  }

  const ct = context.request.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('multipart/form-data')) {
    return json(
      {
        ok: false,
        error: 'Content-Type must be multipart/form-data'
      },
      { status: 400 }
    );
  }

  const form = await context.request.formData();
  const file = form.get('file');
  const title = String(form.get('title') || '').trim();
  const date = String(form.get('date') || '').trim();
  const externalId = String(form.get('id') || form.get('externalId') || '').trim();
  const name = String(form.get('name') || '').trim();
  const message = String(form.get('message') || '').trim();

  if (!(file instanceof File)) {
    return json(
      {
        ok: false,
        error: 'Missing form field: file'
      },
      { status: 400 }
    );
  }

  const filename = file.name || `crystalizer_${Date.now()}.png`;

  // 1) Upload asset
  const up = new FormData();
  up.append('file', file, filename);

  const assetUrl = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/assets/images/${DATASET}?filename=${encodeURIComponent(filename)}`;
  const assetRes = await fetch(assetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: up
  });

  const assetJson = await assetRes.json().catch(() => null);
  if (!assetRes.ok) {
    return json(
      {
        ok: false,
        step: 'uploadAsset',
        status: assetRes.status,
        response: assetJson
      },
      { status: 502 }
    );
  }

  const assetId = assetJson?.document?._id;
  const asset = assetJson?.document;
  if (!assetId) {
    return json(
      {
        ok: false,
        step: 'uploadAsset',
        error: 'Sanity asset upload succeeded but no document._id returned',
        response: assetJson
      },
      { status: 502 }
    );
  }

  // 2) Create a document that references the asset (so it shows up as an item in Studio)
  const doc = {
    _type: 'crystalizerImage',
    title: title || filename.replace(/\.(png|jpg|jpeg|webp)$/i, ''),
    date: date || undefined,
    externalId: externalId || undefined,
    name: name || undefined,
    message: message || undefined,
    createdAt: new Date().toISOString(),
    image: {
      _type: 'image',
      asset: { _type: 'reference', _ref: assetId }
    }
  };

  const mutateUrl = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`;
  const mutateRes = await fetch(mutateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ mutations: [{ create: doc }] })
  });

  const mutateJson = await mutateRes.json().catch(() => null);
  if (!mutateRes.ok) {
    // Still return asset info so user doesn't lose the upload
    return json(
      {
        ok: false,
        step: 'createDocument',
        status: mutateRes.status,
        asset,
        response: mutateJson
      },
      { status: 502 }
    );
  }

  const createdId = mutateJson?.results?.[0]?.id;

  return json({
    ok: true,
    asset,
    documentId: createdId
  });
}
