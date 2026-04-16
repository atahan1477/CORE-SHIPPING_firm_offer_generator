import { getRuntimeConfig, subscribeToRuntimeCustomization, syncRuntimeCustomizationFromServer } from '../shared/config.js';
import {
  buildEmailText,
  buildHtmlEmailDocument,
  buildMailtoUrl,
  buildVesselSpecsBlocks,
  getTermBehavior,
  trimmed
} from '../shared/offer-logic.js';
import {
  fromLegacyFormData,
  toLegacyRenderInput
} from '../shared/document-model.js';
import {
  createDocumentFromDraft,
  saveDocumentVersion,
  listDocumentVersions,
  compareDocumentVersions,
  updateDocumentStatus,
  buildCertifiedExportMetadata
} from '../shared/document-store.js';
import {
  getSharedState,
  replaceSharedState,
  subscribeToSharedState
} from '../shared/store.js';

const APP_SOURCE = `firm-offer-app:${Math.random().toString(36).slice(2)}`;
const THEME_STORAGE_KEY = 'coreShippingTheme';
const LEGACY_THEME_STORAGE_KEY = 'firmOfferGeneratorTheme';
const LEGACY_APPLICABLE_CONTRACT_TEXT = 'Clean Gencon 94 to apply';
const UPDATED_APPLICABLE_CONTRACT_TEXT = 'Carriers BN';
const CUSTOMIZATION_SIGNATURE_KEY = 'coreShippingCustomizationSignatureV1';

let runtimeConfig = getRuntimeConfig();

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
const loadingDaysField = document.getElementById('loadingDaysField');
const loadingTermsField = document.getElementById('loadingTermsField');
const dischargingDaysField = document.getElementById('dischargingDaysField');
const dischargingTermsField = document.getElementById('dischargingTermsField');
const fltLoadingField = document.getElementById('fltLoadingField');
const fltDischargingField = document.getElementById('fltDischargingField');
const vesselSelect = document.getElementById('vessel');
const includeVesselSpecsInput = document.getElementById('includeVesselSpecs');
const vesselSpecsField = document.getElementById('vesselSpecs');
const vesselSpecsHtmlField = document.getElementById('vesselSpecsHtml');
const vesselSpecsPreview = document.getElementById('vesselSpecsPreview');
const htmlPreviewFrame = document.getElementById('htmlPreviewFrame');

const fieldElements = Array.from(form.querySelectorAll('input[name], select[name], textarea[name]'));
const fieldNames = fieldElements.map((element) => element.name);

let currentView = 'raw';
let isApplyingExternalState = false;
let lastSharedStateSignature = '';
let currentDocumentId = '';
let currentDraft = null;

function currentDefaults() {
  return runtimeConfig.formDefaults || {};
}

function fillSelect(id, options, selectedValue) {
  const select = document.getElementById(id);
  if (!select) return;

  const safeOptions = Array.isArray(options) && options.length ? options : [selectedValue || ''];
  const finalSelected = safeOptions.includes(selectedValue) ? selectedValue : safeOptions[0] || '';

  select.innerHTML = '';
  safeOptions.forEach((option) => {
    const el = document.createElement('option');
    el.value = option;
    el.textContent = option;
    if (option === finalSelected) el.selected = true;
    select.appendChild(el);
  });
}

function initializeSelects(preferredValues = {}) {
  const defaults = currentDefaults();
  fillSelect('vessel', runtimeConfig.vesselOptions, preferredValues.vessel || defaults.vessel);
  fillSelect('underDeck', runtimeConfig.underDeckOptions, preferredValues.underDeck || defaults.underDeck);
  fillSelect('cargoStackable', runtimeConfig.cargoStackableOptions, preferredValues.cargoStackable || defaults.cargoStackable);
  fillSelect('currency', runtimeConfig.currencyOptions, preferredValues.currency || defaults.currency);
  fillSelect('freightTerms', runtimeConfig.freightTermsOptions, preferredValues.freightTerms || defaults.freightTerms);
  fillSelect('terms', runtimeConfig.termsOptions, preferredValues.terms || defaults.terms);
  fillSelect('loadingTerms', runtimeConfig.laytimeTermsOptions, preferredValues.loadingTerms || defaults.loadingTerms);
  fillSelect('dischargingTerms', runtimeConfig.laytimeTermsOptions, preferredValues.dischargingTerms || defaults.dischargingTerms);
  fillSelect('agentLoad', runtimeConfig.agentOptions, preferredValues.agentLoad || defaults.agentLoad);
  fillSelect('agentDischarge', runtimeConfig.agentOptions, preferredValues.agentDischarge || defaults.agentDischarge);
}

