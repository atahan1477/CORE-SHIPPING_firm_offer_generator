import { trimmed } from './offer-logic.js';

const TEMPLATE_KEY = 'coreShippingTemplatesV1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const DEFAULT_TEMPLATE_ID = 'firm-offer-default-v1';

export function getDefaultTemplate() {
  return {
    id: DEFAULT_TEMPLATE_ID,
    name: 'Firm Offer Default',
    documentType: 'firm_offer',
    blocks: [
      { id: 'core-commercial-terms', type: 'section', title: 'Commercial Terms', required: true },
      { id: 'core-agents', type: 'section', title: 'Agents', required: true },
      { id: 'core-extra-clauses', type: 'clause_group', title: 'Additional Clauses', required: false },
      { id: 'core-final-clauses', type: 'clause_group', title: 'Final Clauses', required: true }
    ]
  };
}

export function getDefaultClauseLibrary() {
  return [
    {
      id: 'clause-sub-all-further-terms',
      title: 'Sub all further terms / conditions',
      text: 'Sub all further terms / conditions',
      category: 'final',
      tags: ['standard', 'closing']
    },
    {
      id: 'clause-current-tariffs-indication',
      title: 'Current tariffs indication',
      text: 'Indication is based on current tariffs for load/disch costs and d/as',
      category: 'final',
      tags: ['standard', 'tariff']
    }
  ];
}

export function loadTemplateLibrary() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) {
      return {
        templates: [getDefaultTemplate()],
        clauses: getDefaultClauseLibrary()
      };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {
        templates: [getDefaultTemplate()],
        clauses: getDefaultClauseLibrary()
      };
    }

    const templates = Array.isArray(parsed.templates) && parsed.templates.length
      ? parsed.templates
      : [getDefaultTemplate()];

    const clauses = Array.isArray(parsed.clauses)
      ? parsed.clauses
      : getDefaultClauseLibrary();

    return { templates: clone(templates), clauses: clone(clauses) };
  } catch (_) {
    return {
      templates: [getDefaultTemplate()],
      clauses: getDefaultClauseLibrary()
    };
  }
}

export function saveTemplateLibrary(library = {}) {
  const safe = {
    templates: Array.isArray(library.templates) && library.templates.length
      ? clone(library.templates)
      : [getDefaultTemplate()],
    clauses: Array.isArray(library.clauses)
      ? clone(library.clauses)
      : getDefaultClauseLibrary()
  };

  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(safe));
  return safe;
}

export function buildClauseBlocksFromLegacy(extraClausesText = '', finalClauseText = '') {
  const extra = String(extraClausesText || '')
    .split(/\n+/)
    .map((line) => trimmed(line))
    .filter(Boolean)
    .map((text, index) => ({
      id: `extra_${index + 1}`,
      type: 'custom_text',
      source: 'legacy-extra',
      title: '',
      text,
      order: index + 1
    }));

  const final = String(finalClauseText || '')
    .split(/\n+/)
    .map((line) => trimmed(line))
    .filter(Boolean)
    .map((text, index) => ({
      id: `final_${index + 1}`,
      type: 'custom_text',
      source: 'legacy-final',
      title: '',
      text,
      order: extra.length + index + 1
    }));

  return [...extra, ...final];
}
