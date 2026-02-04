/**
 * Upload a generated Crystallizer image to Sanity.
 *
 * Endpoint: POST /api/crystallizer/upload
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

function toHex(bytes) {
  try {
    return Array.from(bytes)
      .map((b) => Number(b).toString(16).padStart(2, '0'))
      .join(' ');
  } catch {
    return '';
  }
}

function sniffImageType(buf) {
  const u8 = new Uint8Array(buf || new ArrayBuffer(0));
  const head = u8.slice(0, 16);
  const hex = toHex(head);

  const isPng =
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a;
  if (isPng) return { guessedType: 'image/png', magic: 'png', headHex: hex };

  const isJpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (isJpeg) return { guessedType: 'image/jpeg', magic: 'jpeg', headHex: hex };

  const isGif = head.length >= 4 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38;
  if (isGif) return { guessedType: 'image/gif', magic: 'gif', headHex: hex };

  const isRiff = head.length >= 4 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
  // WEBP: RIFF .... WEBP (bytes 8-11)
  const isWebp = isRiff && head.length >= 12 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  if (isWebp) return { guessedType: 'image/webp', magic: 'webp', headHex: hex };

  // ISO BMFF (AVIF/HEIC): .... ftyp ....
  const isFtyp = head.length >= 8 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;
  if (isFtyp) return { guessedType: 'application/octet-stream', magic: 'ftyp', headHex: hex };

  return { guessedType: 'application/octet-stream', magic: 'unknown', headHex: hex };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    },
    ...init
  });
}

async function uploadSanityImageAsset({ token, file, filename }) {
  const size = Number(file?.size || 0);
  const type = String(file?.type || '').trim();
  if (!size || size <= 0) {
    return { ok: false, error: 'Uploaded file is empty (0 bytes).' };
  }
  if (type && !type.startsWith('image/')) {
    return { ok: false, error: `Uploaded file is not an image (type: ${type}).` };
  }

  const buf = await file.arrayBuffer();
  if (!buf || buf.byteLength <= 0) {
    return { ok: false, error: 'Failed to read uploaded file bytes.' };
  }

  const sniff = sniffImageType(buf);
  const contentType = type || sniff.guessedType || 'application/octet-stream';

  const blob = new Blob([buf], { type: contentType });
  const up = new FormData();
  up.append('file', blob, filename);

  const assetUrl = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/assets/images/${DATASET}?filename=${encodeURIComponent(filename)}`;
  const parseJsonOrNull = (txt) => {
    try {
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  };

  const doMultipartUpload = async () => {
    const res = await fetch(assetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: up
    });
    const text = await res.text().catch(() => '');
    const json = parseJsonOrNull(text);
    return { res, text, json, method: 'multipart' };
  };

  const doRawUpload = async () => {
    const res = await fetch(assetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': contentType
      },
      body: buf
    });
    const text = await res.text().catch(() => '');
    const json = parseJsonOrNull(text);
    return { res, text, json, method: 'raw' };
  };

  let assetAttempt = await doMultipartUpload();
  if (!assetAttempt.res.ok) {
    const msg = assetAttempt.json?.message || assetAttempt.json?.error || assetAttempt.text || '';
    const details = String(assetAttempt.json?.details || '');
    const shouldRetryRaw =
      String(msg).toLowerCase().includes('invalid image') ||
      String(msg).toLowerCase().includes('metadata') ||
      details.toLowerCase().includes('unsupported image format');

    if (shouldRetryRaw) {
      assetAttempt = await doRawUpload();
    }
  }

  const assetRes = assetAttempt.res;
  const assetText = assetAttempt.text;
  const assetJson = assetAttempt.json;
  const assetUploadMethod = assetAttempt.method;

  if (!assetRes.ok) {
    return {
      ok: false,
      step: 'uploadAsset',
      status: assetRes.status,
      uploadMethod: assetUploadMethod,
      received: {
        filename,
        size,
        type,
        contentType,
        magic: sniff.magic,
        headHex: sniff.headHex
      },
      response: assetJson,
      responseText: assetJson ? undefined : assetText
    };
  }

  const assetId = assetJson?.document?._id;
  const asset = assetJson?.document;
  if (!assetId) {
    return {
      ok: false,
      step: 'uploadAsset',
      error: 'Sanity asset upload succeeded but no document._id returned',
      response: assetJson
    };
  }

  return { ok: true, asset, assetId, uploadMethod: assetUploadMethod };
}

export async function onRequestPost(context) {
  const tokenRaw = context?.env?.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_WRITE_TOKEN;
  const token = String(tokenRaw || '')
    .trim()
    // allow .env style quoted values
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1')
    .trim();
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
  const fileTransparent = form.get('fileTransparent');
  const title = String(form.get('title') || '').trim();
  const dateRaw = String(form.get('date') || '').trim();
  const externalIdRaw = String(form.get('id') || form.get('externalId') || '').trim();
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

  if (fileTransparent != null && !(fileTransparent instanceof File)) {
    return json(
      {
        ok: false,
        error: 'Invalid form field: fileTransparent'
      },
      { status: 400 }
    );
  }

  const filename = file.name || `crystallizer_${Date.now()}.png`;
  const filenameTransparent =
    (fileTransparent instanceof File && (fileTransparent.name || '').trim()) ||
    filename.replace(/\.(png|jpg|jpeg|webp)$/i, '_transparent.$1');

  const now = new Date();
  const dateAuto = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const date = dateRaw || dateAuto;

  // externalId: always `cr` prefix
  const rand = (() => {
    try {
      // Cloudflare Workers supports crypto.randomUUID in most runtimes
      return (crypto?.randomUUID?.() || '').replace(/-/g, '').slice(0, 8);
    } catch {
      return String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    }
  })();
  const externalId = externalIdRaw || `cr${Date.now()}_${rand}`;

  const sanitizeDocId = (id) => {
    const s = String(id || '').trim();
    // Sanity document _id allows letters/numbers/_- and a few others; keep it conservative.
    const cleaned = s.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    return cleaned || `cr${Date.now()}_${rand}`;
  };

  // 1) Upload asset(s)
  const primaryUpload = await uploadSanityImageAsset({ token, file, filename });
  if (!primaryUpload.ok) {
    return json(primaryUpload, { status: primaryUpload.status || 502 });
  }

  const transparentUpload =
    fileTransparent instanceof File
      ? await uploadSanityImageAsset({ token, file: fileTransparent, filename: filenameTransparent })
      : null;
  if (transparentUpload && !transparentUpload.ok) {
    return json(
      {
        ok: false,
        step: 'uploadAssetTransparent',
        primary: { asset: primaryUpload.asset, uploadMethod: primaryUpload.uploadMethod },
        transparent: transparentUpload
      },
      { status: transparentUpload.status || 502 }
    );
  }

  const asset = primaryUpload.asset;
  const assetId = primaryUpload.assetId;
  const assetUploadMethod = primaryUpload.uploadMethod;

  // 2) Create a document that references the asset (so it shows up as an item in Studio)
  const docId = sanitizeDocId(externalId);
  const doc = {
    _id: docId,
    _type: 'crystalizerImage',
    title: title || filename.replace(/\.(png|jpg|jpeg|webp)$/i, ''),
    date,
    externalId,
    name: name || undefined,
    message: message || undefined,
    createdAt: new Date().toISOString(),
    image: {
      _type: 'image',
      asset: { _type: 'reference', _ref: assetId }
    },
    imageTransparent: transparentUpload?.ok
      ? {
          _type: 'image',
          asset: { _type: 'reference', _ref: transparentUpload.assetId }
        }
      : undefined
  };

  const mutateUrl = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}?returnIds=true`;
  const mutateRes = await fetch(mutateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ mutations: [{ create: doc }] })
  });

  const mutateText = await mutateRes.text().catch(() => '');
  const mutateJson = (() => {
    try {
      return mutateText ? JSON.parse(mutateText) : null;
    } catch {
      return null;
    }
  })();
  if (!mutateRes.ok) {
    // Still return asset info so user doesn't lose the upload
    return json(
      {
        ok: false,
        step: 'createDocument',
        status: mutateRes.status,
        asset,
        response: mutateJson,
        responseText: mutateJson ? undefined : mutateText
      },
      { status: mutateRes.status || 502 }
    );
  }

  const createdId = mutateJson?.results?.[0]?.id || docId;

  return json({
    ok: true,
    asset,
    assetTransparent: transparentUpload?.ok ? transparentUpload.asset : undefined,
    documentId: createdId,
    uploadMethod: assetUploadMethod
  });
}
