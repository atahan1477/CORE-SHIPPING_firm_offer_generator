import { getRuntimeConfig } from '../shared/config.js';
import { buildEmailText, buildVesselSpecsBlocks, trimmed } from '../shared/offer-logic.js';

const runtimeConfig = getRuntimeConfig();

const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');
const threadSenderInput = document.getElementById('threadSender');
const threadTextInput = document.getElementById('threadText');
const draftSubject = document.getElementById('draftSubject');
const draftTerms = document.getElementById('draftTerms');
const draftBody = document.getElementById('draftBody');

function parseRFQFromThread(threadText = '') {
  const text = String(threadText || '');

  const quantityMatch = text.match(/\b(?:qty|quantity|volume|cargo)\s*[:=-]?\s*([\d.,]+\s*(?:mt|mts|tons?|cbm|teu))/i)
    || text.match(/\b([\d.,]+\s*(?:mt|mts|tons?|cbm|teu))\b/i);

  const productMatch = text.match(/\b(?:product|commodity|cargo)\s*[:=-]?\s*([^\n.;]+)/i)
    || text.match(/\b(?:for|about)\s+([^\n.;]+?)\s+(?:from|ex|pol)\b/i);

  const destinationMatch = text.match(/\b(?:to|destination|pod)\s*[:=-]?\s*([^\n.;]+)/i);
  const incotermMatch = text.match(/\b(fob|cfr|cif|exw|dap|ddp|fca|fas)\b/i);

  const shipmentTimingMatch = text.match(/\b(?:shipment|laycan|lay\/?can|eta|etd)\s*[:=-]?\s*([^\n.;]+)/i)
    || text.match(/\b(?:q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[^\n.;]*/i);

  const polMatch = text.match(/\b(?:from|origin|pol|load(?:ing)? port)\s*[:=-]?\s*([^\n.;]+)/i);

  return {
    productSpec: trimmed(productMatch?.[1] || ''),
    quantity: trimmed(quantityMatch?.[1] || ''),
    destinationHint: trimmed(destinationMatch?.[1] || ''),
    incotermHint: (incotermMatch?.[1] || '').toUpperCase(),
    shipmentTiming: trimmed(shipmentTimingMatch?.[1] || ''),
    polHint: trimmed(polMatch?.[1] || '')
  };
}

async function fetchCommercialContext(senderEmail, rfq) {
  const query = new URLSearchParams({
    senderEmail: senderEmail || '',
    product: rfq.productSpec || ''
  });

  const response = await fetch(`/api/mailbox-context?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to load CRM/ERP context.');
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'CRM/ERP context unavailable.');
  }

  return payload;
}

function mergeToOfferData(rfq, contextPayload) {
  const defaults = runtimeConfig.formDefaults || {};
  const account = contextPayload.crm?.accountName || defaults.account;
  const product = [rfq.productSpec, rfq.quantity].filter(Boolean).join(' / ') || defaults.cargo;
  const incoterm = rfq.incotermHint || contextPayload.erp?.defaultIncoterm || 'FOB';
  const laycan = rfq.shipmentTiming || contextPayload.erp?.defaultShipmentWindow || defaults.laycanDate;
  const freightAmount = contextPayload.erp?.indicativeFreight || defaults.freightAmount;
  const destination = rfq.destinationHint || contextPayload.crm?.preferredDestination || defaults.pod;
  const pol = rfq.polHint || contextPayload.crm?.preferredPol || defaults.pol;
  const selectedVessel = contextPayload.erp?.preferredVessel || defaults.vessel;
  const vesselBlocks = buildVesselSpecsBlocks(selectedVessel, runtimeConfig);

  return {
    ...defaults,
    account,
    cargo: `${product}${incoterm ? ` (${incoterm})` : ''}`,
    laycanDate: laycan,
    freightAmount,
    pod: destination,
    pol,
    vessel: selectedVessel,
    includeVesselSpecs: true,
    vesselSpecs: vesselBlocks.raw || defaults.vesselSpecs,
    vesselSpecsHtml: vesselBlocks.html || defaults.vesselSpecsHtml,
    emailSubject: '',
    openingParagraph: 'Thank you for your RFQ email. Please find Owners firm indication below based on your requested shipment details:'
  };
}

function renderDraft(offerDraft, contextPayload) {
  const summaryTerms = [
    `Incoterm ${contextPayload.erp?.defaultIncoterm || 'FOB'}`,
    `Rate ${offerDraft.currency} ${offerDraft.freightAmount} ${offerDraft.freightTerms}`,
    `Laycan ${offerDraft.laycanDate}`
  ].join(' | ');

  draftSubject.value = offerDraft.subject;
  draftTerms.value = summaryTerms;
  draftBody.value = offerDraft.body;
}

async function insertIntoComposeWindow(subject, body) {
  if (window.Office?.context?.mailbox?.item) {
    const item = window.Office.context.mailbox.item;
    const setSubject = () => new Promise((resolve) => item.subject.setAsync(subject, () => resolve()));
    const setBody = () => new Promise((resolve) => item.body.setSelectedDataAsync(body, { coercionType: 'text' }, () => resolve()));
    await setSubject();
    await setBody();
    return 'Inserted draft in Outlook compose item.';
  }

  if (window.gmail?.compose?.setSubject && window.gmail?.compose?.setBody) {
    await window.gmail.compose.setSubject(subject);
    await window.gmail.compose.setBody(body);
    return 'Inserted draft in Gmail compose item.';
  }

  return 'Host compose API not detected. Draft generated in panel fields for manual review/copy.';
}

function setStatus(message, warning = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('warn', Boolean(warning));
}

generateBtn?.addEventListener('click', async () => {
  try {
    setStatus('Generating offer draft...');
    const rfq = parseRFQFromThread(threadTextInput.value);
    const contextPayload = await fetchCommercialContext(threadSenderInput.value, rfq);
    const offerData = mergeToOfferData(rfq, contextPayload);
    const offerDraft = buildEmailText(offerData);
    renderDraft(offerDraft, contextPayload);

    const composeMessage = await insertIntoComposeWindow(offerDraft.subject, offerDraft.body);
    setStatus(`Done. ${composeMessage}`);
  } catch (error) {
    setStatus(error?.message || 'Offer generation failed.', true);
  }
});
