import { getRuntimeConfig } from '../shared/config.js';
import { buildEmailText, buildVesselSpecsBlocks, trimmed } from '../shared/offer-logic.js';
import { applyMicroAnswer, runAutopilotDecisionGraph } from '../shared/autopilot-engine.js';

const runtimeConfig = getRuntimeConfig();

const generateBtn = document.getElementById('generateBtn');
const finalizeBtn = document.getElementById('finalizeBtn');
const statusEl = document.getElementById('status');
const threadSenderInput = document.getElementById('threadSender');
const threadTextInput = document.getElementById('threadText');
const draftSubject = document.getElementById('draftSubject');
const draftTerms = document.getElementById('draftTerms');
const draftBody = document.getElementById('draftBody');
const confidenceScoreInput = document.getElementById('confidenceScore');
const policyAuditInput = document.getElementById('policyAudit');
const microQuestionWrap = document.getElementById('microQuestionWrap');
const microQuestionLabel = document.getElementById('microQuestionLabel');
const microQuestionSelect = document.getElementById('microQuestionSelect');

let pendingDecision = null;
let pendingContext = null;
let pendingRFQ = null;

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
  const paymentTermMatch = text.match(/\b(?:payment|pay(?:ment)? terms?)\s*[:=-]?\s*([^\n.;]+)/i);

  return {
    productSpec: trimmed(productMatch?.[1] || ''),
    quantity: trimmed(quantityMatch?.[1] || ''),
    destinationHint: trimmed(destinationMatch?.[1] || ''),
    incotermHint: (incotermMatch?.[1] || '').toUpperCase(),
    shipmentTiming: trimmed(shipmentTimingMatch?.[1] || ''),
    polHint: trimmed(polMatch?.[1] || ''),
    paymentTermHint: trimmed(paymentTermMatch?.[1] || '').toUpperCase()
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

function mergeToOfferData(rfq, contextPayload, decision) {
  const defaults = runtimeConfig.formDefaults || {};
  const account = contextPayload.crm?.accountName || defaults.account;
  const product = [rfq.productSpec, rfq.quantity].filter(Boolean).join(' / ') || defaults.cargo;
  const incoterm = decision.outputs.selectedIncoterm || contextPayload.erp?.defaultIncoterm || 'FOB';
  const laycan = rfq.shipmentTiming || contextPayload.erp?.defaultShipmentWindow || defaults.laycanDate;
  const freightAmount = decision.outputs.selectedFreight || defaults.freightAmount;
  const destination = rfq.destinationHint || contextPayload.crm?.preferredDestination || defaults.pod;
  const pol = rfq.polHint || contextPayload.crm?.preferredPol || defaults.pol;
  const selectedVessel = contextPayload.erp?.preferredVessel || defaults.vessel;
  const vesselBlocks = buildVesselSpecsBlocks(selectedVessel, runtimeConfig);
  const validitySuffix = `Firm for ${decision.outputs.validityHours} hours.`;

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
    applicableContract: `${defaults.applicableContract}\nPayment terms: ${decision.outputs.selectedPaymentTerm}`,
    finalClause: `${defaults.finalClause}\n${validitySuffix}`,
    emailSubject: '',
    openingParagraph: 'Thank you for your RFQ email. Please find Owners firm indication below based on your requested shipment details:'
  };
}

function renderDecisionMeta(decision) {
  confidenceScoreInput.value = `${Math.round(decision.confidenceScore * 100)}%`;
  const auditLines = [...decision.auditTrail];
  if (decision.ambiguities.length) {
    auditLines.push('Ambiguities:');
    decision.ambiguities.forEach((item) => auditLines.push(`- ${item}`));
  }
  policyAuditInput.value = auditLines.join('\n');
}

function renderDraft(offerData, offerDraft, decision) {
  const summaryTerms = [
    `Incoterm ${decision.outputs.selectedIncoterm}`,
    `Rate ${offerData.currency} ${offerData.freightAmount} ${offerData.freightTerms}`,
    `Payment ${decision.outputs.selectedPaymentTerm}`,
    `Validity ${decision.outputs.validityHours}h`
  ].join(' | ');

  draftSubject.value = offerDraft.subject;
  draftTerms.value = summaryTerms;
  draftBody.value = offerDraft.body;
}

function renderMicroQuestion(decision) {
  if (!decision.microQuestion) {
    microQuestionWrap.style.display = 'none';
    microQuestionSelect.innerHTML = '';
    return;
  }

  microQuestionWrap.style.display = 'block';
  microQuestionLabel.textContent = `${decision.microQuestion.label}: ${decision.microQuestion.prompt}`;

  microQuestionSelect.innerHTML = '';
  decision.microQuestion.choices.forEach((choice) => {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label;
    microQuestionSelect.appendChild(option);
  });
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

async function finalizeOffer(decision) {
  const offerData = mergeToOfferData(pendingRFQ, pendingContext, decision);
  const offerDraft = buildEmailText(offerData);
  renderDraft(offerData, offerDraft, decision);
  renderDecisionMeta(decision);

  const composeMessage = await insertIntoComposeWindow(offerDraft.subject, offerDraft.body);
  setStatus(`Done. ${composeMessage}`);
}

generateBtn?.addEventListener('click', async () => {
  try {
    setStatus('Running autopilot decision graph...');
    pendingRFQ = parseRFQFromThread(threadTextInput.value);
    pendingContext = await fetchCommercialContext(threadSenderInput.value, pendingRFQ);

    const decision = runAutopilotDecisionGraph({
      rfq: pendingRFQ,
      context: pendingContext,
      defaults: runtimeConfig.formDefaults || {}
    });

    pendingDecision = decision;
    renderDecisionMeta(decision);
    renderMicroQuestion(decision);

    if (decision.microQuestion) {
      setStatus('One clarification needed before finalizing the firm offer.', true);
      return;
    }

    await finalizeOffer(decision);
  } catch (error) {
    setStatus(error?.message || 'Offer generation failed.', true);
  }
});

finalizeBtn?.addEventListener('click', async () => {
  try {
    if (!pendingDecision?.microQuestion) {
      setStatus('No micro-question pending. Generate first.', true);
      return;
    }

    const selected = microQuestionSelect.value;
    const resolved = applyMicroAnswer(pendingDecision, selected);
    pendingDecision = resolved;
    renderMicroQuestion(resolved);
    await finalizeOffer(resolved);
  } catch (error) {
    setStatus(error?.message || 'Finalize failed.', true);
  }
});
