function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.end(JSON.stringify(payload));
}

function safeTrim(value) {
  return String(value ?? '').trim();
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

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(request);
  } catch (_) {
    sendJson(response, 400, { ok: false, error: 'Request body must be valid JSON.' });
    return;
  }

  const to = safeTrim(body.to);
  const subject = safeTrim(body.subject);
  const textBody = safeTrim(body.body);
  const accessToken = safeTrim(body.accessToken || process.env.OUTLOOK_GRAPH_ACCESS_TOKEN);

  if (!to || !subject || !textBody) {
    sendJson(response, 400, { ok: false, error: 'to, subject, and body are required.' });
    return;
  }

  if (!accessToken) {
    sendJson(response, 401, { ok: false, error: 'No Outlook access token provided.' });
    return;
  }

  const graphPayload = {
    message: {
      subject,
      body: {
        contentType: 'Text',
        content: textBody
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    },
    saveToSentItems: true
  };

  const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphPayload)
  });

  if (!graphResponse.ok) {
    const errorText = await graphResponse.text();
    sendJson(response, graphResponse.status, {
      ok: false,
      error: `Graph sendMail failed: ${errorText.slice(0, 400)}`
    });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    channel: 'microsoft-graph',
    to,
    subject
  });
};
