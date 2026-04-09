import { config } from '../shared/config.js';
import {
  buildAutoVesselSpecs,
  buildEmailText,
  buildHtmlEmailDocument,
  buildMailtoUrl,
  getTermBehavior,
  trimmed
} from '../shared/offer-logic.js';
import {
  getSharedState,
  replaceSharedState,
  subscribeToSharedState
} from '../shared/store.js';

const APP_SOURCE = `firm-offer-app:${Math.random().toString(36).slice(2)}`;
const THEME_STORAGE_KEY = 'firmOfferGeneratorTheme';

const form = document.getElementById('offerForm');
const subjectPreview = document.getElementById('subjectPreview');
const emailPreview = document.getElementById('emailPreview');
const toPreview = document.getElementById('toPreview');
const ccPreview = document.getElementById('ccPreview');
const statusEl = document.getElementById('status');
const laytimeFields = document.getElementById('laytimeFields');
const fltFields = document.getElementById('fltFields');
const congestionRow = document.getElementById('congestionRow');
const congestionToggleLabel = document.getElementById('congestionToggleLabel');
const loadingTextLabel = document.getElementById('loadingTextLabel');
const dischargingTextLabel = document.getElementById('dischargingTextLabel');
const termMeaningNote = document.getElementById('termMeaningNote');
const termStructureNote = document.getElementById('termStructureNote');
const vesselSelect = document.getElementById('vessel');
const vesselSpecsField = document.getElementById('vesselSpecs');
const themeToggle = document.getElementById('themeToggle');
const htmlPreviewFrame = document.getElementById('htmlPreviewFrame');

const fieldElements = Array.from(form.querySelectorAll('input[name], select[name], textarea[name]'));
const fieldNames = fieldElements.map((element) => element.name);

let currentView = 'raw';
let vesselSpecsDirty = false;
let isApplyingExternalState = false;

function fillSelect(id, options, selectedValue) {
  const select = document.getElementById(id);
  if (!select) return;

  select.innerHTML = '';
  options.forEach((option) => {
    const el = document.createElement('option');
    el.value = option;
    el.textContent = option;
    if (option === selectedValue) el.selected = true;
    select.appendChild(el);
  });
}

function initializeSelects() {
  fillSelect('vessel', config.vesselOptions, config.defaults.vessel);
  fillSelect('underDeck', config.underDeckOptions, config.defaults.underDeck);
  fillSelect('cargoStackable', config.cargoStackableOptions, config.defaults.cargoStackable);
  fillSelect('currency', config.currencyOptions, config.defaults.currency);
  fillSelect('freightTerms', config.freightTermsOptions, config.defaults.freightTerms);
  fillSelect('terms', config.termsOptions, config.defaults.terms);
  fillSelect('loadingTerms', config.laytimeTermsOptions, config.defaults.loadingTerms);
  fillSelect('dischargingTerms', config.laytimeTermsOptions, config.defaults.dischargingTerms);
  fillSelect('agentLoad', config.agentOptions, config.defaults.agentLoad);
  fillSelect('agentDischarge', config.agentOptions, config.defaults.agentDischarge);
}

function getFieldElement(name) {
  return form.elements.namedItem(name);
}

function collectFormData() {
  const data = Object.fromEntries(new FormData(form).entries());

  fieldElements.forEach((element) => {
    if (element.type === 'checkbox') {
      data[element.name] = element.checked;
    } else if (!(element.name in data)) {
      data[element.name] = element.value;
    }
  });

  return data;
}

function applySnapshotToForm(snapshot) {
  isApplyingExternalState = true;

  try {
    fieldNames.forEach((name) => {
      const element = getFieldElement(name);
      if (!element || !(name in snapshot)) return;

      if (element.type === 'checkbox') {
        element.checked = Boolean(snapshot[name]);
      } else if (element.value !== String(snapshot[name] ?? '')) {
        element.value = String(snapshot[name] ?? '');
      }
    });

    const selectedVessel = vesselSelect?.value || '';
    const currentSpecs = vesselSpecsField?.value || '';
    const autoSpecs = buildAutoVesselSpecs(selectedVessel, config.vesselSpecs);
    vesselSpecsDirty = Boolean(currentSpecs && currentSpecs !== autoSpecs);
  } finally {
    isApplyingExternalState = false;
  }
}

function syncVesselSpecsFromSelection(force = false) {
  if (!vesselSpecsField || !vesselSelect) return;
  if (vesselSpecsDirty && !force) return;

  vesselSpecsField.value = buildAutoVesselSpecs(vesselSelect.value, config.vesselSpecs);
  vesselSpecsDirty = false;
}

