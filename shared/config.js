const CUSTOMIZATION_STORAGE_KEY = 'coreShippingGeneratorCustomizationV1';
const CUSTOMIZATION_CHANNEL_NAME = 'core-shipping-generator-customization';
const REMOTE_CUSTOMIZATION_ENDPOINT = '/api/customization';

let remoteCustomizationSyncPromise = null;
const LEGACY_DEFAULT_SELECTED_SPEC_FIELDS = ['built_imo', 'type', 'flag', 'class', 'dwt', 'hold_hatch', 'grain_bale', 'gear'];

export const baseConfig = {
  vesselOptions: ["CORE TBN", "MV ATA 1", "MV ANUBIS", "MV ANUNNAKI", "MV ADMIRAL DE RIBAS", "MV MUSTAFA K", "MV GOLDY SEVEN", "MV HORUS", "MV AST RISING", "M/V LDR SAKINE", "MV AST MALTA", "MV AST ECO", "MV FORESTER", "MV LILIBET"],
  vesselSpecs: {
    "CORE TBN": "",
    "MV ATA 1": "GENERAL CARGO / BOX SHAPED\nBUILT 2006 – IMO 9378010\nPANAMA FLAG / BULGARIAN CLASS\n6,555 DWAT ON 6.2 M SSWD\nGRT/NRT 4655/2306 T\nLOA 118.60 M / BEAM 16.20 M / DEPTH 7.80 M / LBP 109.19 M\n3 HO / HA – GRAIN BALE – 8285.12 CBM\nGEARLESS – PONTOON HA COVERS GANTRY CRANE",
    "MV ANUBIS": "IMO 9226695 / Built 2000\nDWT 8504 on 8.023 mtr\nLOA 117.92 m\nBeam 19.40 m\nNRT / GRT 3116 / 6272\nG/B 10500 cbm\n2HOHA\nGeared 2 x 150t SWL\nContainer fitted\nADA",
    "MV ANUNNAKI": "IMO 9210713 / Built 2001\nDWT 9002 on 7.6 mtr\nLOA 126.42 m\nBeam 19.40 m\nGRT / NRT 7091 / 3492\nG/B 11357 cbm\n2HOHA\nGeared 2 x 60t SWL\nADA",
    "MV ADMIRAL DE RIBAS": "3,680 MTS DWT ON 5.5 M SSW\n1994 BUILT SLOVENIA – DOUBLE SKINNED\nFULLY BOX / PHRS CLASS / PALAU FLAG\n1 HO/HA – 56.55 x 10.02 x 8.12 m\nGRAIN / BALE 164,213 / 163,153 CBFT\nGRT 2,446 / NRT 957\nTEU HOLD/DECK 108 / 68\nBOW THRUSTER / APP.B FITTED / 2 MOVEABLE BULKHEADS\nTHOMAS MILLER P&I / H&M CEE SPECIALTY\nADA",
    "MV MUSTAFA K": "7,165 DWT | 1990 Built\nGeared 2 x 25t SWL\nGrain / Bale 9701 cbm / 8903 cbm\nLOA 106.86 m\nSummer Draft 6.8 m",
    "MV GOLDY SEVEN": "BLT 1996\nFLAG ZANZIBAR / HOMEPORT TANZANIA / IMO 9135731\nDWCC SUMMER 4000 MTS / WINTER 3850 MTS\nLOA 89.77 M / BEAM 13.17 M / DRAFT SSW 5.66 M\nGRAIN CAPACITY 192359 CBFT / GT 2844 / NT 1568\nDRAFT IN BALLAST 3.52 M\nHO/HA 1/1\nHOLD 59.50 x 11.00 x 8.43 m\nHATCH 62.50 x 11.00 m\nHATCH TYPE Coops & Nieborg\nGEARLESS",
    "MV HORUS": "9,500 DWCC | 1993 Built\nGeared 2 x 40t SWL\nGrain / Bale 342,694 / 1387,048 CBFT\nGT / NT 7366 / 3614\nLOA 122.33 m\nSummer Draft 8.85 m",
    "MV AST RISING": "FLAG MARSHALL ISLAND / CLASS KOREAN REGISTER / ICE CLASS\nTYPE GENERAL CARGO / HULL STEEL\nBUILT 2009\nGT / NT 4109 / 2332\nDEADWEIGHT 6088.32 MT\nLOA 99.89 M / LBP 94.72 M\nBREADTH 16.60 M / DEPTH 8.40 M\nSUMMER DRAFT 6.70 M\n2 CRANES IHI-WM 30 MT\nCONTAINER ON DECK FITTED\n2 CARGO HOLDS / SINGLE DECK / DOUBLE HULL\nGRAIN CAPACITY 7835.65 M3\nHATCH COVERS HYDRAULIC SINGLE PULL TYPE\nADA",
    "M/V LDR SAKINE": "6445 DWT ON 7.25 METERS\nG/C – SID\nBLT 1993 / DOUBLE SKIN / BOX / IMO & GRAIN FITTED\nFLAG PANAMA / CLASS PRS\nLOA 111.10 M / BEAM 16 M / DRAFT 7.25 M\nGRT / NRT 4193 / 2168\nHO/HA 3/3 / GRAIN-BALE 249735 / 246681 CUFT\nGEARLESS / LONDON P&I / CONTAINER FITTED\nIMO 1 FITTED\nADA-WOG",
    "MV AST MALTA": "OPEN HATCH / BOX / GLESS / SID\nBUILT 1998 / KR(IACS) / PALAU FLAG / ICE CLASS 1A\n5,001 / 4,650 DWAT / DWCC\nLOA 99.63 M / DRAFT 6.18 M / BEAM 16.90 M\nGT / NT 3415 / 1661\nFOLDING TYPE (KVAERNER) HATCH COVERS\nEQUIPPED FOR DANGEROUS GOODS\n2HO / 3HA / GR-BL 205,000 / 201,000 CBFT\nAPP B / IMO CARGO / CONTAINER FITTED / REEFER PLUGS\nABOUT 260 TEU / FULL LASHINGS ON BOARD\nADA WOG",
    "MV AST ECO": "FLAG MARSHALL ISLAND\nBUILT 2007\nCLASS KR(IACS)\nP&I THE LONDON P&I CLUB\nSHIP TYPE GENERAL CARGO\nGT 1972 / NT 1271\nDWT 3327 MT\nDRAFT 5.5 M\nLOA / LBP 81 / 76 M\nBEAM 13.6 M / DEPTH 6.8 M\nELECTRIC SINGLE PULL MACGREGOR HATCH COVERS\nHATCH SIZE NO.1 18.6 x 9.0 / NO.2 18.6 x 9.0\nGRAIN 4541 M / BALE 4468 M",
    "MV FORESTER": "1990 GERMAN BLT / SID / GLESS / BOX\nOPEN HATCH / TANZANIA FLAG / LONDON P&I / PRS CLASS\nIMO FITTED / BOW THRUSTER FITTED\nDWT 4902 / GRT 2827 / NRT 1595 / GR-BL 200,000 CBFT\nLOA 88.20 M / BEAM 13.60 M / LBP 84.93 M / DEPTH 7.70 M\nSUMMER DRAFT 6.60 M / AIR DRAFT 26.70 M\n1 HO / 1 HA\nHOLD 58.20 x 11.10 x 8.80\nHATCH 56.40 x 11.10 x 2.45\n2 MOVEABLE BULKHEADS FITTED\nIMO 1 / ITF FITTED\nADA WOG",
    "MV LILIBET": "IMO 8649993\nTANZANIA FLAG / BUILT 2005\nINMB CLASS / 4500 DWCC ON 5.7 M SW\nLOA / LBP / BEAM / DEPTH 96.08 / 89.90 / 14.20 / 7.20 M\nGRT / NRT 2994 / 1676\nGRAIN / BALE 214,684 / 214,684 CBFT\n2HO / 2HA OPEN HATCH"
  },
  vesselStructuredSpecs: {},
  vesselSpecFieldOptions: [
    { id: 'built_imo', label: 'Built / IMO' },
    { id: 'type', label: 'Ship type' },
    { id: 'flag', label: 'Flag' },
    { id: 'class', label: 'Class' },
    { id: 'pni', label: 'P&I' },
    { id: 'dwt', label: 'DWT / DWCC' },
    { id: 'gt_nt', label: 'GT / NT' },
    { id: 'dimensions', label: 'LOA / LBP / Beam / Depth' },
    { id: 'draft', label: 'Draft' },
    { id: 'grain_bale', label: 'Grain / Bale' },
    { id: 'hold_hatch', label: 'Hold / Hatch' },
    { id: 'gear', label: 'Gear' },
    { id: 'hatch_covers', label: 'Hatch covers' },
    { id: 'fittings', label: 'Fittings / Extras' },
    { id: 'ada', label: 'ADA' }
  ],
  underDeckOptions: ["Under deck", "Under/On deck", "Under/On deck in OO", "On deck", "BB items under deck / containers on deck"],
  cargoStackableOptions: ["Cargo fully stackable", "Cargo partly stackable", "Cargo not stackable", "Cargo not stackable except containers"],
  currencyOptions: ["USD", "EURO"],
  freightTermsOptions: ["pmt", "lumpsum", "per cbm"],
  termsOptions: ["Free In Free Out", "Free In Liner Out", "Liner In Free Out", "Liner In Liner Out"],
  laytimeTermsOptions: ["sshinc", "shinc", "fshinc", "sshex", "shex", "fshex"],
  agentOptions: ["TBA", "Reba Shipping", "Supermaritime", "New Marine", "Hull Blyth Shipping", "AGL", "OBT"],
  formDefaults: {
    vessel: 'CORE TBN',
    account: 'Please advise',
    cargo: 'As per given details',
    underDeck: 'Under deck',
    cargoStackable: 'Cargo fully stackable',
    pcBasis: 'P/c basis',
    includeVesselSpecs: true,
    vesselSpecs: '',
    vesselSpecsHtml: '',
    laycanDate: '01-10 Sep 2024',
    terms: 'Free In Free Out',
    pol: '',
    pod: '',
    polSuffix: 'Owners terminal',
    podSuffix: 'Owners terminal',
    currency: 'USD',
    freightTerms: 'pmt',
    freightAmount: '85.00',
    demdetAmount: '10,500',
    includeCongestion: true,
    loadingDays: '2',
    loadingTerms: 'sshinc',
    dischargingDays: '2',
    dischargingTerms: 'sshinc',
    fltLoadingText: 'As fast as vessel can load',
    fltDischargingText: 'As fast as vessel can discharge',
    congestionClause: 'Congestion, if any, to count as detention both ends',
    agentLoad: 'TBA',
    agentDischarge: 'TBA',
    commissionPercentage: '',
    applicableContract: 'Carriers BN',
    extraClauses: '',
    finalClause: 'Sub all further terms / conditions\nIndication is based on current tariffs for load/disch costs and d/as',
    emailTo: '',
    emailCc: '',
    emailSubject: '',
    greeting: 'Dear Sirs,',
    openingParagraph: 'Thank you for the cargo proposal. Please find Owners indication as follows:',
    markerLine: '++',
    forLine: 'For',
    endOfferLine: 'End offer',
    closingParagraph: 'Looking forward to hear',
    signOff: 'Best regards,',
    senderName: 'Your Name',
    senderTitle: 'Chartering / Operations',
    companyName: 'Core Shipping',
    companyAddress: 'Bagdat Cad, Turab Sok, No: 06/06\n34744, Istanbul, Turkey',
    senderMobile: '',
    senderDirect: '',
    senderEmail: '',
    senderWeb: 'www.core-shipping.com'
  }
};

