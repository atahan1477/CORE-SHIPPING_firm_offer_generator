import { getRuntimeTermBehavior } from './config.js';

export function trimmed(value) {
  return (value || '').trim();
}

export function vesselFinal(value) {
  const vessel = trimmed(value);
  if (!vessel) return '';
  if (vessel === 'CORE TBN' || /\bor sub\b/i.test(vessel)) return vessel;
  return `${vessel} or sub`;
}

export function buildAutoVesselSpecs(vessel, vesselSpecsMap = {}) {
  const base = trimmed(vessel);
  const specs = trimmed(vesselSpecsMap[base] || '');
  if (!base || !specs) return '';
  const separator = base.length > 16 ? '----------------------' : '---------------';
  return `${vesselFinal(base).toUpperCase()}\n${separator}\n${specs}`;
}

export function parseSelectedSpecFieldIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => trimmed(item)).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => trimmed(item))
    .filter(Boolean);
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
  if (
    /CLASS/.test(upper)
    || /^KR\(IACS\)$/i.test(segment)
    || /^PRS$/i.test(segment)
    || /^INMB$/i.test(segment)
    || /^PHRS$/i.test(segment)
    || /KOREAN REGISTER/i.test(segment)
    || /BULGARIAN CLASS/i.test(segment)
  ) {
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

export function parseSelectedVesselSpecValues(specsText) {
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

function normalizeRow(row, index) {
  return {
    id: trimmed(row?.id || `spec_${index + 1}`),
    enabled: row?.enabled !== false,
    order: Number(row?.order) > 0 ? Number(row.order) : index + 1,
    label: trimmed(row?.label || ''),
    value: trimmed(row?.value || ''),
    htmlLine: Number(row?.htmlLine) > 0 ? Number(row.htmlLine) : Math.floor(index / 2) + 1
  };
}

export function getVesselSpecRows(vessel, runtimeConfig) {
  const base = trimmed(vessel);
  if (!base) return [];

  const rows = Array.isArray(runtimeConfig?.vesselStructuredSpecs?.[base])
    ? runtimeConfig.vesselStructuredSpecs[base]
    : [];

  return rows
    .map(normalizeRow)
    .filter((row) => row.label || row.value)
    .sort((a, b) => a.order - b.order);
}

export function buildVesselSpecsBlocks(vessel, runtimeConfig) {
  const base = trimmed(vessel);
  if (!base) return { raw: '', html: '' };

  const enabledRows = getVesselSpecRows(base, runtimeConfig).filter((row) => row.enabled);
  if (!enabledRows.length) return { raw: '', html: '' };

  const separator = base.length > 16 ? '----------------------' : '---------------';
  const rawLines = enabledRows.map((row) => `${row.label || '-'}: ${row.value || '-'}`);
  const htmlGroups = new Map();
  enabledRows.forEach((row) => {
    const lineNo = row.htmlLine || 1;
    if (!htmlGroups.has(lineNo)) htmlGroups.set(lineNo, []);
    htmlGroups.get(lineNo).push(`${row.label || '-'}: ${row.value || '-'}`);
  });
  const htmlLines = Array.from(htmlGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, items]) => items.join(' '));

  return {
    raw: `${vesselFinal(base).toUpperCase()}\n${separator}\n${rawLines.join('\n')}`,
    html: `${vesselFinal(base).toUpperCase()}\n${separator}\n${htmlLines.join('\n')}`
  };
}

export function normalizePort(value, suffix) {
  const port = trimmed(value);
  const portSuffix = trimmed(suffix);
  if (!port) return '';
  if (!portSuffix) return port;

  const lowerPort = port.toLowerCase();
  const lowerSuffix = portSuffix.toLowerCase();

  if (lowerPort.endsWith(', ' + lowerSuffix) || lowerPort.endsWith(lowerSuffix)) {
    return port;
  }

  return `${port}, ${portSuffix}`;
}

export function freightFinal(currency, amount, terms) {
  return `${trimmed(currency)} ${trimmed(amount)} ${trimmed(terms)}`.trim();
}

export function demdetFinal(currency, amount) {
  return `${trimmed(currency)} ${trimmed(amount)} pdpr/fd`.trim();
}

