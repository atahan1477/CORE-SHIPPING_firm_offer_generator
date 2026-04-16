const STORE_KEY = 'coreShippingDocumentWorkspaceV1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function createEmptyWorkspace() {
  return {
    schemaVersion: 1,
    workspaceId: 'default-workspace',
    documents: {},
    versions: {},
    compareCache: {},
    updatedAt: nowIso()
  };
}

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return createEmptyWorkspace();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyWorkspace();

    return {
      ...createEmptyWorkspace(),
      ...parsed,
      documents: parsed.documents && typeof parsed.documents === 'object' ? parsed.documents : {},
      versions: parsed.versions && typeof parsed.versions === 'object' ? parsed.versions : {},
      compareCache: parsed.compareCache && typeof parsed.compareCache === 'object' ? parsed.compareCache : {}
    };
  } catch (_) {
    return createEmptyWorkspace();
  }
}

function saveWorkspace(workspace) {
  const next = {
    ...workspace,
    updatedAt: nowIso()
  };

  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return next;
}

function ensureDocumentVersionList(workspace, documentId) {
  if (!Array.isArray(workspace.versions[documentId])) {
    workspace.versions[documentId] = [];
  }
  return workspace.versions[documentId];
}

export function createDocumentFromDraft(draft, options = {}) {
  const workspace = loadWorkspace();
  const id = options.id || makeId('doc');
  const createdAt = nowIso();

  const summary = {
    id,
    title: options.title || draft?.metadata?.title || `Document ${id}`,
    status: options.status || draft?.metadata?.status || 'draft',
    templateId: options.templateId || draft?.template?.id || 'legacy-template-v1',
    createdAt,
    updatedAt: createdAt,
    currentVersion: 0,
    createdBy: options.createdBy || 'local-user',
    updatedBy: options.updatedBy || 'local-user'
  };

  workspace.documents[id] = summary;
  ensureDocumentVersionList(workspace, id);
  saveWorkspace(workspace);

  return clone(summary);
}

export function getDocument(documentId) {
  const workspace = loadWorkspace();
  const doc = workspace.documents[documentId];
  if (!doc) return null;
  return clone(doc);
}

export function saveDocumentVersion(documentId, draft, options = {}) {
  const workspace = loadWorkspace();
  const doc = workspace.documents[documentId];
  if (!doc) throw new Error('Document not found.');

  const versions = ensureDocumentVersionList(workspace, documentId);
  const nextVersion = versions.length + 1;
  const createdAt = nowIso();

  const versionRecord = {
    id: makeId('ver'),
    documentId,
    version: nextVersion,
    createdAt,
    createdBy: options.createdBy || 'local-user',
    snapshot: clone(draft)
  };

  versions.push(versionRecord);
  doc.currentVersion = nextVersion;
  doc.updatedAt = createdAt;
  doc.updatedBy = options.updatedBy || options.createdBy || 'local-user';
  if (draft?.metadata?.title) {
    doc.title = draft.metadata.title;
  }

  saveWorkspace(workspace);
  return clone(versionRecord);
}

export function listDocumentVersions(documentId) {
  const workspace = loadWorkspace();
  const versions = ensureDocumentVersionList(workspace, documentId);
  return clone(versions);
}

function extractComparableFields(snapshot = {}) {
  return {
    vessel: snapshot?.vessel?.name || '',
    cargo: snapshot?.cargo?.description || '',
    laycan: snapshot?.voyage?.laycanDate || '',
    terms: snapshot?.voyage?.terms || '',
    pol: snapshot?.voyage?.pol || '',
    pod: snapshot?.voyage?.pod || '',
    freightAmount: snapshot?.commercial?.freightAmount || '',
    demdetAmount: snapshot?.commercial?.demdetAmount || '',
    applicableContract: snapshot?.commercial?.applicableContract || '',
    extraClauses: (snapshot?.drafting?.extraClauses || []).map((item) => item.text || ''),
    finalClauses: (snapshot?.drafting?.finalClauses || []).map((item) => item.text || '')
  };
}

function diffFields(before = {}, after = {}) {
  const changed = [];
  Object.keys(after).forEach((key) => {
    const left = JSON.stringify(before[key] ?? null);
    const right = JSON.stringify(after[key] ?? null);
    if (left !== right) {
      changed.push(key);
    }
  });
  return changed;
}

export function compareDocumentVersions(documentId, leftVersion, rightVersion) {
  const versions = listDocumentVersions(documentId);
  const left = versions.find((entry) => entry.version === Number(leftVersion));
  const right = versions.find((entry) => entry.version === Number(rightVersion));

  if (!left || !right) {
    throw new Error('One or both versions were not found.');
  }

  const before = extractComparableFields(left.snapshot);
  const after = extractComparableFields(right.snapshot);

  const changedFields = diffFields(before, after);

  const summary = {
    documentId,
    leftVersion: left.version,
    rightVersion: right.version,
    changedFields,
    hasChanges: changedFields.length > 0,
    generatedAt: nowIso()
  };

  return summary;
}

export function updateDocumentStatus(documentId, status, options = {}) {
  const allowed = ['draft', 'internal_review', 'approved', 'final'];
  if (!allowed.includes(status)) {
    throw new Error('Invalid status.');
  }

  const workspace = loadWorkspace();
  const doc = workspace.documents[documentId];
  if (!doc) throw new Error('Document not found.');

  doc.status = status;
  doc.updatedAt = nowIso();
  doc.updatedBy = options.updatedBy || 'local-user';
  saveWorkspace(workspace);
  return clone(doc);
}

export function buildCertifiedExportMetadata(documentId) {
  const workspace = loadWorkspace();
  const doc = workspace.documents[documentId];
  if (!doc) return null;

  return {
    documentId: doc.id,
    title: doc.title,
    status: doc.status,
    version: doc.currentVersion,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy
  };
}
