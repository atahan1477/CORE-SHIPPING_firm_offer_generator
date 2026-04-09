const STORAGE_KEY = 'coreShippingBrevoFeedMakerV1';
const OUTPUT_FILENAME = 'core_shipping_open_positions_sample.json';

const ROOT_FIELDS = [
  'brand_label',
  'campaign_title',
  'issue_date',
  'preheader_text',
  'intro_text',
  'contact_email',
  'contact_phone',
  'website_url',
  'website_label',
  'linkedin_url',
  'youtube_url',
  'cta_title',
  'cta_text',
  'cta_url',
  'cta_button_label',
  'company_name',
  'company_address_line_1',
  'company_address_line_2'
];

const POSITION_FIELDS = ['vessel_name', 'dwcc', 'cbft', 'open_port', 'open_date', 'spec_url'];
const SPEC_FIELDS = ['vessel_name', 'dwcc', 'cbft', 'hold_details', 'tt_strength', 'note_1', 'note_2', 'note_3', 'spec_url'];

const sampleData = {
  brand_label: 'CORE SHIPPING',
  campaign_title: 'Open Coaster Positions',
  issue_date: '02/04/2026',
  preheader_text: 'Current open coaster positions from Core Shipping.',
  intro_text: 'Please find below our current open coaster positions. We would be pleased to receive your suitable cargo ideas and enquiries.',
  contact_email: 'chartering@core-shipping.com',
  contact_phone: '+90 (216) 392 20 10',
  website_url: 'https://www.core-shipping.com',
  website_label: 'www.core-shipping.com',
  linkedin_url: 'https://www.linkedin.com/company/core-shipping/',
  youtube_url: 'https://www.youtube.com/',
  cta_title: 'Firm and Prompt Enquiries Welcome',
  cta_text: 'Please contact our chartering desk for suitable cargo ideas and prompt business opportunities.',
  cta_url: 'mailto:chartering@core-shipping.com',
  cta_button_label: 'Contact Chartering',
  company_name: 'Core Shipping',
  company_address_line_1: 'Bagdat Cad, Turab Sok, No: 06/06',
  company_address_line_2: '34744, Istanbul, Turkey',
  positions: [
    {
      vessel_name: 'MV HELEN ANNA',
      dwcc: '3480',
      cbft: '162,000',
      open_port: 'MARMARA',
      open_date: '03/04',
      spec_url: 'https://example.com/helen-anna-spec'
    },
    {
      vessel_name: 'MV VENTURA',
      dwcc: '3500',
      cbft: '185,000',
      open_port: 'ARAG',
      open_date: '30/03',
      spec_url: 'https://example.com/ventura-spec'
    },
    {
      vessel_name: 'MV VITALITY',
      dwcc: '3800',
      cbft: '210,000',
      open_port: 'PORTUGAL',
      open_date: '31/04',
      spec_url: 'https://example.com/vitality-spec'
    }
  ],
  specs: [
    {
      vessel_name: 'MV HELEN ANNA',
      dwcc: '3550',
      cbft: '162,000',
      hold_details: '1 Hold - 56.55 x 10.02 x 8.10m',
      tt_strength: 'TT Strength 15.00 mt/m²',
      note_1: 'SID / Fully Box',
      note_2: 'Equipped with lashing materials',
      note_3: '2 moveable bulkheads',
      spec_url: 'https://example.com/helen-anna-spec'
    },
    {
      vessel_name: 'MV VENTURA',
      dwcc: '3600',
      cbft: '185,000',
      hold_details: '1 Hold - 61.57 x 10.12 x 8.43m',
      tt_strength: 'TT Strength 15.00 mt/m²',
      note_1: 'SID / Fully Box',
      note_2: 'Equipped with lashing materials',
      note_3: '2 moveable bulkheads',
      spec_url: 'https://example.com/ventura-spec'
    },
    {
      vessel_name: 'MV VITALITY',
      dwcc: '3750',
      cbft: '210,581',
      hold_details: '1 Hold - 61.50 x 12.65 x 7.90m',
      tt_strength: 'TT Strength 15.00 mt/m²',
      note_1: 'SID / Fully Box',
      note_2: 'Cement holes',
      note_3: '2 moveable bulkheads',
      spec_url: 'https://example.com/vitality-spec'
    }
  ]
};

const rootInputs = Object.fromEntries(ROOT_FIELDS.map((field) => [field, document.getElementById(field)]));
const positionsList = document.getElementById('positionsList');
const specsList = document.getElementById('specsList');
const positionTemplate = document.getElementById('positionTemplate');
const specTemplate = document.getElementById('specTemplate');
const jsonPreview = document.getElementById('jsonPreview');
const statusEl = document.getElementById('status');
const addPositionBtn = document.getElementById('addPositionBtn');
const addSpecBtn = document.getElementById('addSpecBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#9a2f2f' : '#166a52';
}

function persistDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFeedData()));
  } catch (_) {
    // ignore storage failures
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function createCard(template, fields, values = {}) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.firstElementChild;

  fields.forEach((field) => {
    const input = card.querySelector(`[data-field="${field}"]`);
    input.value = values[field] || '';
    input.addEventListener('input', handleAnyInput);
  });

  card.querySelector('.remove-item-btn').addEventListener('click', () => {
    card.remove();
    refreshCardNumbers();
    updatePreviewAndPersist('Item removed.');
  });

  return card;
}

function refreshCardNumbers() {
  [...positionsList.children].forEach((card, index) => {
    card.querySelector('.item-number').textContent = index + 1;
  });
  [...specsList.children].forEach((card, index) => {
    card.querySelector('.item-number').textContent = index + 1;
  });
}

function addPosition(values = {}) {
  positionsList.appendChild(createCard(positionTemplate, POSITION_FIELDS, values));
  refreshCardNumbers();
}

function addSpec(values = {}) {
  specsList.appendChild(createCard(specTemplate, SPEC_FIELDS, values));
  refreshCardNumbers();
}

function fillRootFields(data) {
  ROOT_FIELDS.forEach((field) => {
    rootInputs[field].value = data[field] || '';
  });
}

function clearRepeaters() {
  positionsList.innerHTML = '';
  specsList.innerHTML = '';
}

function applyData(data) {
  fillRootFields(data);
  clearRepeaters();

  const positions = Array.isArray(data.positions) ? data.positions : [];
  const specs = Array.isArray(data.specs) ? data.specs : [];

  if (positions.length) {
    positions.forEach((item) => addPosition(item));
  } else {
    addPosition();
  }

  if (specs.length) {
    specs.forEach((item) => addSpec(item));
  } else {
    addSpec();
  }

  refreshCardNumbers();
  updatePreviewAndPersist('JSON updated.');
}

function readCardList(container, fields) {
  return [...container.children]
    .map((card) => {
      const entry = {};
      fields.forEach((field) => {
        entry[field] = (card.querySelector(`[data-field="${field}"]`)?.value || '').trim();
      });
      return entry;
    })
    .filter((entry) => Object.values(entry).some((value) => value !== ''));
}

function collectFeedData() {
  const data = {};

  ROOT_FIELDS.forEach((field) => {
    data[field] = (rootInputs[field]?.value || '').trim();
  });

  data.positions = readCardList(positionsList, POSITION_FIELDS);
  data.specs = readCardList(specsList, SPEC_FIELDS);

  return data;
}

function renderJson(data) {
  return JSON.stringify(data, null, 2);
}

function updatePreviewAndPersist(message = 'JSON updated.') {
  const data = collectFeedData();
  jsonPreview.textContent = renderJson(data);
  persistDraft();
  setStatus(message);
}

function handleAnyInput() {
  updatePreviewAndPersist();
}

async function copyJson() {
  const json = renderJson(collectFeedData());
  try {
    await navigator.clipboard.writeText(json);
    setStatus('JSON copied to clipboard.');
  } catch (_) {
    setStatus('Copy failed. Please copy from the preview box manually.', true);
  }
}

function downloadJson() {
  const json = renderJson(collectFeedData());
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = OUTPUT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${OUTPUT_FILENAME}.`);
}

function clearAll() {
  const emptyData = {
    ...Object.fromEntries(ROOT_FIELDS.map((field) => [field, ''])),
    positions: [Object.fromEntries(POSITION_FIELDS.map((field) => [field, '']))],
    specs: [Object.fromEntries(SPEC_FIELDS.map((field) => [field, '']))]
  };
  applyData(emptyData);
  setStatus('All fields cleared.');
}

ROOT_FIELDS.forEach((field) => {
  rootInputs[field].addEventListener('input', handleAnyInput);
});

addPositionBtn.addEventListener('click', () => {
  addPosition();
  refreshCardNumbers();
  updatePreviewAndPersist('New position row added.');
});

addSpecBtn.addEventListener('click', () => {
  addSpec();
  refreshCardNumbers();
  updatePreviewAndPersist('New spec row added.');
});

copyJsonBtn.addEventListener('click', copyJson);
downloadJsonBtn.addEventListener('click', downloadJson);
loadSampleBtn.addEventListener('click', () => {
  applyData(clone(sampleData));
  setStatus('Sample Brevo feed loaded.');
});
clearAllBtn.addEventListener('click', clearAll);

const savedDraft = loadDraft();
if (savedDraft) {
  applyData(savedDraft);
  setStatus('Saved draft restored.');
} else {
  applyData(clone(sampleData));
  setStatus('Sample loaded.');
}