function applyTextDefaults(preferredValues = {}) {
  const defaults = { ...currentDefaults(), ...preferredValues };

  fieldElements.forEach((element) => {
    if (!element.name || element.tagName === 'SELECT') return;
    if (!(element.name in defaults)) return;

    if (element.type === 'checkbox') {
      element.checked = Boolean(defaults[element.name]);
    } else {
      element.value = String(defaults[element.name] ?? '');
    }
  });
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

function collectCanonicalDraft() {
  const legacyData = collectFormData();
  currentDraft = fromLegacyFormData(legacyData, runtimeConfig);
  return currentDraft;
}

function getRenderInput() {
  return toLegacyRenderInput(collectCanonicalDraft());
}

function migrateLegacyFormState(snapshot) {
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const migrated = { ...safeSnapshot };

  if (trimmed(migrated.applicableContract) === LEGACY_APPLICABLE_CONTRACT_TEXT) {
    migrated.applicableContract = UPDATED_APPLICABLE_CONTRACT_TEXT;
  }

  const legacySuffix = trimmed(migrated.terminalSuffix);
  if (!trimmed(migrated.polSuffix) && legacySuffix) {
    migrated.polSuffix = legacySuffix;
  }
  if (!trimmed(migrated.podSuffix) && legacySuffix) {
    migrated.podSuffix = legacySuffix;
  }

  return migrated;
}

function syncStructuredVesselSpecs() {
  if (!vesselSpecsField || !vesselSelect) return;

  const generatedBlocks = buildVesselSpecsBlocks(vesselSelect.value, runtimeConfig);
  vesselSpecsField.value = generatedBlocks.raw;
  if (vesselSpecsHtmlField) {
    vesselSpecsHtmlField.value = generatedBlocks.html;
  }
  includeVesselSpecsInput.checked = Boolean(trimmed(generatedBlocks.raw));

  if (vesselSpecsPreview) {
    vesselSpecsPreview.textContent = generatedBlocks.raw || 'No enabled structured spec rows for the selected vessel.';
  }
}

function applySnapshotToForm(snapshot) {
  isApplyingExternalState = true;

  try {
    fieldNames.forEach((name) => {
      const element = getFieldElement(name);
      if (!element || !(name in snapshot)) return;

      if (element.tagName === 'SELECT') return;

      if (element.type === 'checkbox') {
        element.checked = Boolean(snapshot[name]);
      } else {
        element.value = String(snapshot[name] ?? '');
      }
    });

    initializeSelects(snapshot);
    syncStructuredVesselSpecs();
  } finally {
    isApplyingExternalState = false;
  }
}

function updateConditionalUI() {
  const selectedTerm = document.getElementById('terms').value;
  const behavior = getTermBehavior(selectedTerm);
  const isTextMode = behavior.mode === 'text';
  const includeLoading = behavior.includeLoading !== false;
  const includeDischarging = behavior.includeDischarging !== false;

  laytimeFields.classList.toggle('hidden', isTextMode);
  fltFields.classList.toggle('hidden', !isTextMode);
  congestionRow.classList.toggle('hidden', !isTextMode);
  if (loadingDaysField) loadingDaysField.classList.toggle('hidden', !includeLoading);
  if (loadingTermsField) loadingTermsField.classList.toggle('hidden', !includeLoading);
  if (dischargingDaysField) dischargingDaysField.classList.toggle('hidden', !includeDischarging);
  if (dischargingTermsField) dischargingTermsField.classList.toggle('hidden', !includeDischarging);
  if (fltLoadingField) fltLoadingField.classList.toggle('hidden', !includeLoading);
  if (fltDischargingField) fltDischargingField.classList.toggle('hidden', !includeDischarging);

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
  const html = buildHtmlEmailDocument(getRenderInput());
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

async function copyHtmlForRichPaste(htmlDocument) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(htmlDocument, 'text/html');
  const htmlFragment = parsed.body?.innerHTML || htmlDocument;
  const plainText = parsed.body?.innerText || '';

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/html': new Blob([htmlFragment], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    return true;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(htmlFragment);
    return false;
  }

  return false;
}

function refreshHtmlPreview() {
  htmlPreviewFrame.setAttribute('scrolling', 'yes');
  htmlPreviewFrame.srcdoc = buildHtmlPreviewDocument();
}