export const BASE_TERM_BEHAVIOR = {
  'Free In Free Out': {
    mode: 'laytime',
    includeLoading: true,
    includeDischarging: true,
    meaning: 'Free In Free Out = Loading and discharging on free in / free out basis.',
    structure: 'Selected structure: day-based loading / discharging laytime fields for both ends.'
  },
  'Free In Liner Out': {
    mode: 'laytime',
    includeLoading: true,
    includeDischarging: true,
    meaning: 'Free In Liner Out = Loading on free in basis and discharging on liner out basis.',
    structure: 'Selected structure: day-based loading / discharging laytime fields matched to the selected term.'
  },
  'Liner In Free Out': {
    mode: 'laytime',
    includeLoading: true,
    includeDischarging: true,
    meaning: 'Liner In Free Out = Loading on liner in basis and discharging on free out basis.',
    structure: 'Selected structure: day-based loading / discharging laytime fields matched to the selected term.'
  },
  'Liner In Liner Out': {
    mode: 'laytime',
    includeLoading: true,
    includeDischarging: true,
    meaning: 'Liner In Liner Out = Loading and discharging on liner in / liner out basis.',
    structure: 'Selected structure: day-based loading / discharging laytime fields for both ends.'
  }
};

export const BASE_TERM_CLAUSES = {
  'Free In Free Out': {
    detentionClause: 'Congestion, if any, to count as detention both ends.',
    speedClause: ''
  },
  'Free In Liner Out': {
    detentionClause: 'Congestion, if any, to count as detention at load port only.',
    speedClause: 'Discharge to be performed as fast as vessel can discharge.'
  },
  'Liner In Free Out': {
    detentionClause: 'Congestion, if any, to count as detention at discharge port only.',
    speedClause: 'Loading to be performed as fast as vessel can load.'
  },
  'Liner In Liner Out': {
    detentionClause: 'Congestion, if any, not to count as detention, unless otherwise agreed.',
    speedClause: 'Loading/discharging to be performed as fast as vessel can load/discharge.'
  }
};

