import { getRuntimeConfig } from '../shared/config.js';
import { buildEmailText, buildVesselSpecsBlocks, trimmed } from '../shared/offer-logic.js';
import { applyMicroAnswer, runAutopilotDecisionGraph } from '../shared/autopilot-engine.js';

const runtimeConfig = getRuntimeConfig();
const SPEED_METRIC_KEY = 'coreShippingMailboxSendDurationsV1';

const generateBtn = document.getElementById('generateBtn');
const finalizeBtn = document.getElementById('finalizeBtn');
const acceptSendBtn = document.getElementById('acceptSendBtn');
const sendCorrectionBtn = document.getElementById('sendCorrectionBtn');
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
const approvalGateInput = document.getElementById('approvalGate');
const speedMetricInput = document.getElementById('speedMetric');

let pendingDecision = null;
let pendingContext = null;
let pendingRFQ = null;
let latestOfferData = null;
let latestOfferDraft = null;
let lastSentRecord = null;
let rfqOpenedAtMs = Date.now();

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

function getStoredDurations() {
  try {
    const raw = localStorage.getItem(SPEED_METRIC_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((v) => Number.isFinite(v) && v > 0) : [];
  } catch (_) {
    return [];
  }
}

function saveDuration(seconds) {
  const current = getStoredDurations();
  current.push(seconds);
  const capped = current.slice(-25);
  try {
    localStorage.setItem(SPEED_METRIC_KEY, JSON.stringify(capped));
  } catch (_) {}
}

function computeMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function refreshSpeedMetric() {
  const median = computeMedian(getStoredDurations());
  if (!median) {
    speedMetricInput.value = 'No send history yet';
    return;
  }
  const targetState = median < 60 ? 'Target met (<60s)' : 'Above target';
  speedMetricInput.value = `${median.toFixed(1)}s median | ${targetState}`;
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

function isHighRiskOffer(decision, contextPayload, offerData) {
  const isNewCustomer = String(contextPayload?.crm?.relationshipTier || '').toUpperCase() === 'C';
  const lowMargin = !decision?.checks?.marginCheck?.pass;
  const selectedPayment = trimmed(decision?.outputs?.selectedPaymentTerm).toUpperCase();
  const standardPayments = ['CAD', 'LC AT SIGHT', 'TT 30/70', '100% TT IN ADVANCE'];
  const nonStandardTerms = !standardPayments.includes(selectedPayment) || /non-standard|subject to revision/i.test(offerData?.finalClause || '');
  return {
    flagged: isNewCustomer || lowMargin || nonStandardTerms,
    reasons: [
      isNewCustomer ? 'new customer tier' : '',
      lowMargin ? 'low margin' : '',
      nonStandardTerms ? 'non-standard terms' : ''
    ].filter(Boolean)
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

async function sendThroughOutlookHost() {
  const item = window.Office?.context?.mailbox?.item;
  if (!item || typeof item.sendAsync !== 'function') {
    return { sent: false, message: 'Outlook send API not available in current host context.' };
  }

  await new Promise((resolve, reject) => {
    item.sendAsync((result) => {
      const succeeded = result?.status === window.Office?.AsyncResultStatus?.Succeeded || result?.status === 'succeeded';
      if (succeeded) {
        resolve();
      } else {
        reject(new Error(result?.error?.message || 'Outlook send failed.'));
      }
    });
  });

  return { sent: true, message: 'Sent via Outlook host compose API.' };
}

async function postDispatchLog(payload) {
  const response = await fetch('/api/offer-dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to log dispatch in CRM.');
  }

  const result = await response.json();
  if (!result?.ok) {
    throw new Error(result?.error || 'Dispatch logging failed.');
  }

  return result;
}

function setStatus(message, warning = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('warn', Boolean(warning));
}

async function finalizeOffer(decision) {
  const offerData = mergeToOfferData(pendingRFQ, pendingContext, decision);
  const offerDraft = buildEmailText(offerData);
  latestOfferData = offerData;
  latestOfferDraft = offerDraft;

  renderDraft(offerData, offerDraft, decision);
  renderDecisionMeta(decision);

  const risk = isHighRiskOffer(decision, pendingContext, offerData);
  approvalGateInput.value = risk.flagged
    ? `Approval required (${risk.reasons.join(', ')})`
    : 'No approval required (standard offer)';

  const composeMessage = await insertIntoComposeWindow(offerDraft.subject, offerDraft.body);
  setStatus(`Draft ready. ${composeMessage}`);
}

generateBtn?.addEventListener('click', async () => {
  try {
    rfqOpenedAtMs = Date.now();
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

acceptSendBtn?.addEventListener('click', async () => {
  try {
    if (!latestOfferDraft || !latestOfferData || !pendingDecision) {
      setStatus('Generate and finalize a draft first.', true);
      return;
    }

    const risk = isHighRiskOffer(pendingDecision, pendingContext, latestOfferData);
    if (risk.flagged) {
      approvalGateInput.value = `Approval required (${risk.reasons.join(', ')})`;
      setStatus('High-risk offer blocked pending approval gate.', true);
      return;
    }

    await insertIntoComposeWindow(latestOfferDraft.subject, latestOfferDraft.body);
    const hostSend = await sendThroughOutlookHost();
    if (!hostSend.sent) {
      setStatus(hostSend.message, true);
      return;
    }

    const sendResult = await postDispatchLog({
      mode: 'send',
      senderEmail: threadSenderInput.value,
      channel: 'outlook-host-send',
      rfqSnapshot: {
        threadText: threadTextInput.value,
        extracted: pendingRFQ
      },
      generatedTermsSnapshot: {
        subject: latestOfferDraft.subject,
        body: latestOfferDraft.body,
        terms: draftTerms.value,
        confidence: confidenceScoreInput.value,
        auditTrail: policyAuditInput.value.split('\n')
      }
    });

    lastSentRecord = sendResult.record;
    const durationSeconds = Math.max(1, Math.round((Date.now() - rfqOpenedAtMs) / 1000));
    saveDuration(durationSeconds);
    refreshSpeedMetric();
    setStatus(`Offer sent via Outlook. CRM log ${sendResult.record.id} | ${durationSeconds}s RFQ-open→send.`);
  } catch (error) {
    setStatus(error?.message || 'Send failed.', true);
  }
});

sendCorrectionBtn?.addEventListener('click', async () => {
  try {
    if (!lastSentRecord?.id || !latestOfferDraft) {
      setStatus('No prior sent offer found. Use Accept & Send first.', true);
      return;
    }

    const correctionSubject = `Correction: ${latestOfferDraft.subject}`;
    const correctionBody = [
      `Reference offer ID: ${lastSentRecord.id}`,
      `Reference message ID: ${lastSentRecord.messageId}`,
      '',
      'Please treat this email as a correction to the prior dispatch.',
      '',
      latestOfferDraft.body
    ].join('\n');

    draftSubject.value = correctionSubject;
    draftBody.value = correctionBody;
    await insertIntoComposeWindow(correctionSubject, correctionBody);

    const hostSend = await sendThroughOutlookHost();
    if (!hostSend.sent) {
      setStatus(`Correction prepared. ${hostSend.message}`, true);
      return;
    }

    const correctionResult = await postDispatchLog({
      mode: 'correction',
      priorOfferId: lastSentRecord.id,
      senderEmail: threadSenderInput.value,
      rfqSnapshot: {
        threadText: threadTextInput.value,
        extracted: pendingRFQ
      },
      generatedTermsSnapshot: {
        subject: correctionSubject,
        body: correctionBody,
        terms: draftTerms.value,
        confidence: confidenceScoreInput.value,
        auditTrail: policyAuditInput.value.split('\n')
      }
    });

    lastSentRecord = correctionResult.record;
    setStatus(`Correction sent via Outlook with linkage to prior offer ${correctionResult.record.priorOfferId}.`);
  } catch (error) {
    setStatus(error?.message || 'Send correction failed.', true);
  }
});

refreshSpeedMetric();
