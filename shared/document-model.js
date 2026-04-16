import {
  trimmed,
  clauseLinesFromText,
  parseSelectedVesselSpecValues,
  buildVesselSpecsBlocks
} from './offer-logic.js';

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') return false;
  }
  return fallback;
}

function toString(value, fallback = '') {
  return String(value ?? fallback);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitClauses(value) {
  return clauseLinesFromText(value).map((text, index) => ({
    id: `legacy_clause_${index + 1}`,
    type: 'custom_text',
    title: '',
    text,
    source: 'legacy'
  }));
}

function getPortSuffixes(source = {}) {
  return {
    pol: trimmed(source.polSuffix) || trimmed(source.terminalSuffix) || '',
    pod: trimmed(source.podSuffix) || trimmed(source.terminalSuffix) || ''
  };
}

export function createEmptyDocumentDraft() {
  return {
    schemaVersion: 1,
    metadata: {
      title: '',
      status: 'draft',
      source: 'legacy-form',
      createdBy: 'local-user',
      updatedBy: 'local-user'
    },
    template: {
      id: 'legacy-template-v1',
      name: 'Legacy Firm Offer Template'
    },
    parties: {
      account: ''
    },
    vessel: {
      name: '',
      includeSpecs: true,
      specsRaw: '',
      specsHtml: '',
      specsStructuredValues: {}
    },
    cargo: {
      description: '',
      underDeck: '',
      stackable: '',
      basis: 'P/c basis'
    },
    voyage: {
      laycanDate: '',
      terms: '',
      pol: '',
      pod: '',
      portSuffixes: {
        pol: '',
        pod: ''
      }
    },
    commercial: {
      currency: 'USD',
      freightTerms: '',
      freightAmount: '',
      demdetAmount: '',
      includeCongestion: true,
      loadingDays: '',
      loadingTerms: '',
      dischargingDays: '',
      dischargingTerms: '',
      fltLoadingText: '',
      fltDischargingText: '',
      congestionClause: '',
      agentLoad: '',
      agentDischarge: '',
      commissionPercentage: '',
      applicableContract: ''
    },
    drafting: {
      extraClauses: [],
      finalClauses: [],
      clauseBlocks: []
    },
    communications: {
      emailTo: '',
      emailCc: '',
      emailSubject: '',
      greeting: 'Dear Sirs,',
      openingParagraph: '',
      markerLine: '++',
      forLine: 'For',
      endOfferLine: 'End offer',
      closingParagraph: '',
      signature: {
        signOff: 'Best regards,',
        senderName: '',
        senderTitle: '',
        companyName: '',
        companyAddress: '',
        senderMobile: '',
        senderDirect: '',
        senderEmail: '',
        senderWeb: ''
      }
    },
    derived: {
      lastNormalizedAt: new Date().toISOString(),
      legacySignature: ''
    }
  };
}

export function fromLegacyFormData(formData = {}, runtimeConfig = null) {
  const source = formData && typeof formData === 'object' ? formData : {};
  const vesselName = toString(source.vessel, '');

  let vesselSpecsRaw = trimmed(source.vesselSpecs);
  let vesselSpecsHtml = trimmed(source.vesselSpecsHtml);

  if (runtimeConfig && vesselName) {
    const generated = buildVesselSpecsBlocks(vesselName, runtimeConfig);
    vesselSpecsRaw = vesselSpecsRaw || generated.raw;
    vesselSpecsHtml = vesselSpecsHtml || generated.html || generated.raw;
  }

  const draft = createEmptyDocumentDraft();
  draft.metadata.title = toString(source.emailSubject, '').trim() || `${toString(source.vessel, 'CORE TBN')} firm offer`;
  draft.vessel = {
    name: vesselName,
    includeSpecs: toBoolean(source.includeVesselSpecs, true),
    specsRaw: vesselSpecsRaw,
    specsHtml: vesselSpecsHtml || vesselSpecsRaw,
    specsStructuredValues: parseSelectedVesselSpecValues(vesselSpecsRaw)
  };

  draft.parties.account = toString(source.account, '');
  draft.cargo = {
    description: toString(source.cargo, ''),
    underDeck: toString(source.underDeck, ''),
    stackable: toString(source.cargoStackable, ''),
    basis: toString(source.pcBasis, 'P/c basis')
  };

  draft.voyage = {
    laycanDate: toString(source.laycanDate, ''),
    terms: toString(source.terms, ''),
    pol: toString(source.pol, ''),
    pod: toString(source.pod, ''),
    portSuffixes: getPortSuffixes(source)
  };

  draft.commercial = {
    currency: toString(source.currency, 'USD'),
    freightTerms: toString(source.freightTerms, ''),
    freightAmount: toString(source.freightAmount, ''),
    demdetAmount: toString(source.demdetAmount, ''),
    includeCongestion: toBoolean(source.includeCongestion, true),
    loadingDays: toString(source.loadingDays, ''),
    loadingTerms: toString(source.loadingTerms, ''),
    dischargingDays: toString(source.dischargingDays, ''),
    dischargingTerms: toString(source.dischargingTerms, ''),
    fltLoadingText: toString(source.fltLoadingText, ''),
    fltDischargingText: toString(source.fltDischargingText, ''),
    congestionClause: toString(source.congestionClause, ''),
    agentLoad: toString(source.agentLoad, ''),
    agentDischarge: toString(source.agentDischarge, ''),
    commissionPercentage: toString(source.commissionPercentage, ''),
    applicableContract: toString(source.applicableContract, '')
  };

  draft.drafting.extraClauses = splitClauses(source.extraClauses);
  draft.drafting.finalClauses = splitClauses(source.finalClause);
  draft.drafting.clauseBlocks = [...draft.drafting.extraClauses, ...draft.drafting.finalClauses];

  draft.communications = {
    emailTo: toString(source.emailTo, ''),
    emailCc: toString(source.emailCc, ''),
    emailSubject: toString(source.emailSubject, ''),
    greeting: toString(source.greeting, ''),
    openingParagraph: toString(source.openingParagraph, ''),
    markerLine: toString(source.markerLine, '++'),
    forLine: toString(source.forLine, 'For'),
    endOfferLine: toString(source.endOfferLine, 'End offer'),
    closingParagraph: toString(source.closingParagraph, ''),
    signature: {
      signOff: toString(source.signOff, 'Best regards,'),
      senderName: toString(source.senderName, ''),
      senderTitle: toString(source.senderTitle, ''),
      companyName: toString(source.companyName, ''),
      companyAddress: toString(source.companyAddress, ''),
      senderMobile: toString(source.senderMobile, ''),
      senderDirect: toString(source.senderDirect, ''),
      senderEmail: toString(source.senderEmail, ''),
      senderWeb: toString(source.senderWeb, '')
    }
  };

  const signatureSource = {
    vessel: draft.vessel.name,
    cargo: draft.cargo.description,
    laycanDate: draft.voyage.laycanDate,
    pol: draft.voyage.pol,
    pod: draft.voyage.pod,
    freight: `${draft.commercial.currency} ${draft.commercial.freightAmount} ${draft.commercial.freightTerms}`,
    clauses: draft.drafting.clauseBlocks.map((item) => item.text)
  };
  draft.derived.legacySignature = JSON.stringify(signatureSource);
  draft.derived.lastNormalizedAt = new Date().toISOString();

  return draft;
}

export function toLegacyRenderInput(draft = {}) {
  const source = draft && typeof draft === 'object' ? draft : createEmptyDocumentDraft();
  const extraClauseText = (source?.drafting?.extraClauses || []).map((item) => item.text).join('\n');
  const finalClauseText = (source?.drafting?.finalClauses || []).map((item) => item.text).join('\n');

  return {
    vessel: toString(source?.vessel?.name, ''),
    account: toString(source?.parties?.account, ''),
    cargo: toString(source?.cargo?.description, ''),
    underDeck: toString(source?.cargo?.underDeck, ''),
    cargoStackable: toString(source?.cargo?.stackable, ''),
    pcBasis: toString(source?.cargo?.basis, 'P/c basis'),
    includeVesselSpecs: toBoolean(source?.vessel?.includeSpecs, true),
    vesselSpecs: toString(source?.vessel?.specsRaw, ''),
    vesselSpecsHtml: toString(source?.vessel?.specsHtml, toString(source?.vessel?.specsRaw, '')),
    laycanDate: toString(source?.voyage?.laycanDate, ''),
    terms: toString(source?.voyage?.terms, ''),
    pol: toString(source?.voyage?.pol, ''),
    pod: toString(source?.voyage?.pod, ''),
    polSuffix: toString(source?.voyage?.portSuffixes?.pol, ''),
    podSuffix: toString(source?.voyage?.portSuffixes?.pod, ''),
    currency: toString(source?.commercial?.currency, 'USD'),
    freightTerms: toString(source?.commercial?.freightTerms, ''),
    freightAmount: toString(source?.commercial?.freightAmount, ''),
    demdetAmount: toString(source?.commercial?.demdetAmount, ''),
    includeCongestion: toBoolean(source?.commercial?.includeCongestion, true),
    loadingDays: toString(source?.commercial?.loadingDays, ''),
    loadingTerms: toString(source?.commercial?.loadingTerms, ''),
    dischargingDays: toString(source?.commercial?.dischargingDays, ''),
    dischargingTerms: toString(source?.commercial?.dischargingTerms, ''),
    fltLoadingText: toString(source?.commercial?.fltLoadingText, ''),
    fltDischargingText: toString(source?.commercial?.fltDischargingText, ''),
    congestionClause: toString(source?.commercial?.congestionClause, ''),
    agentLoad: toString(source?.commercial?.agentLoad, ''),
    agentDischarge: toString(source?.commercial?.agentDischarge, ''),
    commissionPercentage: toString(source?.commercial?.commissionPercentage, ''),
    applicableContract: toString(source?.commercial?.applicableContract, ''),
    extraClauses: extraClauseText,
    finalClause: finalClauseText,
    emailTo: toString(source?.communications?.emailTo, ''),
    emailCc: toString(source?.communications?.emailCc, ''),
    emailSubject: toString(source?.communications?.emailSubject, ''),
    greeting: toString(source?.communications?.greeting, ''),
    openingParagraph: toString(source?.communications?.openingParagraph, ''),
    markerLine: toString(source?.communications?.markerLine, '++'),
    forLine: toString(source?.communications?.forLine, 'For'),
    endOfferLine: toString(source?.communications?.endOfferLine, 'End offer'),
    closingParagraph: toString(source?.communications?.closingParagraph, ''),
    signOff: toString(source?.communications?.signature?.signOff, 'Best regards,'),
    senderName: toString(source?.communications?.signature?.senderName, ''),
    senderTitle: toString(source?.communications?.signature?.senderTitle, ''),
    companyName: toString(source?.communications?.signature?.companyName, ''),
    companyAddress: toString(source?.communications?.signature?.companyAddress, ''),
    senderMobile: toString(source?.communications?.signature?.senderMobile, ''),
    senderDirect: toString(source?.communications?.signature?.senderDirect, ''),
    senderEmail: toString(source?.communications?.signature?.senderEmail, ''),
    senderWeb: toString(source?.communications?.signature?.senderWeb, '')
  };
}

export function cloneDocumentDraft(draft) {
  return clone(draft || createEmptyDocumentDraft());
}
