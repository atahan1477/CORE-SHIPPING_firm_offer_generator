const STORAGE_KEY = 'coreShippingSharedStateV1';
const CHANNEL_NAME = 'core-shipping-tools';

let state = loadState();
const listeners = new Set();

const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel(CHANNEL_NAME)
  : null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // Ignore storage quota / private mode errors.
  }
}

function notify(meta = {}) {
  const snapshot = clone(state);
  listeners.forEach((listener) => {
    try {
      listener(snapshot, meta);
    } catch (error) {
      console.error('Store listener failed:', error);
    }
  });
}

function broadcast(type, payload, meta = {}) {
  if (!channel) return;
  try {
    channel.postMessage({
      type,
      payload,
      meta
    });
  } catch (_) {
    // Ignore BroadcastChannel failures.
  }
}

export function getSharedState() {
  return clone(state);
}

export function replaceSharedState(nextState, options = {}) {
  const {
    source = 'unknown',
    broadcast: shouldBroadcast = true,
    persist = true,
    notifyListeners = true
  } = options;

  state = nextState && typeof nextState === 'object' ? clone(nextState) : {};

  if (persist) persistState();
  if (shouldBroadcast) {
    broadcast('replace', state, { source });
  }
  if (notifyListeners) {
    notify({ type: 'replace', source });
  }

  return getSharedState();
}

export function setSharedState(patch, options = {}) {
  const {
    source = 'unknown',
    broadcast: shouldBroadcast = true,
    persist = true,
    notifyListeners = true
  } = options;

  const safePatch = patch && typeof patch === 'object' ? patch : {};
  state = { ...state, ...clone(safePatch) };

  if (persist) persistState();
  if (shouldBroadcast) {
    broadcast('patch', safePatch, { source });
  }
  if (notifyListeners) {
    notify({ type: 'patch', source, patch: clone(safePatch) });
  }

  return getSharedState();
}

export function resetSharedState(options = {}) {
  return replaceSharedState({}, options);
}

export function subscribeToSharedState(listener, options = {}) {
  const { immediate = true } = options;
  listeners.add(listener);

  if (immediate) {
    listener(getSharedState(), { type: 'subscribe', source: 'store' });
  }

  return () => {
    listeners.delete(listener);
  };
}

if (channel) {
  channel.addEventListener('message', (event) => {
    const message = event.data || {};
    const { type, payload, meta = {} } = message;

    if (type === 'replace') {
      state = payload && typeof payload === 'object' ? clone(payload) : {};
      persistState();
      notify({ type: 'replace', source: meta.source || 'broadcast' });
      return;
    }

    if (type === 'patch') {
      const safePatch = payload && typeof payload === 'object' ? clone(payload) : {};
      state = { ...state, ...safePatch };
      persistState();
      notify({
        type: 'patch',
        source: meta.source || 'broadcast',
        patch: safePatch
      });
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;

    try {
      const nextState = JSON.parse(event.newValue);
      state = nextState && typeof nextState === 'object' ? nextState : {};
      notify({ type: 'storage', source: 'storage' });
    } catch (_) {
      // Ignore invalid storage payloads.
    }
  });
}