export function commissionFinal(value) {
  const cleaned = trimmed(value);
  if (!cleaned) return '';
  if (cleaned.startsWith('%')) return `${cleaned} ttl commission`;
  return `%${cleaned} ttl commission`;
}

export function clauseLinesFromText(value) {
  return trimmed(value)
    .split(/\n+/)
    .map((line) => trimmed(line).replace(/^=\s*/, ''))
    .filter(Boolean);
}

export function getTermBehavior(term) {
  const termBehavior = getRuntimeTermBehavior();
  return termBehavior[trimmed(term)] || {
    mode: 'laytime',
    includeLoading: true,
    includeDischarging: true,
    meaning: `${trimmed(term)} selected.`,
    structure: 'Selected structure: day-based loading / discharging laytime fields.'
  };
}

export function isTextModeTerm(term) {
  return getTermBehavior(term).mode === 'text';
}

export function autoSubject(data) {
  const vessel = vesselFinal(data.vessel) || 'Core TBN';
  const pol = trimmed(data.pol) || 'POL';
  const pod = trimmed(data.pod) || 'POD';
  const laycan = trimmed(data.laycanDate) || 'Laycan TBA';
  return `${vessel} / ${pol} - ${pod} / ${laycan} / firm offer`;
}

export function buildSignature(data) {
  const parts = [
    trimmed(data.signOff),
    trimmed(data.senderName),
    trimmed(data.senderTitle),
    '',
    trimmed(data.companyName),
    trimmed(data.companyAddress),
    '',
    trimmed(data.senderMobile) ? `M: ${trimmed(data.senderMobile)}` : '',
    trimmed(data.senderDirect) ? `D: ${trimmed(data.senderDirect)}` : '',
    trimmed(data.senderEmail) ? `E-mail: ${trimmed(data.senderEmail)}` : '',
    trimmed(data.senderWeb)
  ];

  return parts
    .filter((part, index, arr) => part !== '' || (arr[index - 1] !== '' && arr[index + 1] !== undefined))
    .join('\n');
}

export function buildOfferText(data) {
  const behavior = getTermBehavior(data.terms);
  const isTextMode = behavior.mode === 'text';
  const includeLoading = behavior.includeLoading !== false;
  const includeDischarging = behavior.includeDischarging !== false;
  const polSuffix = trimmed(data.polSuffix) || trimmed(data.terminalSuffix);
  const podSuffix = trimmed(data.podSuffix) || trimmed(data.terminalSuffix);
  const loadingFinal = isTextMode
    ? trimmed(data.fltLoadingText) || 'As fast as vessel can load'
    : `${trimmed(data.loadingDays)} days ${trimmed(data.loadingTerms)}`.trim();
  const dischargingFinal = isTextMode
    ? trimmed(data.fltDischargingText) || 'As fast as vessel can discharge'
    : `${trimmed(data.dischargingDays)} days ${trimmed(data.dischargingTerms)}`.trim();

  const lines = [
    `Vessel: ${vesselFinal(data.vessel)}`,
    `Account: ${trimmed(data.account)}`,
    `Cargo: ${trimmed(data.cargo)}`,
    `${trimmed(data.underDeck)}`,
    `${trimmed(data.cargoStackable)}`,
    `${trimmed(data.pcBasis || 'P/c basis')}`,
    `Lay/can: ${trimmed(data.laycanDate)}`,
    `POL: ${normalizePort(data.pol, polSuffix)}`,
    `POD: ${normalizePort(data.pod, podSuffix)}`,
    `Freight: ${freightFinal(data.currency, data.freightAmount, data.freightTerms)}`,
    `Terms: ${trimmed(data.terms)}`,
    `Dem/Det: ${demdetFinal(data.currency, data.demdetAmount)}`
  ];

  if (includeLoading) {
    lines.push(`Loading: ${loadingFinal}`);
  }

  if (includeDischarging) {
    lines.push(`Discharging: ${dischargingFinal}`);
  }

  if (isTextMode && data.includeCongestion && trimmed(data.congestionClause)) {
    lines.push(trimmed(data.congestionClause));
  }

  lines.push(
    `Owners agents at load port: ${trimmed(data.agentLoad)}`,
    `Owners agents at discharge port: ${trimmed(data.agentDischarge)}`
  );

  const commission = commissionFinal(data.commissionPercentage);
  if (commission) {
    lines.push(commission);
  }

  if (trimmed(data.applicableContract)) {
    lines.push(trimmed(data.applicableContract));
  }

  const extraClauses = clauseLinesFromText(data.extraClauses);
  if (extraClauses.length) {
    lines.push(...extraClauses);
  }

  const finalClauses = clauseLinesFromText(data.finalClause);
  if (finalClauses.length) {
    lines.push(...finalClauses);
  }

  return lines
    .filter((line) => trimmed(line))
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n');
}