function updateConditionalUI() {
  const selectedTerm = document.getElementById('terms').value;
  const behavior = getTermBehavior(selectedTerm);
  const isTextMode = behavior.mode === 'text';

  laytimeFields.classList.toggle('hidden', isTextMode);
  fltFields.classList.toggle('hidden', !isTextMode);
  congestionRow.classList.toggle('hidden', !isTextMode);

  if (congestionToggleLabel) {
    congestionToggleLabel.textContent = `Include congestion clause when ${selectedTerm} is selected`;
  }

  const loadingDaysLabel = document.querySelector('label[for="loadingDays"]');
  const dischargingDaysLabel = document.querySelector('label[for="dischargingDays"]');

  if (loadingTextLabel) {
    loadingTextLabel.textContent = `${selectedTerm} loading text`;
  }

  if (dischargingTextLabel) {
    dischargingTextLabel.textContent = `${selectedTerm} discharging text`;
  }

  if (loadingDaysLabel) {
    loadingDaysLabel.textContent = `${selectedTerm} loading days`;
  }

  if (dischargingDaysLabel) {
    dischargingDaysLabel.textContent = `${selectedTerm} discharging days`;
  }

  if (termMeaningNote) {
    termMeaningNote.textContent = behavior.meaning;
  }

  if (termStructureNote) {
    termStructureNote.textContent = behavior.structure;
  }
}