const TERM_CLAUSE_ALIASES = {
  'Free In Free Out': ['FIFO'],
  'Free In Liner Out': ['FILO'],
  'Liner In Free Out': ['LIFO'],
  'Liner In Liner Out': ['LILO']
};

const customizationChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel(CUSTOMIZATION_CHANNEL_NAME)
  : null;

const customizationListeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function trimmed(value) {
  return String(value ?? '').trim();
}

export function slugifyFieldId(label) {
  const base = trimmed(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'field';
}

function uniqueTrimmedList(values) {
  const result = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const next = trimmed(value);
    if (!next || result.includes(next)) return;
    result.push(next);
  });
  return result;
}

function sanitizeFieldOptions(values) {
  const safe = [];
  const used = new Set();

  (Array.isArray(values) ? values : []).forEach((item) => {
    const label = trimmed(item?.label || item?.name || '');
    if (!label) return;

    let id = trimmed(item?.id || slugifyFieldId(label));
    if (!id) id = slugifyFieldId(label);
    while (used.has(id)) {
      id = `${id}_x`;
    }

    used.add(id);
    safe.push({ id, label });
  });

  return safe.length ? safe : clone(baseConfig.vesselSpecFieldOptions);
}

function splitSpecLines(specsText) {
  return trimmed(specsText)
    .split(/\n+/)
    .map((line) => trimmed(line))
    .filter(Boolean);
}

