import {
  baseConfig,
  getRuntimeConfig,
  saveRuntimeCustomization,
  clearRuntimeCustomization,
  syncRuntimeCustomizationFromServer,
  pushRuntimeCustomizationToServer,
  resetRuntimeCustomizationOnServer
} from '../shared/config.js';

const optionGroups = [
  { key: 'underDeckOptions', label: 'Under deck wording options' },
  { key: 'cargoStackableOptions', label: 'Cargo stackable wording options' },
  { key: 'currencyOptions', label: 'Freight currency options' },
  { key: 'freightTermsOptions', label: 'Freight terms options' },
  { key: 'termsOptions', label: 'Terms options' },
  { key: 'laytimeTermsOptions', label: 'Laytime terms options' },
  { key: 'agentOptions', label: 'Agent options' }
];

const statusEl = document.getElementById('status');
const adminPasswordInput = document.getElementById('adminPassword');
const vesselSelect = document.getElementById('customizerVesselSelect');
const vesselNameInput = document.getElementById('customizerVesselName');
const rawSpecsInput = document.getElementById('customizerRawSpecs');
const structuredSpecsGrid = document.getElementById('structuredSpecsGrid');
const addSpecRowBtn = document.getElementById('addSpecRowBtn');
const optionEditors = document.getElementById('optionEditors');
const termBehaviorList = document.getElementById('termBehaviorList');
const defaultsJson = document.getElementById('defaultsJson');
const customizationJson = document.getElementById('customizationJson');
const currentPreview = document.getElementById('currentPreview');

let working = createWorkingCopy(getRuntimeConfig());
let selectedVessel = working.vesselOptions[0] || '';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#a53434' : '#166a52';
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = '';
      statusEl.style.color = '#166a52';
    }
  }, 3600);
}

function createWorkingCopy(source) {
  const next = clone(source);
  next.termBehavior = clone(source.termBehavior || {});
  next.vesselStructuredSpecs = clone(source.vesselStructuredSpecs || {});
  return next;
}

function createSpecRow(index = 0) {
  return {
    id: `spec_${Date.now()}_${index}`,
    order: index + 1,
    label: '',
    value: '-',
    htmlLine: Math.floor(index / 2) + 1
  };
}

function ensureVesselRecord(vessel) {
  if (!working.vesselSpecs[vessel]) working.vesselSpecs[vessel] = '';
  if (!Array.isArray(working.vesselStructuredSpecs[vessel])) {
    const legacy = working.vesselStructuredSpecs[vessel];
    if (legacy && typeof legacy === 'object') {
      working.vesselStructuredSpecs[vessel] = Object.entries(legacy).map(([key, value], index) => ({
        id: key,
        order: index + 1,
        label: key,
        value: String(value ?? '').trim(),
        htmlLine: Math.floor(index / 2) + 1
      }));
    } else {
      working.vesselStructuredSpecs[vessel] = [];
    }
  }
}

function ensureTermBehaviorRecords() {
  working.termsOptions.forEach((term) => {
    if (!working.termBehavior[term]) {
      working.termBehavior[term] = {
        mode: 'laytime',
        meaning: `${term} selected.`,
        structure: 'Selected structure: day-based loading / discharging laytime fields.'
      };
    }
  });
}

function alignAllVesselRowsToTemplate() {
  const vessels = Array.isArray(working.vesselOptions) ? working.vesselOptions.filter(Boolean) : [];
  if (!vessels.length) return;

  vessels.forEach((vessel) => ensureVesselRecord(vessel));

  const templateVessel = vessels.find((vessel) => (working.vesselStructuredSpecs[vessel] || []).length > 0) || vessels[0];
  const templateRows = (working.vesselStructuredSpecs[templateVessel] || [])
    .slice()
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    .map((row, index) => ({
      id: String(row?.id || `spec_${index + 1}`),
      order: index + 1,
      label: String(row?.label || '').trim(),
      htmlLine: Math.max(1, Number.parseInt(row?.htmlLine, 10) || (Math.floor(index / 2) + 1))
    }));

  vessels.forEach((vessel) => {
    const existingRows = (working.vesselStructuredSpecs[vessel] || []).slice();
    const byId = new Map(existingRows.map((row) => [String(row?.id || ''), row]));

    const alignedRows = templateRows.map((templateRow) => {
      const current = byId.get(templateRow.id);
      return {
        id: templateRow.id,
        order: templateRow.order,
        label: templateRow.label,
        value: String(current?.value ?? '-').trim() || '-',
        htmlLine: templateRow.htmlLine
      };
    });

    // Keep vessel-specific extra rows if they exist and template was not updated yet.
    existingRows.forEach((row) => {
      const id = String(row?.id || '').trim();
      if (!id || templateRows.some((templateRow) => templateRow.id === id)) return;
      alignedRows.push({
        id,
        order: alignedRows.length + 1,
        label: String(row?.label || '').trim(),
        value: String(row?.value ?? '-').trim() || '-',
        htmlLine: Math.max(1, Number.parseInt(row?.htmlLine, 10) || Math.floor((alignedRows.length + 1) / 2))
      });
    });

    working.vesselStructuredSpecs[vessel] = alignedRows;
  });
}