function buildHtmlPreviewDocument() {
  const html = buildHtmlEmailDocument(collectFormData());
  const isDarkTheme = document.body.getAttribute('data-theme') === 'dark';
  const previewCanvas = isDarkTheme ? '#101926' : '#eef3f7';
  const previewText = isDarkTheme ? '#dbe6f3' : '#17314f';
  const previewEdge = isDarkTheme ? '#31445d' : '#d7e0eb';

  const previewStyle = `
        <style>
          :root {
            color-scheme: ${isDarkTheme ? 'dark' : 'light'};
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            min-height: 100% !important;
            overflow-x: hidden !important;
            background: ${previewCanvas} !important;
            color: ${previewText} !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }

          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }

          body {
            font-family: Arial, Helvetica, sans-serif !important;
            -webkit-font-smoothing: antialiased !important;
          }

          table {
            max-width: 100% !important;
          }

          table[width="760"] {
            width: min(760px, calc(100vw - 24px)) !important;
            max-width: min(760px, calc(100vw - 24px)) !important;
            box-shadow: 0 14px 30px rgba(15, 23, 36, ${isDarkTheme ? 0.34 : 0.10}) !important;
          }

          td {
            box-sizing: border-box !important;
            word-break: break-word !important;
          }

          img {
            max-width: 100% !important;
            height: auto !important;
          }

          body > table[role="presentation"] {
            background: ${previewCanvas} !important;
          }

          body > table[role="presentation"] > tbody > tr > td > table[role="presentation"] {
            border-color: ${previewEdge} !important;
          }
        </style>
      `;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${previewStyle}</head>`);
  }

  return html.replace(/<body/i, `<head>${previewStyle}</head><body`);
}

function refreshHtmlPreview() {
  htmlPreviewFrame.setAttribute('scrolling', 'yes');
  htmlPreviewFrame.srcdoc = buildHtmlPreviewDocument();
}

function refreshPreview() {
  updateConditionalUI();

  const data = collectFormData();
  const emailText = buildEmailText(data);

  subjectPreview.textContent = emailText.subject;
  toPreview.textContent = trimmed(data.emailTo) || '—';
  ccPreview.textContent = trimmed(data.emailCc) || '—';
  emailPreview.textContent = emailText.body;

  if (!htmlPreviewFrame.classList.contains('hidden')) {
    refreshHtmlPreview();
  }
}

function showStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) statusEl.textContent = '';
  }, 2600);
}

function refreshThemeSensitiveUI() {
  refreshPreview();

  const rawPreview = document.getElementById('emailPreview');
  const resolvedColor = getComputedStyle(rawPreview).color;
  rawPreview.style.webkitTextFillColor = resolvedColor;

  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      selection.removeAllRanges();
    }
  }

  rawPreview.style.display = 'none';
  void rawPreview.offsetHeight;
  rawPreview.style.display = '';

  if (currentView === 'html') {
    requestAnimationFrame(() => refreshHtmlPreview());
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', normalizedTheme);
  document.documentElement.setAttribute('data-theme', normalizedTheme);
  themeToggle.checked = normalizedTheme === 'dark';
}

function initializeTheme() {
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (_) {}

  if (savedTheme === 'dark' || savedTheme === 'light') {
    applyTheme(savedTheme);
    refreshThemeSensitiveUI();
    return;
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
  refreshThemeSensitiveUI();
}

function switchView(view) {
  currentView = view;
  const isHtml = view === 'html';

  document.getElementById('tabRaw').classList.toggle('active', !isHtml);
  document.getElementById('tabHtml').classList.toggle('active', isHtml);
  document.getElementById('btnGroupRaw').classList.toggle('hidden', isHtml);
  document.getElementById('btnGroupHtml').classList.toggle('hidden', !isHtml);
  document.getElementById('emailPreview').classList.toggle('hidden', isHtml);
  document.getElementById('previewModeLabel').textContent = isHtml ? 'HTML rendered view' : 'Raw text view';

  htmlPreviewFrame.classList.toggle('hidden', !isHtml);

  if (isHtml) refreshHtmlPreview();
}

function pushWholeFormToStore() {
  replaceSharedState(collectFormData(), {
    source: APP_SOURCE
  });
}

function initializeSharedState() {
  const defaultSnapshot = collectFormData();
  const persistedState = getSharedState();

  if (Object.keys(persistedState).length) {
    const merged = { ...defaultSnapshot, ...persistedState };
    applySnapshotToForm(merged);
  } else {
    replaceSharedState(defaultSnapshot, {
      source: APP_SOURCE,
      broadcast: false
    });
  }

  subscribeToSharedState((nextState, meta = {}) => {
    if (meta.source === APP_SOURCE) return;

    const merged = { ...collectFormData(), ...nextState };
    applySnapshotToForm(merged);
    refreshPreview();
  });
}

function handleAnyInput(event) {
  if (isApplyingExternalState) return;

  const target = event.target;
  if (!target || !('name' in target)) return;

  if (target.id === 'vessel') {
    syncVesselSpecsFromSelection(true);
  }

  if (target.id === 'vesselSpecs') {
    const autoSpecs = buildAutoVesselSpecs(vesselSelect.value, config.vesselSpecs);
    vesselSpecsDirty = vesselSpecsField.value !== autoSpecs;
  }

  pushWholeFormToStore();
  refreshPreview();
}

initializeSelects();
syncVesselSpecsFromSelection(true);
initializeSharedState();
initializeTheme();
refreshPreview();

vesselSelect.addEventListener('change', () => {
  if (isApplyingExternalState) return;
  syncVesselSpecsFromSelection(true);
  pushWholeFormToStore();
  refreshPreview();
});

vesselSpecsField.addEventListener('input', () => {
  if (isApplyingExternalState) return;
  const autoSpecs = buildAutoVesselSpecs(vesselSelect.value, config.vesselSpecs);
  vesselSpecsDirty = vesselSpecsField.value !== autoSpecs;
  pushWholeFormToStore();
  refreshPreview();
});

form.addEventListener('input', handleAnyInput);
form.addEventListener('change', handleAnyInput);

themeToggle.addEventListener('change', () => {
  const nextTheme = themeToggle.checked ? 'dark' : 'light';
  applyTheme(nextTheme);
  refreshThemeSensitiveUI();

  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (_) {}
});

document.getElementById('tabRaw').addEventListener('click', () => switchView('raw'));
document.getElementById('tabHtml').addEventListener('click', () => switchView('html'));

document.getElementById('copyRawBtn').addEventListener('click', async () => {
  try {
    const emailText = buildEmailText(collectFormData());
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(emailText.body);
      showStatus('Raw mail copied to clipboard.');
    } else {
      showStatus('Clipboard not available in this browser.');
    }
  } catch (error) {
    showStatus('Copy failed: ' + (error.message || error));
  }
});

document.getElementById('openDraftBtn').addEventListener('click', () => {
  window.location.href = buildMailtoUrl(collectFormData(), { includeBody: true });
  showStatus('Opening email draft…');
});

document.getElementById('copyHtmlBtn').addEventListener('click', async () => {
  try {
    const htmlDoc = buildHtmlEmailDocument(collectFormData());
    const bodyMatch = htmlDoc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const htmlFrag = bodyMatch ? bodyMatch[1].trim() : htmlDoc;
    const emailText = buildEmailText(collectFormData());

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlFrag], { type: 'text/html' }),
          'text/plain': new Blob([emailText.body], { type: 'text/plain' })
        })
      ]);
      showStatus('HTML mail copied — paste into Outlook compose.');
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(emailText.body);
      showStatus('Copied as plain text (browser limited HTML clipboard).');
    } else {
      showStatus('Clipboard not available in this browser.');
    }
  } catch (error) {
    showStatus('Copy failed: ' + (error.message || error));
  }
});

document.getElementById('openDraftHtmlBtn').addEventListener('click', async () => {
  try {
    const htmlDoc = buildHtmlEmailDocument(collectFormData());
    const bodyMatch = htmlDoc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const htmlFrag = bodyMatch ? bodyMatch[1].trim() : htmlDoc;
    const emailText = buildEmailText(collectFormData());

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlFrag], { type: 'text/html' }),
          'text/plain': new Blob([emailText.body], { type: 'text/plain' })
        })
      ]);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(emailText.body);
    }
  } catch (_) {}

  window.location.href = buildMailtoUrl(collectFormData(), { includeBody: false });
  showStatus('Draft opened · HTML copied to clipboard → paste into body.');
});