function splitSegments(line) {
  return String(line || '')
    .split(/\s*[\/|–—-]\s*/)
    .map((segment) => trimmed(segment))
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function cleanJoinedValue(values) {
  return unique(values).join(' / ');
}

function normalizeFlag(segment) {
  let match = segment.match(/^FLAG\s+(.+)$/i);
  if (match) return trimmed(match[1]);
  match = segment.match(/^(.+?)\s+FLAG$/i);
  if (match) return trimmed(match[1]);
  return '';
}

function normalizeType(segment) {
  const upper = segment.toUpperCase();
  if (/\bMPP\b/.test(upper)) return 'MPP';
  if (/\bGENERAL\s+CARGO\b/.test(upper) || /\bSHIP\s+TYPE\s+GENERAL\s+CARGO\b/.test(upper)) return 'General Cargo';
  if (/^G\/C$/i.test(segment) || /\bG\/C\b/i.test(segment)) return 'General Cargo';
  return '';
}

function normalizeClass(segment) {
  const upper = segment.toUpperCase();
  if (/CLASS/.test(upper) || /^KR\(IACS\)$/i.test(segment) || /^PRS$/i.test(segment) || /^INMB$/i.test(segment) || /^PHRS$/i.test(segment) || /KOREAN REGISTER/i.test(segment) || /BULGARIAN CLASS/i.test(segment)) {
    return segment;
  }
  return '';
}

function extractBuiltImo(lines) {
  const joined = lines.join(' / ');
  const builtMatch = joined.match(/\b(?:BUILT|BLT)\s*(\d{4})\b/i) || joined.match(/\b(\d{4})\s*(?:BUILT|BLT)\b/i);
  const imoMatch = joined.match(/\bIMO\s*[:#-]?\s*(\d{7})\b/i);
  const parts = [];
  if (builtMatch) parts.push(`Built ${builtMatch[1]}`);
  if (imoMatch) parts.push(`IMO ${imoMatch[1]}`);
  return cleanJoinedValue(parts);
}

function extractByLinePatterns(lines, patterns) {
  return lines.filter((line) => patterns.some((pattern) => pattern.test(line)));
}

function extractBySegmentPatterns(lines, patterns) {
  const results = [];
  lines.forEach((line) => {
    splitSegments(line).forEach((segment) => {
      if (patterns.some((pattern) => pattern.test(segment))) {
        results.push(segment);
      }
    });
  });
  return unique(results);
}

function extractDimensions(lines) {
  const joined = lines.join(' / ');
  const parts = [];
  const loa = joined.match(/\bLOA\s*[: ]*([\d.,]+\s*(?:M|MTR|MTRS|METERS?)?)/i);
  const lbp = joined.match(/\bLBP\s*[: ]*([\d.,]+\s*(?:M|MTR|MTRS|METERS?)?)/i);
  const beam = joined.match(/\b(?:BEAM|BREADTH)\s*[: ]*([\d.,]+\s*(?:M|MTR|MTRS|METERS?)?)/i);
  const depth = joined.match(/\bDEPTH\s*[: ]*([\d.,]+\s*(?:M|MTR|MTRS|METERS?)?)/i);
  if (loa) parts.push(`LOA ${trimmed(loa[1])}`);
  if (lbp) parts.push(`LBP ${trimmed(lbp[1])}`);
  if (beam) parts.push(`Beam ${trimmed(beam[1])}`);
  if (depth) parts.push(`Depth ${trimmed(depth[1])}`);
  return cleanJoinedValue(parts);
}

function extractDraft(lines) {
  const results = [];
  const joined = lines.join(' / ');
  const patterns = [
    /SUMMER\s+DRAFT\s*[: ]*([\d.,]+\s*M)/ig,
    /DRAFT\s+IN\s+BALLAST\s*[: ]*([\d.,]+\s*M)/ig,
    /AIR\s+DRAFT\s*[: ]*([\d.,]+\s*M)/ig,
    /\bDRAFT\s*[: ]*([\d.,]+\s*M)/ig,
    /ON\s*([\d.,]+\s*M)\s*(SSWD|SSW|SW)\b/ig
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(joined))) {
      if (match[2]) {
        results.push(`${trimmed(match[1])} ${trimmed(match[2])}`);
      } else if (/SUMMER\s+DRAFT/i.test(match[0])) {
        results.push(`Summer Draft ${trimmed(match[1])}`);
      } else if (/DRAFT\s+IN\s+BALLAST/i.test(match[0])) {
        results.push(`Draft in Ballast ${trimmed(match[1])}`);
      } else if (/AIR\s+DRAFT/i.test(match[0])) {
        results.push(`Air Draft ${trimmed(match[1])}`);
      } else {
        results.push(`Draft ${trimmed(match[1])}`);
      }
    }
  }

  return cleanJoinedValue(results);
}

function parseLegacySelectedVesselSpecValues(specsText) {
  const lines = splitSpecLines(specsText);
  const segments = lines.flatMap(splitSegments);
  return {
    built_imo: extractBuiltImo(lines),
    type: cleanJoinedValue(segments.map(normalizeType).filter(Boolean)),
    flag: cleanJoinedValue(segments.map(normalizeFlag).filter(Boolean)),
    class: cleanJoinedValue(segments.map(normalizeClass).filter(Boolean)),
    pni: cleanJoinedValue(extractBySegmentPatterns(lines, [/P&I/i])),
    dwt: cleanJoinedValue(extractByLinePatterns(lines, [/\b(DWT|DWCC|DWAT|DEADWEIGHT)\b/i])),
    gt_nt: cleanJoinedValue(extractBySegmentPatterns(lines, [/\b(GT|GRT|NT|NRT)\b/i])),
    dimensions: extractDimensions(lines),
    draft: extractDraft(lines),
    grain_bale: cleanJoinedValue(extractByLinePatterns(lines, [/\b(GRAIN|BALE|GR-BL|G\/B)\b/i])),
    hold_hatch: cleanJoinedValue(extractByLinePatterns(lines, [/\b(HO\/HA|\d+HO\/?\d*HA|HOLD\b|HATCH\b|CARGO HOLDS?)\b/i]).filter((line) => !/HATCH\s+COVERS?|HATCH\s+TYPE/i.test(line))),
    gear: cleanJoinedValue(extractByLinePatterns(lines, [/\b(GEARED|GEARLESS|GLESS|CRANES?)\b/i])),
    hatch_covers: cleanJoinedValue(extractByLinePatterns(lines, [/HATCH\s+COVERS?|HATCH\s+TYPE|MACGREGOR|PONTOON|SINGLE\s+PULL|FOLDING\s+TYPE|KVAERNER/i])),
    fittings: cleanJoinedValue(extractByLinePatterns(lines, [/OPEN\s+HATCH|\bBOX\b|\bSID\b|DOUBLE\s+SKIN|DOUBLE\s+HULL|BOW\s+THRUSTER|BULKHEAD|CONTAINER|REEFER|LASHING|DANGEROUS\s+GOODS|IMO\s+1\b|IMO\s+FITTED|ITF\s+FITTED|APP\.?B|TEU|EQUIPPED|GANTRY\s+CRANE/i])),
    ada: cleanJoinedValue(extractByLinePatterns(lines, [/\bADA\b/i]))
  };
}

function toPositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function sanitizeSpecRowsArray(rows, fallbackRows = []) {
  const safeRows = [];
  const used = new Set();

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const label = trimmed(row?.label || '');
    const value = trimmed(row?.value || '');
    if (!label && !value) return;

    let id = trimmed(row?.id || '');
    if (!id) id = `spec_${index + 1}`;
    while (used.has(id)) {
      id = `${id}_x`;
    }
    used.add(id);

    safeRows.push({
      id,
      enabled: row?.enabled !== false,
      order: toPositiveInt(row?.order, index + 1),
      label,
      value,
      htmlLine: toPositiveInt(row?.htmlLine, Math.floor(index / 2) + 1)
    });
  });

  if (!safeRows.length && fallbackRows.length) {
    return sanitizeSpecRowsArray(fallbackRows, []);
  }

  return safeRows
    .sort((a, b) => a.order - b.order)
    .map((row, index) => ({ ...row, order: index + 1 }));
}

