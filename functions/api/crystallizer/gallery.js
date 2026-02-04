/**
 * Public gallery endpoint for Crystallizer images.
 *
 * Endpoint: GET /api/crystallizer/gallery?limit=240
 *
 * Returns:
 *  { ok: true, items: Array<{...}> }
 */

const PROJECT_ID = 'nacdthna';
const DATASET = 'production';
const API_VERSION = '2024-07-02';

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Avoid edge caching; gallery should reflect new uploads quickly.
      'cache-control': 'no-store',
      ...(init.headers || {})
    },
    ...init
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limitRaw = Number(url.searchParams.get('limit') || '240');
  const limit = Number.isFinite(limitRaw) ? Math.min(1000, Math.max(1, Math.floor(limitRaw))) : 240;

  // Prefer explicit createdAt/date field, fall back to Sanity system _createdAt.
  const query = `*[_type == "crystalizerImage"]
    | order(coalesce(date, createdAt, _createdAt) desc, _createdAt desc)
    [0...$limit]{
      _id,
      title,
      date,
      externalId,
      name,
      message,
      "createdAt": coalesce(createdAt, _createdAt),
      "imageUrl": image.asset->url
    }`;

  const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(query)}&$limit=${encodeURIComponent(String(limit))}`;

  // Read-only query: token is optional (datasetがprivateの場合だけ必要)
  const tokenRaw = context?.env?.SANITY_API_READ_TOKEN || context?.env?.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_WRITE_TOKEN;
  const token = String(tokenRaw || '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1')
    .trim();

  const res = await fetch(endpoint, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const text = await res.text().catch(() => '');
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    return json(
      {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || text || 'Failed to query Sanity'
      },
      { status: 500 }
    );
  }

  const items = Array.isArray(data?.result) ? data.result : [];
  return json({ ok: true, items });
}