function refreshPreview() {
  updateConditionalUI();
  syncStructuredVesselSpecs();

  const data = getRenderInput();
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

function saveCurrentVersionFromUI() {
  try {
    const draft = collectCanonicalDraft();
    if (!currentDocumentId) {
      const doc = createDocumentFromDraft(draft, {
        title: draft.metadata.title
      });
      currentDocumentId = doc.id;
    }

    const saved = saveDocumentVersion(currentDocumentId, draft, {
      createdBy: 'local-user',
      updatedBy: 'local-user'
    });
    showStatus(`Saved version v${saved.version}.`);
  } catch (error) {
    console.error(error);
    showStatus('Save version failed.');
  }
}

function compareLatestVersionsFromUI() {
  if (!currentDocumentId) {
    showStatus('No document available for compare yet.');
    return;
  }

  try {
    const versions = listDocumentVersions(currentDocumentId);
    if (versions.length < 2) {
      showStatus('Need at least 2 versions to compare.');
      return;
    }

    const latest = versions[versions.length - 1];
    const previous = versions[versions.length - 2];
    const comparison = compareDocumentVersions(currentDocumentId, previous.version, latest.version);
    if (!comparison.hasChanges) {
      showStatus(`Compared v${previous.version} vs v${latest.version}: no changes.`);
      return;
    }
    showStatus(`Compared v${previous.version}→v${latest.version}: ${comparison.changedFields.join(', ')}`);
  } catch (error) {
    console.error(error);
    showStatus('Compare failed.');
  }
}

function initializeDocumentDraft() {
  const draft = collectCanonicalDraft();
  const doc = createDocumentFromDraft(draft, {
    title: draft.metadata.title
  });
  currentDocumentId = doc.id;
  saveDocumentVersion(currentDocumentId, draft, {
    createdBy: 'local-user',
    updatedBy: 'local-user'
  });
}

function injectDocumentControls() {
  const btnGroupRaw = document.getElementById('btnGroupRaw');
  const viewBar = document.querySelector('.view-bar');
  if (!btnGroupRaw || !viewBar) return;

  const saveVersionBtn = document.createElement('button');
  saveVersionBtn.type = 'button';
  saveVersionBtn.className = 'secondary';
  saveVersionBtn.id = 'saveVersionBtn';
  saveVersionBtn.textContent = 'Save Version';
  saveVersionBtn.addEventListener('click', saveCurrentVersionFromUI);

  const compareBtn = document.createElement('button');
  compareBtn.type = 'button';
  compareBtn.className = 'secondary';
  compareBtn.id = 'compareVersionsBtn';
  compareBtn.textContent = 'Compare Latest';
  compareBtn.addEventListener('click', compareLatestVersionsFromUI);

  const statusSelect = document.createElement('select');
  statusSelect.id = 'docStatusSelect';
  statusSelect.style.maxWidth = '180px';
  ['draft', 'internal_review', 'approved', 'final'].forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status.replace('_', ' ');
    statusSelect.appendChild(option);
  });
  statusSelect.addEventListener('change', () => {
    if (!currentDocumentId) return;
    try {
      updateDocumentStatus(currentDocumentId, statusSelect.value, { updatedBy: 'local-user' });
      const metadata = buildCertifiedExportMetadata(currentDocumentId);
      showStatus(`Status updated to ${metadata.status}.`);
    } catch (error) {
      console.error(error);
      showStatus('Status update failed.');
    }
  });

  btnGroupRaw.prepend(compareBtn);
  btnGroupRaw.prepend(saveVersionBtn);
  viewBar.appendChild(statusSelect);
}

function refreshThemeSensitiveUI() {
  refreshPreview();

  const rawPreview = document.getElementById('emailPreview');
  const resolvedColor = getComputedStyle(rawPreview).color;
  rawPreview.style.webkitTextFillColor = resolvedColor;

  if (currentView === 'html') {
    requestAnimationFrame(() => refreshHtmlPreview());
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', normalizedTheme);
  document.documentElement.setAttribute('data-theme', normalizedTheme);
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

  try {
    const legacyTheme = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacyTheme === 'dark' || legacyTheme === 'light') {
      localStorage.setItem(THEME_STORAGE_KEY, legacyTheme);
      applyTheme(legacyTheme);
      refreshThemeSensitiveUI();
      return;
    }
  } catch (_) {}

  applyTheme('light');
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
  const snapshot = collectFormData();
  const signature = JSON.stringify(snapshot);
  if (signature === lastSharedStateSignature) return;
  lastSharedStateSignature = signature;

  replaceSharedState(snapshot, {
    source: APP_SOURCE
  });
}


function currentCustomizationSignature() {
  return JSON.stringify(currentDefaults());
}

function customizationDefaultsChanged() {
  const currentSignature = currentCustomizationSignature();

  try {
    const previousSignature = localStorage.getItem(CUSTOMIZATION_SIGNATURE_KEY);
    localStorage.setItem(CUSTOMIZATION_SIGNATURE_KEY, currentSignature);
    if (previousSignature === null) {
      return true;
    }

    return previousSignature !== currentSignature;
  } catch (_) {
    return false;
  }
}