function buildLegacyRowsFromObjects(vesselRecord, fieldOptions, defaultSelectedIds = [], parsedFallback = {}) {
  const selected = new Set(defaultSelectedIds);
  const rows = [];

  fieldOptions.forEach((field, index) => {
    const value = trimmed(vesselRecord?.[field.id] || parsedFallback[field.id] || '') || '-';
    const enabled = selected.size ? selected.has(field.id) : Boolean(value);
    rows.push({
      id: field.id,
      enabled,
      order: index + 1,
      label: field.label,
      value,
      htmlLine: Math.floor(index / 2) + 1
    });
  });

  return rows;
}

function sanitizeVesselSpecsMap(value, vesselOptions) {
  const result = {};
  const safeValue = value && typeof value === 'object' ? value : {};

  vesselOptions.forEach((vessel) => {
    result[vessel] = trimmed(safeValue[vessel] ?? baseConfig.vesselSpecs[vessel] ?? '');
  });

  return result;
}

function sanitizeStructuredSpecs(value, vesselOptions, fieldOptions, defaultSelectedIds = [], vesselSpecs = {}) {
  const safeValue = value && typeof value === 'object' ? value : {};
  const result = {};

  vesselOptions.forEach((vessel) => {
    const vesselRecord = safeValue[vessel] && typeof safeValue[vessel] === 'object' ? safeValue[vessel] : {};
    if (Array.isArray(vesselRecord)) {
      result[vessel] = sanitizeSpecRowsArray(vesselRecord);
      return;
    }

    const parsedFallback = parseLegacySelectedVesselSpecValues(vesselSpecs[vessel] || '');
    const legacyRows = buildLegacyRowsFromObjects(vesselRecord, fieldOptions, defaultSelectedIds, parsedFallback);
    result[vessel] = sanitizeSpecRowsArray(legacyRows);
  });

  return result;
}