function renderVesselSelector() {
  vesselSelect.innerHTML = '';
  working.vesselOptions.forEach((vessel) => {
    const option = document.createElement('option');
    option.value = vessel;
    option.textContent = vessel;
    if (vessel === selectedVessel) option.selected = true;
    vesselSelect.appendChild(option);
  });
}

function renderSelectedVesselEditor() {
  ensureVesselRecord(selectedVessel);
  vesselNameInput.value = selectedVessel;
  rawSpecsInput.value = working.vesselSpecs[selectedVessel] || '';
  renderStructuredSpecsGrid();
}

function renderStructuredSpecsGrid() {
  alignAllVesselRowsToTemplate();
  ensureVesselRecord(selectedVessel);
  structuredSpecsGrid.innerHTML = '';

  const rows = working.vesselStructuredSpecs[selectedVessel]
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((row, index) => ({
      ...row,
      order: index + 1
    }));

  working.vesselStructuredSpecs[selectedVessel] = rows;

  rows.forEach((specRow, index) => {
    const row = document.createElement('div');
    row.className = 'structured-row';

    specRow.order = index + 1;

    const labelInput = document.createElement('input');
    labelInput.value = specRow.label || '';
    labelInput.placeholder = 'Spec label (e.g. DWCC)';
    labelInput.addEventListener('input', () => {
      const nextLabel = labelInput.value;
      const rowId = String(specRow.id || '').trim();
      specRow.label = nextLabel;
      if (rowId) {
        (working.vesselOptions || []).forEach((vessel) => {
          const list = Array.isArray(working.vesselStructuredSpecs[vessel])
            ? working.vesselStructuredSpecs[vessel]
            : [];
          const matched = list.find((item) => String(item?.id || '').trim() === rowId);
          if (matched) matched.label = nextLabel;
        });
      }
      refreshPreview();
    });

    const valueInput = document.createElement('input');
    valueInput.value = specRow.value || '';
    valueInput.placeholder = `Spec value for ${selectedVessel}`;
    valueInput.addEventListener('input', () => {
      specRow.value = valueInput.value;
      refreshPreview();
    });

    const htmlLineInput = document.createElement('input');
    htmlLineInput.type = 'number';
    htmlLineInput.className = 'mini-input';
    htmlLineInput.min = '1';
    htmlLineInput.value = String(specRow.htmlLine || (Math.floor(index / 2) + 1));
    htmlLineInput.title = 'HTML line group';
    htmlLineInput.addEventListener('input', () => {
      const nextLine = Math.max(1, Number.parseInt(htmlLineInput.value, 10) || 1);
      const rowId = String(specRow.id || '').trim();
      specRow.htmlLine = nextLine;
      if (rowId) {
        (working.vesselOptions || []).forEach((vessel) => {
          const list = Array.isArray(working.vesselStructuredSpecs[vessel])
            ? working.vesselStructuredSpecs[vessel]
            : [];
          const matched = list.find((item) => String(item?.id || '').trim() === rowId);
          if (matched) matched.htmlLine = nextLine;
        });
      }
      refreshPreview();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      const rowId = String(specRow.id || '').trim();
      if (!rowId) return;
      (working.vesselOptions || []).forEach((vessel) => {
        const list = Array.isArray(working.vesselStructuredSpecs[vessel])
          ? working.vesselStructuredSpecs[vessel]
          : [];
        working.vesselStructuredSpecs[vessel] = list.filter((item) => String(item?.id || '').trim() !== rowId);
      });
      renderStructuredSpecsGrid();
      refreshPreview();
      showStatus('Structured spec row removed for all vessels.');
    });

    row.appendChild(labelInput);
    row.appendChild(valueInput);
    row.appendChild(htmlLineInput);
    row.appendChild(removeBtn);
    structuredSpecsGrid.appendChild(row);
  });
}

