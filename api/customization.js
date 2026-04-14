const crypto = require('node:crypto');
const { list, put, del } = require('@vercel/blob');

const BLOB_PATHNAME = process.env.CUSTOMIZATION_BLOB_PATH || 'core-shipping/shared-customization.json';
const ADMIN_PASSWORD = process.env.CUSTOMIZATION_ADMIN_PASSWORD || '';
const HAS_BLOB_TOKEN = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const READ_CACHE_TTL_MS = 30000;

let readCache = null;
let lastKnownBlobUrl = '';

function sendJson(response, status, payload, cacheControl = 'no-store, max-age=0') {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', cacheControl);
  response.end(JSON.stringify(payload));
}

function safeTrim(value) {
  return String(value ?? '').trim();
}

function isWritable() {
  return HAS_BLOB_TOKEN && Boolean(ADMIN_PASSWORD);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) return {};

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text);
}

function parseDate(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function findLatestCustomizationBlob() {
  const { blobs } = await list({ prefix: BLOB_PATHNAME });
  const matches = blobs
    .filter((blob) => blob && blob.pathname === BLOB_PATHNAME)
    .sort((a, b) => parseDate(b.uploadedAt) - parseDate(a.uploadedAt));

  return matches[0] || null;
}

function buildNotConfiguredResult() {
  return {
    configured: false,
    writable: false,
    customization: null,
    meta: {}
  };
}

function isReadCacheFresh() {
  return Boolean(readCache && (Date.now() - readCache.cachedAt) < READ_CACHE_TTL_MS);
}

function saveReadCache(result) {
  readCache = {
    cachedAt: Date.now(),
    value: result
  };
  if (result?.meta?.blobUrl) {
    lastKnownBlobUrl = result.meta.blobUrl;
  }
}

function clearReadCache() {
  readCache = null;
}

async function readBlobPayload(blobUrl) {
  const fileResponse = await fetch(blobUrl, {
    headers: { Accept: 'application/json' }
  });

  if (!fileResponse.ok) {
    throw new Error('Stored customization file could not be read.');
  }

  return fileResponse.json();
}

async function readStoredCustomization(options = {}) {
  const { forceRefresh = false } = options;

  if (!HAS_BLOB_TOKEN) {
    const result = buildNotConfiguredResult();
    saveReadCache(result);
    return result;
  }

  if (!forceRefresh && isReadCacheFresh()) {
    return readCache.value;
  }

  let blob = null;
  let payload = null;

  if (lastKnownBlobUrl) {
    try {
      payload = await readBlobPayload(lastKnownBlobUrl);
      blob = { pathname: BLOB_PATHNAME, url: lastKnownBlobUrl, uploadedAt: payload?.updatedAt || null };
    } catch (_) {
      lastKnownBlobUrl = '';
    }
  }

  if (!blob) {
    blob = await findLatestCustomizationBlob();
  }

  if (!blob) {
    const result = {
      configured: true,
      writable: isWritable(),
      customization: null,
      meta: {
        pathname: BLOB_PATHNAME,
        exists: false
      }
    };
    saveReadCache(result);
    return result;
  }

  payload = payload || await readBlobPayload(blob.url);
  const customization = payload && typeof payload.customization === 'object' && !Array.isArray(payload.customization)
    ? payload.customization
    : null;

  const result = {
    configured: true,
    writable: isWritable(),
    customization,
    meta: {
      pathname: BLOB_PATHNAME,
      exists: true,
      blobUrl: blob.url,
      uploadedAt: blob.uploadedAt,
      updatedAt: payload?.updatedAt || null
    }
  };
  saveReadCache(result);
  return result;
}

function passwordsMatch(candidate) {
  const expected = Buffer.from(ADMIN_PASSWORD, 'utf8');
  const received = Buffer.from(safeTrim(candidate), 'utf8');

  if (!expected.length || expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

async function requireAdminPassword(request, options = {}) {
  const { readBody = false } = options;
  if (!HAS_BLOB_TOKEN) {
    return { ok: false, status: 503, error: 'Shared Vercel Blob storage is not configured yet.' };
  }

  if (!ADMIN_PASSWORD) {
    return { ok: false, status: 503, error: 'CUSTOMIZATION_ADMIN_PASSWORD is not configured yet.' };
  }

  const headerPassword = safeTrim(request.headers['x-customize-password']);
  if (headerPassword && passwordsMatch(headerPassword)) {
    if (!readBody) return { ok: true, body: {} };

    let body = {};
    try {
      body = await readJsonBody(request);
    } catch (_) {
      return { ok: false, status: 400, error: 'Request body must be valid JSON.' };
    }
    return { ok: true, body };
  }

  let body = {};
  if (readBody) {
    try {
      body = await readJsonBody(request);
    } catch (_) {
      return { ok: false, status: 400, error: 'Request body must be valid JSON.' };
    }
  } else {
    try {
      body = await readJsonBody(request);
    } catch (_) {
      body = {};
    }
  }

  const bodyPassword = safeTrim(body.adminPassword);
  if (!passwordsMatch(bodyPassword)) {
    return { ok: false, status: 401, error: 'Admin password is incorrect.' };
  }

  return { ok: true, body };
}

async function handleGet(request, response) {
  try {
    const result = await readStoredCustomization();
    sendJson(response, 200, {
      ok: true,
      configured: result.configured,
      writable: result.writable,
      customization: result.customization,
      meta: result.meta,
      message: result.configured
        ? result.customization
          ? 'Shared customization loaded.'
          : 'No shared customization has been saved yet.'
        : 'Shared storage is not configured yet.'
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Shared customization read failed.'
    });
  }
}

async function handlePost(request, response) {
  const auth = await requireAdminPassword(request, { readBody: true });
  if (!auth.ok) {
    sendJson(response, auth.status, { ok: false, error: auth.error });
    return;
  }

  const body = auth.body || {};
  const customization = body && typeof body.customization === 'object' && !Array.isArray(body.customization)
    ? body.customization
    : null;

  if (!customization) {
    sendJson(response, 400, { ok: false, error: 'customization must be a JSON object.' });
    return;
  }

  try {
    const updatedAt = new Date().toISOString();
    await put(BLOB_PATHNAME, JSON.stringify({ customization, updatedAt }, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0
    });

    const meta = {
      pathname: BLOB_PATHNAME,
      exists: true,
      blobUrl: lastKnownBlobUrl || null,
      updatedAt
    };
    saveReadCache({
      configured: true,
      writable: true,
      customization,
      meta
    });
    sendJson(response, 200, {
      ok: true,
      configured: true,
      writable: true,
      customization,
      meta,
      message: 'Shared customization saved.'
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Shared customization save failed.'
    });
  }
}

async function handleDelete(request, response) {
  const auth = await requireAdminPassword(request, { readBody: false });
  if (!auth.ok) {
    sendJson(response, auth.status, { ok: false, error: auth.error });
    return;
  }

  try {
    const blob = await findLatestCustomizationBlob();
    if (blob) {
      await del(blob.url);
    }

    clearReadCache();
    lastKnownBlobUrl = '';
    sendJson(response, 200, {
      ok: true,
      configured: true,
      writable: true,
      customization: null,
      meta: {
        pathname: BLOB_PATHNAME,
        exists: false
      },
      message: 'Shared customization reset.'
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Shared customization reset failed.'
    });
  }
}

module.exports = async (request, response) => {
  if (request.method === 'GET') {
    await handleGet(request, response);
    return;
  }

  if (request.method === 'POST') {
    await handlePost(request, response);
    return;
  }

  if (request.method === 'DELETE') {
    await handleDelete(request, response);
    return;
  }

  sendJson(response, 405, {
    ok: false,
    error: 'Method not allowed.'
  });
};