function sanitizeFormDefaults(value) {
  const next = { ...clone(baseConfig.formDefaults) };
  const safeValue = value && typeof value === 'object' ? value : {};

  Object.entries(safeValue).forEach(([key, raw]) => {
    if (!(key in next)) return;
    if (typeof next[key] === 'boolean') {
      next[key] = Boolean(raw);
    } else {
      next[key] = String(raw ?? '');
    }
  });

  return next;
}

function sanitizeTermBehavior(value, termsOptions) {
  const safeValue = value && typeof value === 'object' ? value : {};
  const result = {};

  termsOptions.forEach((term) => {
    const base = BASE_TERM_BEHAVIOR[term] || {
      mode: 'laytime',
      includeLoading: true,
      includeDischarging: true,
      meaning: `${term} selected.`,
      structure: 'Selected structure: day-based loading / discharging laytime fields.'
    };
    const override = safeValue[term] && typeof safeValue[term] === 'object' ? safeValue[term] : {};
    result[term] = {
      mode: override.mode === 'text' ? 'text' : base.mode,
      includeLoading: override.includeLoading !== undefined ? Boolean(override.includeLoading) : base.includeLoading !== false,
      includeDischarging: override.includeDischarging !== undefined ? Boolean(override.includeDischarging) : base.includeDischarging !== false,
      meaning: trimmed(override.meaning || base.meaning),
      structure: trimmed(override.structure || base.structure)
    };
  });

  return result;
}

function sanitizeTermClauses(value, termsOptions) {
  const safeValue = value && typeof value === 'object' ? value : {};
  const orderedTerms = uniqueTrimmedList([...(Array.isArray(termsOptions) ? termsOptions : []), ...Object.keys(BASE_TERM_CLAUSES)]);
  const result = {};

  orderedTerms.forEach((term) => {
    const base = BASE_TERM_CLAUSES[term] || { detentionClause: '', speedClause: '' };
    const aliases = TERM_CLAUSE_ALIASES[term] || [];
    const overrideKey = [term, ...aliases].find((key) => safeValue[key] && typeof safeValue[key] === 'object');
    const override = overrideKey ? safeValue[overrideKey] : {};

    result[term] = {
      detentionClause: override.detentionClause !== undefined ? String(override.detentionClause ?? '') : base.detentionClause,
      speedClause: override.speedClause !== undefined ? String(override.speedClause ?? '') : base.speedClause
    };
  });

  return result;
}