function renderOptionEditors() {
  optionEditors.innerHTML = '';

  optionGroups.forEach((group) => {
    const card = document.createElement('div');
    card.className = 'option-card';

    const title = document.createElement('h3');
    title.textContent = group.label;
    card.appendChild(title);

    const list = document.createElement('div');
    list.className = 'repeat-list';

    (working[group.key] || []).forEach((value, index) => {
      const row = document.createElement('div');
      row.className = 'repeat-row';

      const input = document.createElement('input');
      input.value = value;
      input.addEventListener('input', () => {
        working[group.key][index] = input.value;
        refreshPreview();
      });

      const badge = document.createElement('span');
      badge.className = 'pill';
      badge.textContent = `${index + 1}`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        working[group.key].splice(index, 1);
        if (group.key === 'termsOptions') {
          ensureTermBehaviorRecords();
        }
        renderAll();
        refreshPreview();
      });

      row.appendChild(input);
      row.appendChild(badge);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'secondary';
    addBtn.textContent = `+ Add option`;
    addBtn.addEventListener('click', () => {
      working[group.key].push('');
      renderAll();
      refreshPreview();
    });

    card.appendChild(list);
    card.appendChild(addBtn);
    optionEditors.appendChild(card);
  });
}

function renderTermBehaviorList() {
  ensureTermBehaviorRecords();
  termBehaviorList.innerHTML = '';

  working.termsOptions.forEach((term) => {
    const record = working.termBehavior[term] || { mode: 'laytime', meaning: '', structure: '' };

    const wrapper = document.createElement('div');
    wrapper.className = 'option-card';

    const heading = document.createElement('h3');
    heading.textContent = term;
    wrapper.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'grid';

    const modeField = document.createElement('div');
    modeField.className = 'field';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Mode';
    const modeSelect = document.createElement('select');
    ['laytime', 'text'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (record.mode === value) option.selected = true;
      modeSelect.appendChild(option);
    });
    modeSelect.addEventListener('change', () => {
      working.termBehavior[term].mode = modeSelect.value;
      refreshPreview();
    });
    modeField.appendChild(modeLabel);
    modeField.appendChild(modeSelect);

    const meaningField = document.createElement('div');
    meaningField.className = 'field';
    const meaningLabel = document.createElement('label');
    meaningLabel.textContent = 'Meaning';
    const meaningInput = document.createElement('textarea');
    meaningInput.className = 'small';
    meaningInput.value = record.meaning || '';
    meaningInput.addEventListener('input', () => {
      working.termBehavior[term].meaning = meaningInput.value;
      refreshPreview();
    });
    meaningField.appendChild(meaningLabel);
    meaningField.appendChild(meaningInput);

    const structureField = document.createElement('div');
    structureField.className = 'field full';
    const structureLabel = document.createElement('label');
    structureLabel.textContent = 'Structure note';
    const structureInput = document.createElement('textarea');
    structureInput.className = 'small';
    structureInput.value = record.structure || '';
    structureInput.addEventListener('input', () => {
      working.termBehavior[term].structure = structureInput.value;
      refreshPreview();
    });
    structureField.appendChild(structureLabel);
    structureField.appendChild(structureInput);

    grid.appendChild(modeField);
    grid.appendChild(meaningField);
    wrapper.appendChild(grid);
    wrapper.appendChild(structureField);
    termBehaviorList.appendChild(wrapper);
  });
}

function refreshPreview() {
  currentPreview.textContent = JSON.stringify(working, null, 2);
}

function renderAll() {
  alignAllVesselRowsToTemplate();
  ensureTermBehaviorRecords();
  if (!working.vesselOptions.includes(selectedVessel)) {
    selectedVessel = working.vesselOptions[0] || '';
  }
  renderVesselSelector();
  renderSelectedVesselEditor();
  renderOptionEditors();
  renderTermBehaviorList();
  defaultsJson.value = JSON.stringify(working.formDefaults, null, 2);
  refreshPreview();
}

