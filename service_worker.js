const STORAGE_KEYS = {
  enabled: "enabled",
  blockedHosts: "blockedHosts",
};

function normalizeHost(host) {
  const trimmed = String(host || "").trim().toLowerCase();
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

async function getState() {
  const result = await chrome.storage.local.get({
    [STORAGE_KEYS.enabled]: false,
    [STORAGE_KEYS.blockedHosts]: [],
  });

  return {
    enabled: Boolean(result[STORAGE_KEYS.enabled]),
    blockedHosts: Array.isArray(result[STORAGE_KEYS.blockedHosts])
      ? result[STORAGE_KEYS.blockedHosts]
      : [],
  };
}

async function setState(state) {
  const nextState = {};

  if (Object.prototype.hasOwnProperty.call(state, STORAGE_KEYS.enabled)) {
    nextState[STORAGE_KEYS.enabled] = Boolean(state[STORAGE_KEYS.enabled]);
  }

  if (Object.prototype.hasOwnProperty.call(state, STORAGE_KEYS.blockedHosts)) {
    nextState[STORAGE_KEYS.blockedHosts] = Array.isArray(
      state[STORAGE_KEYS.blockedHosts],
    )
      ? state[STORAGE_KEYS.blockedHosts]
      : [];
  }

  await chrome.storage.local.set(nextState);
}

const BLOCKED_PAGE = chrome.runtime.getURL("blocked.html");

function shouldIgnoreUrl(url) {
  if (!url) {
    return true;
  }

  if (url.startsWith("chrome://")) {
    return true;
  }

  if (url.startsWith("chrome-extension://")) {
    return true;
  }

  if (url.startsWith(BLOCKED_PAGE)) {
    return true;
  }

  return false;
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  if (shouldIgnoreUrl(details.url)) {
    return;
  }

  void (async () => {
    const state = await getState();
    if (!state.enabled) {
      return;
    }

    let targetHost = "";
    try {
      targetHost = normalizeHost(new URL(details.url).hostname);
    } catch (error) {
      return;
    }

    if (!targetHost) {
      return;
    }

    const blocked = state.blockedHosts
      .map((host) => normalizeHost(host))
      .filter(Boolean);

    if (!blocked.includes(targetHost)) {
      return;
    }

    await chrome.tabs.create({ url: BLOCKED_PAGE });
    await chrome.tabs.remove(details.tabId);
  })();
});
