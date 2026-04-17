function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.end(JSON.stringify(payload));
}

function safeTrim(value) {
  return String(value ?? '').trim();
}

function inferAccountName(email) {
  const local = safeTrim(email).toLowerCase();
  if (!local || !local.includes('@')) return 'Please advise';
  const domain = local.split('@')[1] || '';
  const left = domain.split('.')[0] || 'Account';
  return left
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferIndicativeFreight(product) {
  const value = safeTrim(product).toLowerCase();
  if (/steel|coil|plate/.test(value)) return '87.50';
  if (/grain|wheat|corn|soy/.test(value)) return '72.00';
  if (/project|heavy|machinery/.test(value)) return '95.00';
  return '85.00';
}

module.exports = async (request, response) => {
  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const senderEmail = safeTrim(request.query?.senderEmail);
  const product = safeTrim(request.query?.product);

  const payload = {
    ok: true,
    crm: {
      accountName: inferAccountName(senderEmail),
      preferredPol: 'Istanbul',
      preferredDestination: 'Alexandria',
      relationshipTier: 'A'
    },
    erp: {
      preferredVessel: 'CORE TBN',
      defaultIncoterm: 'FOB',
      defaultShipmentWindow: 'Prompt / 2H May 2026',
      indicativeFreight: inferIndicativeFreight(product),
      currency: 'USD'
    }
  };

  sendJson(response, 200, payload);
};