function readDefaultsJson() {
  try {
    const parsed = JSON.parse(defaultsJson.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Defaults JSON must be an object.');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Defaults JSON is invalid: ${error.message}`);
  }
}

function buildCustomizationPayload() {
  const payload = clone(working);
  payload.formDefaults = readDefaultsJson();
  return payload;
}

function getAdminPassword() {
  return String(adminPasswordInput?.value || '').trim();
}

async function reloadSharedCustomization(force = false) {
  const result = await syncRuntimeCustomizationFromServer({ force });
  working = createWorkingCopy(getRuntimeConfig());
  selectedVessel = working.vesselOptions[0] || '';
  renderAll();
  return result;
}

document.getElementById('loadSavedBtn').addEventListener('click', async () => {
  try {
    const result = await reloadSharedCustomization(true);
    if (result.configured === false) {
      showStatus('Shared storage is not configured yet. Using local/default data.', true);
      return;
    }
    showStatus('Shared customization reloaded.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById('saveCustomizeBtn').addEventListener('click', async () => {
  try {
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      throw new Error('Enter the admin save password first.');
    }

    const payload = buildCustomizationPayload();
    const response = await pushRuntimeCustomizationToServer(payload, adminPassword);
    working = createWorkingCopy(getRuntimeConfig());
    selectedVessel = working.vesselOptions[0] || '';
    renderAll();
    showStatus(response.writable === false
      ? 'Saved locally, but shared writing is not enabled on Vercel.'
      : 'Shared customization saved. All users will see it after refresh.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById('resetAllBtn').addEventListener('click', async () => {
  try {
    if (!window.confirm('Reset the shared customization for all users?')) return;

    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      throw new Error('Enter the admin save password first.');
    }

    await resetRuntimeCustomizationOnServer(adminPassword);
    clearRuntimeCustomization({ source: 'customize-app-reset' });
    working = createWorkingCopy(baseConfig);
    working.termBehavior = clone(getRuntimeConfig().termBehavior || {});
    selectedVessel = working.vesselOptions[0] || '';
    renderAll();
    customizationJson.value = '';
    showStatus('Shared customization reset. All users will see defaults after refresh.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById('exportJsonBtn').addEventListener('click', () => {
  try {
    customizationJson.value = JSON.stringify(buildCustomizationPayload(), null, 2);
    showStatus('Customization JSON exported to the textarea.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById('importJsonBtn').addEventListener('click', () => {
  try {
    const parsed = JSON.parse(customizationJson.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Imported JSON must be an object.');
    }
    working = createWorkingCopy(parsed);
    selectedVessel = working.vesselOptions?.[0] || '';
    renderAll();
    showStatus('Imported JSON loaded into the editor. Click Save for All Users to apply it.');
  } catch (error) {
    showStatus(`Import failed: ${error.message}`, true);
  }
});

document.getElementById('addVesselBtn').addEventListener('click', () => {
  const vesselName = window.prompt('New vessel name');
  if (!vesselName) return;
  const clean = vesselName.trim();
  if (!clean) return;
  if (working.vesselOptions.includes(clean)) {
    showStatus('That vessel already exists.', true);
    return;
  }
  working.vesselOptions.push(clean);
  ensureVesselRecord(clean);
  alignAllVesselRowsToTemplate();
  selectedVessel = clean;
  renderAll();
  showStatus('New vessel added.');
});

document.getElementById('removeVesselBtn').addEventListener('click', () => {
  if (!selectedVessel) return;
  if (!window.confirm(`Remove ${selectedVessel}?`)) return;
  working.vesselOptions = working.vesselOptions.filter((vessel) => vessel !== selectedVessel);
  delete working.vesselSpecs[selectedVessel];
  delete working.vesselStructuredSpecs[selectedVessel];
  selectedVessel = working.vesselOptions[0] || '';
  renderAll();
  showStatus('Vessel removed.');
});

addSpecRowBtn.addEventListener('click', () => {
  const vessels = Array.isArray(working.vesselOptions) ? working.vesselOptions.filter(Boolean) : [];
  if (!vessels.length) return;

  const nextIndex = Math.max(...vessels.map((vessel) => {
    ensureVesselRecord(vessel);
    return working.vesselStructuredSpecs[vessel].length;
  }), 0);

  vessels.forEach((vessel) => {
    working.vesselStructuredSpecs[vessel].push(createSpecRow(nextIndex));
  });

  renderStructuredSpecsGrid();
  refreshPreview();
  showStatus('New structured spec row added for all vessels.');
});

vesselSelect.addEventListener('change', () => {
  selectedVessel = vesselSelect.value;
  renderSelectedVesselEditor();
});

vesselNameInput.addEventListener('input', () => {
  const next = vesselNameInput.value.trim();
  if (!selectedVessel) return;
  const index = working.vesselOptions.indexOf(selectedVessel);
  if (index === -1) return;
  if (!next) return;
  if (next !== selectedVessel && working.vesselOptions.includes(next)) {
    showStatus('That vessel name already exists.', true);
    return;
  }
  working.vesselOptions[index] = next;
  working.vesselSpecs[next] = working.vesselSpecs[selectedVessel] || '';
  working.vesselStructuredSpecs[next] = working.vesselStructuredSpecs[selectedVessel] || {};
  if (next !== selectedVessel) {
    delete working.vesselSpecs[selectedVessel];
    delete working.vesselStructuredSpecs[selectedVessel];
    selectedVessel = next;
  }
  renderVesselSelector();
  refreshPreview();
});

rawSpecsInput.addEventListener('input', () => {
  if (!selectedVessel) return;
  working.vesselSpecs[selectedVessel] = rawSpecsInput.value;
  refreshPreview();
});

working = createWorkingCopy(getRuntimeConfig());
selectedVessel = working.vesselOptions[0] || '';
renderAll();

(async () => {
  try {
    const result = await reloadSharedCustomization(false);
    if (result.configured === false) {
      showStatus('Shared storage is not configured yet. Generator customization is using local/default data.', true);
      return;
    }
    if (result.customization) {
      showStatus('Shared customization loaded.');
    } else {
      showStatus('No shared customization saved yet. Defaults are active.');
    }
  } catch (error) {
    showStatus(`Shared load failed: ${error.message}`, true);
  }
})();
