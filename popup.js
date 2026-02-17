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

const elements = {
  toggle: document.querySelector(".toggle"),
  form: document.querySelector(".add-form"),
  input: document.querySelector(".host-input"),
  list: document.querySelector(".blocked-list"),
  currentHost: document.querySelector(".current-host"),
  addCurrent: document.querySelector(".add-current"),
  blockedCount: document.querySelector(".blocked-count"),
};

let currentHost = "";
let currentState = { enabled: false, blockedHosts: [] };

function parseHost(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).hostname;
  } catch (error) {
    try {
      return new URL(`http://${raw}`).hostname;
    } catch (innerError) {
      return "";
    }
  }
}

function render(state) {
  document.body.setAttribute("data-enabled", String(state.enabled));
  elements.toggle.setAttribute("aria-pressed", String(state.enabled));

  const blockedHosts = state.blockedHosts.map((host) => normalizeHost(host));
  const filteredHosts = blockedHosts.filter(Boolean);
  const normalizedCurrent = normalizeHost(currentHost);
  const canAddCurrent =
    normalizedCurrent &&
    !blockedHosts.includes(normalizedCurrent) &&
    normalizedCurrent.length > 0;

  elements.currentHost.textContent = normalizedCurrent
    ? `Current: ${normalizedCurrent}`
    : "No active site";
  elements.addCurrent.disabled = !canAddCurrent;
  elements.blockedCount.textContent = String(filteredHosts.length);

  elements.list.innerHTML = "";
  filteredHosts.forEach((host) => {
    const item = document.createElement("li");
    item.className = "blocked-item";

    const label = document.createElement("span");
    label.className = "blocked-host";
    label.textContent = host;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      currentState.blockedHosts = currentState.blockedHosts.filter(
        (entry) => normalizeHost(entry) !== host,
      );
      await setState({ blockedHosts: currentState.blockedHosts });
      render(currentState);
    });

    item.append(label, removeButton);
    elements.list.appendChild(item);
  });
}

async function loadCurrentHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const host = parseHost(tab.url);
      currentHost = host ? normalizeHost(host) : "";
      return;
    }
  } catch (error) {
    currentHost = "";
  }
}

function addBlockedHost(host) {
  if (!host) {
    return;
  }

  const normalized = normalizeHost(host);
  if (!normalized) {
    return;
  }

  const next = new Set(
    currentState.blockedHosts.map((entry) => normalizeHost(entry)),
  );
  next.add(normalized);
  currentState.blockedHosts = Array.from(next);
}

elements.toggle.addEventListener("click", async () => {
  currentState.enabled = !currentState.enabled;
  await setState({ enabled: currentState.enabled });
  render(currentState);
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const host = parseHost(elements.input.value);
  if (!host) {
    return;
  }

  const before = currentState.blockedHosts.length;
  addBlockedHost(host);
  elements.input.value = "";
  if (currentState.blockedHosts.length !== before) {
    await setState({ blockedHosts: currentState.blockedHosts });
  }
  render(currentState);
});

elements.addCurrent.addEventListener("click", async () => {
  if (!currentHost) {
    return;
  }

  const before = currentState.blockedHosts.length;
  addBlockedHost(currentHost);
  if (currentState.blockedHosts.length !== before) {
    await setState({ blockedHosts: currentState.blockedHosts });
  }
  render(currentState);
});

(async () => {
  currentState = await getState();
  await loadCurrentHost();
  render(currentState);
})();