export function loadRuntimeCustomization() {
  try {
    const raw = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function sanitizeCustomization(value) {
  const source = value && typeof value === 'object' ? value : {};

  const vesselOptions = uniqueTrimmedList(source.vesselOptions || baseConfig.vesselOptions);
  const vesselSpecFieldOptions = sanitizeFieldOptions(source.vesselSpecFieldOptions || baseConfig.vesselSpecFieldOptions);
  const vesselSpecs = sanitizeVesselSpecsMap(source.vesselSpecs || baseConfig.vesselSpecs, vesselOptions);
  const defaultSelectedIds = String(source?.formDefaults?.selectedVesselSpecFields || LEGACY_DEFAULT_SELECTED_SPEC_FIELDS.join(','))
    .split(',')
    .map((item) => trimmed(item))
    .filter(Boolean);
  const vesselStructuredSpecs = sanitizeStructuredSpecs(source.vesselStructuredSpecs || {}, vesselOptions, vesselSpecFieldOptions, defaultSelectedIds, vesselSpecs);

  return {
    vesselOptions,
    vesselSpecs,
    vesselStructuredSpecs,
    underDeckOptions: uniqueTrimmedList(source.underDeckOptions || baseConfig.underDeckOptions),
    cargoStackableOptions: uniqueTrimmedList(source.cargoStackableOptions || baseConfig.cargoStackableOptions),
    currencyOptions: uniqueTrimmedList(source.currencyOptions || baseConfig.currencyOptions),
    freightTermsOptions: uniqueTrimmedList(source.freightTermsOptions || baseConfig.freightTermsOptions),
    termsOptions: uniqueTrimmedList(source.termsOptions || baseConfig.termsOptions),
    laytimeTermsOptions: uniqueTrimmedList(source.laytimeTermsOptions || baseConfig.laytimeTermsOptions),
    agentOptions: uniqueTrimmedList(source.agentOptions || baseConfig.agentOptions),
    formDefaults: sanitizeFormDefaults(source.formDefaults || baseConfig.formDefaults),
    termBehavior: sanitizeTermBehavior(source.termBehavior || source.TERM_BEHAVIOR || {}, uniqueTrimmedList(source.termsOptions || baseConfig.termsOptions)),
    termClauses: sanitizeTermClauses(source.termClauses || source.TERM_CLAUSES || {}, uniqueTrimmedList(source.termsOptions || baseConfig.termsOptions))
  };
}

function notifyCustomizationListeners(snapshot, meta = {}) {
  const safe = clone(snapshot);
  customizationListeners.forEach((listener) => {
    try {
      listener(safe, meta);
    } catch (error) {
      console.error('Customization listener failed:', error);
    }
  });
}

export function saveRuntimeCustomization(value, options = {}) {
  const { source = 'unknown' } = options;
  const safe = sanitizeCustomization(value);

  try {
    localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(safe));
  } catch (_) {}

  if (customizationChannel) {
    try {
      customizationChannel.postMessage({ type: 'replace', payload: safe, meta: { source } });
    } catch (_) {}
  }

  notifyCustomizationListeners(safe, { type: 'replace', source });
  return safe;
}

export function clearRuntimeCustomization(options = {}) {
  const { source = 'unknown' } = options;
  try {
    localStorage.removeItem(CUSTOMIZATION_STORAGE_KEY);
  } catch (_) {}

  if (customizationChannel) {
    try {
      customizationChannel.postMessage({ type: 'clear', meta: { source } });
    } catch (_) {}
  }

  notifyCustomizationListeners(getRuntimeConfig(), { type: 'clear', source });
}

export function getRuntimeTermBehavior() {
  const customization = loadRuntimeCustomization();
  const termsOptions = uniqueTrimmedList(customization.termsOptions || baseConfig.termsOptions);
  return sanitizeTermBehavior(customization.termBehavior || customization.TERM_BEHAVIOR || {}, termsOptions);
}

export function getRuntimeTermClauses() {
  const customization = loadRuntimeCustomization();
  const termsOptions = uniqueTrimmedList(customization.termsOptions || baseConfig.termsOptions);
  return sanitizeTermClauses(customization.termClauses || customization.TERM_CLAUSES || {}, termsOptions);
}

export function getRuntimeConfig() {
  const customization = sanitizeCustomization({ ...baseConfig, ...loadRuntimeCustomization() });
  return {
    ...clone(baseConfig),
    ...clone(customization),
    termBehavior: clone(customization.termBehavior),
    termClauses: clone(customization.termClauses)
  };
}

export function subscribeToRuntimeCustomization(listener, options = {}) {
  const { immediate = true } = options;
  customizationListeners.add(listener);

  if (immediate) {
    listener(getRuntimeConfig(), { type: 'subscribe', source: 'config' });
  }

  return () => customizationListeners.delete(listener);
}

async function readResponseJson(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function buildRemoteErrorMessage(response, payload, fallback) {
  const message = trimmed(payload?.error || payload?.message || fallback);
  return message || `${fallback} (${response.status})`;
}

export async function syncRuntimeCustomizationFromServer(options = {}) {
  const { force = false } = options;

  if (remoteCustomizationSyncPromise && !force) {
    return remoteCustomizationSyncPromise;
  }

  const run = (async () => {
    if (typeof fetch !== 'function') {
      return {
        ok: false,
        configured: false,
        writable: false,
        customization: null,
        message: 'Fetch is not available in this environment.'
      };
    }

    let response;
    try {
      response = await fetch(REMOTE_CUSTOMIZATION_ENDPOINT, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
    } catch (error) {
      return {
        ok: false,
        configured: false,
        writable: false,
        customization: null,
        message: error.message || 'Shared customization request failed.'
      };
    }

    const payload = await readResponseJson(response);

    if (!response.ok) {
      throw new Error(buildRemoteErrorMessage(response, payload, 'Shared customization request failed.'));
    }

    if (payload?.configured === false) {
      return {
        ok: true,
        configured: false,
        writable: false,
        customization: null,
        message: trimmed(payload?.message || 'Shared storage is not configured.'),
        meta: payload?.meta || {}
      };
    }

    const remoteCustomization = payload?.customization && typeof payload.customization === 'object' && !Array.isArray(payload.customization)
      ? payload.customization
      : null;

    if (remoteCustomization) {
      const saved = saveRuntimeCustomization(remoteCustomization, { source: 'server-sync' });
      return {
        ok: true,
        configured: true,
        writable: payload?.writable !== false,
        customization: saved,
        message: trimmed(payload?.message || 'Shared customization loaded.'),
        meta: payload?.meta || {}
      };
    }

    clearRuntimeCustomization({ source: 'server-sync' });
    return {
      ok: true,
      configured: true,
      writable: payload?.writable !== false,
      customization: null,
      message: trimmed(payload?.message || 'No shared customization has been saved yet.'),
      meta: payload?.meta || {}
    };
  })();

  remoteCustomizationSyncPromise = run.finally(() => {
    if (remoteCustomizationSyncPromise === wrapped) {
      remoteCustomizationSyncPromise = null;
    }
  });

  const wrapped = remoteCustomizationSyncPromise;
  return force ? run : wrapped;
}

export async function pushRuntimeCustomizationToServer(value, adminPassword = '') {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch is not available in this environment.');
  }

  const safe = sanitizeCustomization(value);
  const safePassword = trimmed(adminPassword);
  const response = await fetch(REMOTE_CUSTOMIZATION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-customize-password': safePassword
    },
    body: JSON.stringify({
      customization: safe,
      adminPassword: safePassword
    })
  });

  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(buildRemoteErrorMessage(response, payload, 'Shared customization save failed.'));
  }

  const saved = saveRuntimeCustomization(payload?.customization || safe, { source: 'server-save' });
  return {
    ...payload,
    customization: saved
  };
}

export async function resetRuntimeCustomizationOnServer(adminPassword = '') {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch is not available in this environment.');
  }

  const response = await fetch(REMOTE_CUSTOMIZATION_ENDPOINT, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'x-customize-password': trimmed(adminPassword)
    }
  });

  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(buildRemoteErrorMessage(response, payload, 'Shared customization reset failed.'));
  }

  clearRuntimeCustomization({ source: 'server-reset' });
  return payload || { ok: true };
}

if (customizationChannel) {
  customizationChannel.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'replace') {
      notifyCustomizationListeners(getRuntimeConfig(), { type: 'replace', source: message.meta?.source || 'broadcast' });
    }
    if (message.type === 'clear') {
      notifyCustomizationListeners(getRuntimeConfig(), { type: 'clear', source: message.meta?.source || 'broadcast' });
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== CUSTOMIZATION_STORAGE_KEY) return;
    notifyCustomizationListeners(getRuntimeConfig(), { type: 'storage', source: 'storage' });
  });
}