export function buildEmailText(data) {
  const subject = trimmed(data.emailSubject) || autoSubject(data);
  const offerText = buildOfferText(data);
  const vesselSpecs = data.includeVesselSpecs ? trimmed(data.vesselSpecs) : '';

  const blocks = [
    trimmed(data.greeting),
    '',
    trimmed(data.openingParagraph),
    '',
    trimmed(data.markerLine),
    vesselSpecs ? '' : '',
    vesselSpecs,
    vesselSpecs ? '' : '',
    trimmed(data.forLine),
    '',
    offerText,
    '',
    trimmed(data.endOfferLine),
    '',
    trimmed(data.closingParagraph),
    '',
    buildSignature(data)
  ];

  const cleaned = blocks.filter((part, index, arr) => {
    if (part !== '') return true;
    return arr[index - 1] !== '' && arr[index + 1] !== undefined && arr[index + 1] !== '';
  });

  return {
    subject,
    body: cleaned.join('\n')
  };
}

export function buildComputedOffer(data) {
  const behavior = getTermBehavior(data.terms);
  const isTextMode = behavior.mode === 'text';
  const includeLoading = behavior.includeLoading !== false;
  const includeDischarging = behavior.includeDischarging !== false;
  const polSuffix = trimmed(data.polSuffix) || trimmed(data.terminalSuffix);
  const podSuffix = trimmed(data.podSuffix) || trimmed(data.terminalSuffix);
  const loadingFinal = isTextMode
    ? trimmed(data.fltLoadingText) || 'As fast as vessel can load'
    : `${trimmed(data.loadingDays)} days ${trimmed(data.loadingTerms)}`.trim();
  const dischargingFinal = isTextMode
    ? trimmed(data.fltDischargingText) || 'As fast as vessel can discharge'
    : `${trimmed(data.dischargingDays)} days ${trimmed(data.dischargingTerms)}`.trim();

  return {
    subject: trimmed(data.emailSubject) || autoSubject(data),
    vessel: vesselFinal(data.vessel),
    account: trimmed(data.account),
    cargo: trimmed(data.cargo),
    stowage: trimmed(data.underDeck),
    stackability: trimmed(data.cargoStackable),
    basis: trimmed(data.pcBasis || 'P/c basis'),
    laycan: trimmed(data.laycanDate),
    pol: normalizePort(data.pol, polSuffix),
    pod: normalizePort(data.pod, podSuffix),
    freight: freightFinal(data.currency, data.freightAmount, data.freightTerms),
    terms: trimmed(data.terms),
    demdet: demdetFinal(data.currency, data.demdetAmount),
    includeLoading,
    includeDischarging,
    loading: includeLoading ? loadingFinal : '',
    discharging: includeDischarging ? dischargingFinal : '',
    congestion: isTextMode && data.includeCongestion ? trimmed(data.congestionClause) : '',
    agentLoad: trimmed(data.agentLoad),
    agentDischarge: trimmed(data.agentDischarge),
    commission: commissionFinal(data.commissionPercentage),
    applicableContract: trimmed(data.applicableContract),
    extraClauses: clauseLinesFromText(data.extraClauses),
    finalClauses: clauseLinesFromText(data.finalClause),
    finalClause: trimmed(data.finalClause),
    vesselSpecs: data.includeVesselSpecs ? trimmed(data.vesselSpecs) : '',
    vesselSpecsHtml: data.includeVesselSpecs ? trimmed(data.vesselSpecsHtml || data.vesselSpecs) : '',
    markerLine: trimmed(data.markerLine),
    forLine: trimmed(data.forLine),
    greeting: trimmed(data.greeting),
    openingParagraph: trimmed(data.openingParagraph),
    endOfferLine: trimmed(data.endOfferLine),
    closingParagraph: trimmed(data.closingParagraph),
    signature: buildSignature(data)
  };
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function textToHtml(value) {
  return escapeHtml(trimmed(value)).replace(/\n/g, '<br />');
}

export function parseVesselSpecs(specsText) {
  const lines = trimmed(specsText)
    .split(/\n+/)
    .map((line) => trimmed(line))
    .filter(Boolean);

  let title = '';
  if (lines.length && !/^[-\s]+$/.test(lines[0])) {
    title = lines.shift();
  }
  if (lines.length && /^[-\s]+$/.test(lines[0])) {
    lines.shift();
  }

  return { title, lines };
}

export function buildTermsRowsHtml(details) {
  const rows = [
    ['Vessel', details.vessel],
    ['Account', details.account],
    ['Cargo', details.cargo],
    ['Stowage', details.stowage],
    ['Stackability', details.stackability],
    ['Basis', details.basis],
    ['Lay/can', details.laycan],
    ['POL', details.pol],
    ['POD', details.pod],
    ['Freight', details.freight],
    ['Terms', details.terms],
    ['Dem/Det', details.demdet]
  ];

  if (details.includeLoading !== false) {
    rows.push(['Loading', details.loading]);
  }
  if (details.includeDischarging !== false) {
    rows.push(['Discharging', details.discharging]);
  }

  if (details.congestion) {
    rows.push(['Congestion', details.congestion]);
  }

  rows.push(
    ['Owners agents at load port', details.agentLoad],
    ['Owners agents at discharge port', details.agentDischarge]
  );

  if (details.commission) {
    rows.push(['Commission', details.commission]);
  }

  if (details.applicableContract) {
    rows.push(['Applicable contract', details.applicableContract]);
  }

  return rows
    .filter(([, value]) => trimmed(value))
    .map(([label, value], rowIndex) => `
                <tr>
                  <td width="29%" style="padding:12px 16px; border-bottom:1px solid #dbe4ee; background-color:${rowIndex % 2 === 0 ? '#f8fbff' : '#f3f7fc'}; font-size:13px; font-weight:700; color:#30465f; vertical-align:top;">${escapeHtml(label)}</td>
                  <td width="71%" style="padding:12px 16px; border-bottom:1px solid #dbe4ee; background-color:#ffffff; font-size:14px; line-height:1.65; color:#132f4b;">${textToHtml(value)}</td>
                </tr>`)
    .join('');
}

export function buildHtmlEmailDocument(data) {
  const details = buildComputedOffer(data);
  const vesselSpecs = parseVesselSpecs(details.vesselSpecsHtml || details.vesselSpecs);

  const vesselSpecsSection = vesselSpecs.lines.length
    ? `
          <tr>
            <td class="email-pad" style="padding:12px 32px 0 32px;">
              <table role="presentation" class="stack-table" cellpadding="0" cellspacing="0" border="0" width="52%" align="left" style="border-collapse:separate; border-spacing:0; width:52%;">
                <tr>
                  <td style="padding:0;">
                    <div style="border:1px solid #cad7e4; border-radius:14px; overflow:hidden; background:linear-gradient(180deg, #f7fafc 0%, #ffffff 100%); box-shadow:0 6px 18px rgba(15, 39, 66, 0.06);">
                      <div style="padding:14px 18px; background-color:#edf4fb; border-bottom:1px solid #d4deea;">
                        <div style="font-size:18px; font-weight:700; color:#0f2742;">${escapeHtml(vesselSpecs.title || 'Vessel Particulars')}</div>
                      </div>
                      <div style="padding:14px 18px; font-size:14px; line-height:1.75; color:#17314e;">
                        ${vesselSpecs.lines.map((line) => `<div style="margin:0 0 6px 0;">${textToHtml(line)}</div>`).join('')}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : '';

  const additionalClausesSection = (details.extraClauses.length || details.finalClauses.length)
    ? `
          <tr>
            <td class="email-pad" style="padding:12px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #cad7e4; border-collapse:collapse;">
                <tr>
                  <td style="padding:14px 18px; background-color:#edf4fb; border-bottom:1px solid #cad7e4;">
                    <div style="font-size:18px; font-weight:700; color:#0f2742;">Additional Clauses</div>
                  </td>
                </tr>
                ${(details.extraClauses || []).map((line) => `
                <tr>
                  <td style="padding:11px 18px; border-bottom:1px solid #e2e8ef; font-size:14px; line-height:1.6; color:#17314e;">${textToHtml(line)}</td>
                </tr>`).join('')}
                ${(details.finalClauses || []).map((line) => `
                <tr>
                  <td style="padding:11px 18px; font-size:14px; line-height:1.6; color:#17314e; font-weight:600;">${textToHtml(line)}</td>
                </tr>`).join('')}
              </table>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(details.subject)}</title>
  <style>
    @media only screen and (max-width: 680px) {
      .email-wrap {
        width: 100% !important;
        max-width: 100% !important;
      }

      .email-pad {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }

      .email-title {
        font-size: 21px !important;
      }

      .email-subject {
        font-size: 12px !important;
        line-height: 1.55 !important;
      }

      .email-copy {
        font-size: 14px !important;
        line-height: 1.7 !important;
      }

      .stack-table {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f3f5f7; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(details.subject)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f5f7; margin:0; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-wrap" cellpadding="0" cellspacing="0" border="0" width="760" style="width:760px; max-width:760px; background-color:#ffffff; border:1px solid #d6e0ea; border-collapse:separate; border-spacing:0; border-radius:14px; overflow:hidden;">
          <tr>
            <td class="email-pad" style="padding:28px 32px 20px 32px; background:linear-gradient(180deg, #0f2742 0%, #14375b 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" class="email-title" style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:0.3px;">CORE SHIPPING</td>
                  <td align="right" style="color:#c8d5e3; font-size:12px; text-transform:uppercase; letter-spacing:1.2px;">Firm Offer</td>
                </tr>
                <tr>
                  <td colspan="2" class="email-subject" style="padding-top:10px; color:#dbe5ef; font-size:13px; line-height:1.6;">
                    Subject: ${escapeHtml(details.subject)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-pad email-copy" style="padding:26px 32px 8px 32px; font-size:15px; line-height:1.75; color:#17314e;">
              ${textToHtml(details.greeting)}<br><br>
              ${textToHtml(details.openingParagraph)}
            </td>
          </tr>

          <tr>
            <td class="email-pad" style="padding:0 32px 0 32px; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#6b7c8f; font-weight:700;">
              ${escapeHtml(details.markerLine || '++')}
            </td>
          </tr>

          ${vesselSpecsSection}

          <tr>
            <td class="email-pad" style="padding:12px 32px 0 32px;">
              <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#6b7c8f; font-weight:700; padding:0 0 8px 2px;">
                ${escapeHtml(details.forLine || 'For')}
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #cad7e4; border-collapse:collapse;">
                <tr>
                  <td colspan="2" style="padding:14px 18px; background-color:#edf4fb; border-bottom:1px solid #cad7e4;">
                    <div style="font-size:18px; font-weight:700; color:#0f2742;">Commercial Terms</div>
                  </td>
                </tr>
                ${buildTermsRowsHtml(details)}
              </table>
            </td>
          </tr>

          ${additionalClausesSection}

          <tr>
            <td class="email-pad email-copy" style="padding:14px 32px 0 32px; font-size:14px; line-height:1.8; color:#17314e;">
              ${textToHtml(details.endOfferLine || 'End offer')}<br><br>
              ${textToHtml(details.closingParagraph)}
            </td>
          </tr>

          <tr>
            <td class="email-pad email-copy" style="padding:24px 32px 32px 32px; font-size:14px; line-height:1.8; color:#17314e;">
              ${textToHtml(details.signature)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildMailtoUrl(data, options = {}) {
  const emailText = buildEmailText(data);
  const to = encodeURIComponent(trimmed(data.emailTo));
  const params = [];

  if (trimmed(data.emailCc)) {
    params.push(`cc=${encodeURIComponent(trimmed(data.emailCc))}`);
  }

  params.push(`subject=${encodeURIComponent(emailText.subject)}`);

  if (options.includeBody !== false) {
    params.push(`body=${encodeURIComponent(emailText.body)}`);
  }

  return `mailto:${to}${params.length ? `?${params.join('&')}` : ''}`;
}