function initializeSharedState(options = {}) {
  const { forceDefaults = false } = options;
  const defaultSnapshot = collectFormData();
  const persistedState = forceDefaults ? {} : migrateLegacyFormState(getSharedState());

  if (Object.keys(persistedState).length) {
    const merged = { ...defaultSnapshot, ...persistedState };
    applySnapshotToForm(merged);
    lastSharedStateSignature = JSON.stringify(collectFormData());
    replaceSharedState(collectFormData(), {
      source: APP_SOURCE,
      broadcast: false
    });
  } else {
    replaceSharedState(defaultSnapshot, {
      source: APP_SOURCE,
      broadcast: false
    });
    lastSharedStateSignature = JSON.stringify(defaultSnapshot);
  }

  subscribeToSharedState((nextState, meta = {}) => {
    if (meta.source === APP_SOURCE) return;

    const merged = { ...collectFormData(), ...migrateLegacyFormState(nextState) };
    applySnapshotToForm(merged);
    refreshPreview();
  });
}

function reinitializeForCustomizationChange() {
  const currentData = collectFormData();
  runtimeConfig = getRuntimeConfig();

  initializeSelects(currentData);
  applyTextDefaults(currentData);
  syncStructuredVesselSpecs();
  pushWholeFormToStore();
  refreshPreview();
}

function handleAnyInput(event) {
  if (isApplyingExternalState) return;

  const target = event.target;
  if (!target || !('name' in target)) return;

  if (target.id === 'vessel') {
    syncStructuredVesselSpecs();
  }

  pushWholeFormToStore();
  refreshPreview();
}

runtimeConfig = getRuntimeConfig();
initializeSelects();
applyTextDefaults();
syncStructuredVesselSpecs();
initializeSharedState({ forceDefaults: customizationDefaultsChanged() });
initializeDocumentDraft();
injectDocumentControls();
initializeTheme();
refreshPreview();

(async () => {
  try {
    const result = await syncRuntimeCustomizationFromServer({ force: false });
    if (result.configured && result.customization) {
      showStatus('Shared customization loaded.');
    }
  } catch (error) {
    console.error('Shared customization load failed:', error);
  }
})();

subscribeToRuntimeCustomization((_, meta = {}) => {
  if (meta.source === APP_SOURCE) return;
  reinitializeForCustomizationChange();
}, { immediate: false });

form.addEventListener('input', handleAnyInput);
form.addEventListener('change', handleAnyInput);

window.addEventListener('storage', (event) => {
  if (event.key === THEME_STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
    applyTheme(event.newValue);
    refreshThemeSensitiveUI();
  }
});

document.getElementById('tabRaw').addEventListener('click', () => switchView('raw'));
document.getElementById('tabHtml').addEventListener('click', () => switchView('html'));

document.getElementById('copyRawBtn').addEventListener('click', async () => {
  try {
    const emailText = buildEmailText(getRenderInput());
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(emailText.body);
      showStatus('Raw mail copied to clipboard.');
    } else {
      showStatus('Clipboard not available in this browser.');
    }
  } catch (_) {
    showStatus('Copy failed.');
  }
});

document.getElementById('copyHtmlBtn').addEventListener('click', async () => {
  try {
    const html = buildHtmlEmailDocument(getRenderInput());
    const copiedRichHtml = await copyHtmlForRichPaste(html);
    if (copiedRichHtml) {
      showStatus('HTML mail copied as rich content (paste-ready).');
    } else if (navigator.clipboard?.writeText) {
      showStatus('HTML copied as text only. Rich paste may not be supported in this browser.');
    } else {
      showStatus('Clipboard not available in this browser.');
    }
  } catch (_) {
    showStatus('Copy failed.');
  }
});

document.getElementById('openDraftBtn').addEventListener('click', () => {
  const url = buildMailtoUrl(getRenderInput(), { includeBody: true });
  window.location.href = url;
});

document.getElementById('openDraftHtmlBtn').addEventListener('click', async () => {
  const formData = getRenderInput();
  const html = buildHtmlEmailDocument(formData);
  let copiedRichHtml = false;
  let copyFailed = false;

  try {
    copiedRichHtml = await copyHtmlForRichPaste(html);
  } catch (_) {
    copyFailed = true;
  }

  const url = buildMailtoUrl(formData, { includeBody: false });
  window.location.href = url;

  if (copiedRichHtml) {
    showStatus('Draft opened. HTML is copied as rich content and ready to paste.');
  } else if (copyFailed) {
    showStatus('Draft opened, but copy failed. Paste may require manual copy from HTML Preview.');
  } else {
    showStatus('Draft opened. HTML copied as text only; rich paste may not be supported here.');
  }
});
