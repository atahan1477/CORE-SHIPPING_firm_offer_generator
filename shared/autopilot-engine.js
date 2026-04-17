import { trimmed } from './offer-logic.js';

const HARD_POLICY = {
  minMarginPct: 8,
  maxValidityHoursByTier: {
    A: 72,
    B: 48,
    C: 24
  },
  allowedIncotermsByTier: {
    A: ['FOB', 'CFR', 'CIF', 'FCA'],
    B: ['FOB', 'CFR', 'FCA'],
    C: ['FOB', 'FCA']
  },
  paymentTermsByTier: {
    A: ['CAD', 'LC AT SIGHT', 'TT 30/70'],
    B: ['CAD', 'LC AT SIGHT'],
    C: ['100% TT IN ADVANCE']
  },
  restrictedRoutes: [
    { from: 'black sea', to: 'red sea', disallowIncoterms: ['CIF'] }
  ]
};

function normalize(value) {
  return trimmed(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferTier(context) {
  return trimmed(context?.crm?.relationshipTier || 'B').toUpperCase();
}

function findRouteRestriction(pol, pod) {
  const from = normalize(pol);
  const to = normalize(pod);
  return HARD_POLICY.restrictedRoutes.find((rule) => from.includes(rule.from) && to.includes(rule.to)) || null;
}

function chooseIncoterm(rfq, context, tier) {
  const requested = trimmed(rfq.incotermHint).toUpperCase();
  const preferred = trimmed(context?.erp?.defaultIncoterm).toUpperCase();
  const allowedByTier = HARD_POLICY.allowedIncotermsByTier[tier] || HARD_POLICY.allowedIncotermsByTier.B;

  const routeRestriction = findRouteRestriction(rfq.polHint || context?.crm?.preferredPol, rfq.destinationHint || context?.crm?.preferredDestination);
  const routeAllowed = routeRestriction
    ? allowedByTier.filter((term) => !(routeRestriction.disallowIncoterms || []).includes(term))
    : allowedByTier;

  if (requested && routeAllowed.includes(requested)) {
    return { selected: requested, reason: 'RFQ requested incoterm allowed by policy', needsQuestion: false };
  }

  if (requested && !routeAllowed.includes(requested)) {
    return {
      selected: routeAllowed[0] || preferred || 'FOB',
      reason: 'RFQ incoterm blocked by policy; alternative selected',
      needsQuestion: true,
      question: {
        id: 'incoterm_confirm',
        label: 'Incoterm confirmation',
        prompt: `Requested ${requested} is outside policy for this account/route. Confirm alternative:`,
        choices: routeAllowed.slice(0, 3).map((term) => ({ value: term, label: term }))
      }
    };
  }

  const fallback = (preferred && routeAllowed.includes(preferred)) ? preferred : (routeAllowed[0] || 'FOB');
  return { selected: fallback, reason: 'Defaulted to ERP/tier policy incoterm', needsQuestion: false };
}

function choosePaymentTerm(tier, requestedPaymentTerm = '') {
  const allowed = HARD_POLICY.paymentTermsByTier[tier] || HARD_POLICY.paymentTermsByTier.B;
  const requested = trimmed(requestedPaymentTerm).toUpperCase();

  if (requested && allowed.includes(requested)) {
    return { selected: requested, reason: 'RFQ payment term allowed by tier', needsQuestion: false };
  }

  if (requested && !allowed.includes(requested)) {
    return {
      selected: allowed[0],
      reason: 'Requested payment term blocked by tier policy',
      needsQuestion: true,
      question: {
        id: 'payment_term_confirm',
        label: 'Payment term confirmation',
        prompt: `Requested ${requested} is not eligible for tier ${tier}. Confirm allowed payment term:`,
        choices: allowed.slice(0, 3).map((term) => ({ value: term, label: term }))
      }
    };
  }

  return { selected: allowed[0], reason: 'Applied default payment term by tier', needsQuestion: false };
}

function evaluateMargin(context, offerFreight) {
  const floor = toNumber(context?.erp?.freightFloor || offerFreight, offerFreight);
  const offer = toNumber(offerFreight, floor);
  const marginPct = floor > 0 ? ((offer - floor) / floor) * 100 : 0;
  const pass = marginPct >= HARD_POLICY.minMarginPct;
  return {
    pass,
    marginPct: Number(marginPct.toFixed(2)),
    floor,
    rule: `Min margin ${HARD_POLICY.minMarginPct}%`
  };
}

function computeValidityWindowHours(tier) {
  return HARD_POLICY.maxValidityHoursByTier[tier] || HARD_POLICY.maxValidityHoursByTier.B;
}

function computeConfidence({ marginCheck, ambiguityCount }) {
  let score = 0.94;
  if (!marginCheck.pass) score -= 0.28;
  score -= Math.min(0.45, ambiguityCount * 0.18);
  return Math.max(0.1, Math.min(0.99, Number(score.toFixed(2))));
}

export function runAutopilotDecisionGraph({ rfq, context, defaults }) {
  const tier = inferTier(context);

  const incotermDecision = chooseIncoterm(rfq, context, tier);
  const paymentDecision = choosePaymentTerm(tier, rfq.paymentTermHint || '');
  const selectedFreight = trimmed(context?.erp?.indicativeFreight || defaults.freightAmount);
  const marginCheck = evaluateMargin(context, selectedFreight);
  const validityHours = computeValidityWindowHours(tier);

  const questionCandidates = [incotermDecision, paymentDecision].filter((node) => node.needsQuestion);
  const microQuestion = questionCandidates[0]?.question || null;

  const ambiguities = [];
  if (!trimmed(rfq.productSpec)) ambiguities.push('Missing clear product spec in thread');
  if (!trimmed(rfq.quantity)) ambiguities.push('Missing quantity in thread');
  if (!trimmed(rfq.destinationHint)) ambiguities.push('Missing destination/POD in thread');

  const confidenceScore = computeConfidence({
    marginCheck,
    ambiguityCount: ambiguities.length + (microQuestion ? 1 : 0)
  });

  const auditTrail = [
    `Tier inferred: ${tier}`,
    `Incoterm: ${incotermDecision.selected} (${incotermDecision.reason})`,
    `Payment term: ${paymentDecision.selected} (${paymentDecision.reason})`,
    `${marginCheck.rule}: ${marginCheck.marginPct}% (${marginCheck.pass ? 'PASS' : 'FAIL'})`,
    `Validity window set to ${validityHours}h by tier policy`
  ];

  return {
    policy: HARD_POLICY,
    outputs: {
      selectedIncoterm: incotermDecision.selected,
      selectedPaymentTerm: paymentDecision.selected,
      selectedFreight,
      validityHours
    },
    checks: {
      marginCheck,
      requiresReview: !marginCheck.pass
    },
    microQuestion,
    confidenceScore,
    ambiguities,
    auditTrail
  };
}

export function applyMicroAnswer(decision, answerValue) {
  if (!decision?.microQuestion) return decision;
  const value = trimmed(answerValue).toUpperCase();
  if (!value) return decision;

  const next = JSON.parse(JSON.stringify(decision));
  if (next.microQuestion.id === 'incoterm_confirm') {
    next.outputs.selectedIncoterm = value;
    next.auditTrail.push(`Micro-question answered: incoterm confirmed as ${value}`);
  } else if (next.microQuestion.id === 'payment_term_confirm') {
    next.outputs.selectedPaymentTerm = value;
    next.auditTrail.push(`Micro-question answered: payment term confirmed as ${value}`);
  }

  next.microQuestion = null;
  next.confidenceScore = Math.min(0.99, Number((next.confidenceScore + 0.08).toFixed(2)));
  return next;
}
