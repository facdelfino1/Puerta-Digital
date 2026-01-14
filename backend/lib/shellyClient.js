// backend/lib/shellyClient.js

// --- FIX: Import node-fetch correctly ---

const DEFAULT_TIMEOUT_MS = Number(process.env.SHELLY_TIMEOUT_MS || 4000) || 4000;
const DEFAULT_RETRY_ATTEMPTS = Number(process.env.SHELLY_RETRY_ATTEMPTS || 2) || 2;
const DEFAULT_RETRY_DELAY_MS = Number(process.env.SHELLY_RETRY_DELAY_MS || 500) || 500;
const DEFAULT_PULSE_DURATION_MS = Number(process.env.SHELLY_PULSE_DURATION_MS || 1500) || 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getShellyConfig() {
  const baseUrl = (process.env.SHELLY_BASE_URL || "").trim();
  const channel = toNumber(process.env.SHELLY_RELAY_CHANNEL, 0);
  const openStateRaw = (process.env.SHELLY_OPEN_STATE || "on").trim().toLowerCase();
  const openAction = openStateRaw === "off" ? "off" : "on";
  const closeAction = openAction === "on" ? "off" : "on";

  const enabled = Boolean(baseUrl.length);

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    channel,
    timeoutMs: toNumber(process.env.SHELLY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retryAttempts: toNumber(process.env.SHELLY_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS),
    retryDelayMs: toNumber(process.env.SHELLY_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS),
    pulseDurationMs: toNumber(process.env.SHELLY_PULSE_DURATION_MS, DEFAULT_PULSE_DURATION_MS),
    openAction,
    closeAction,
  };
}

async function fetchWithTimeout(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { // Now uses the imported fetch
      method: "GET",
      signal: controller.signal,
      // Add headers here if SHELLY_SHARED_SECRET is set
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function formatError(error) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

// Internal function without the wrapper logic
async function _triggerShellyRelay({ action = "on", restoreAction, restoreDelayMs } = {}) {
  const config = getShellyConfig();
  if (!config.enabled) {
    return {
      success: false,
      skipped: true,
      attempts: 0,
      message: "Shelly no configurado",
      restoreScheduled: false,
      autoRestoreUsed: false,
    };
  }

  const baseRetryAttempts = Number.isFinite(config.retryAttempts) ? config.retryAttempts : DEFAULT_RETRY_ATTEMPTS;
  const maxAttempts = Math.max(1, baseRetryAttempts + 1);
  let url = `${config.baseUrl}/relay/${config.channel}?turn=${action}`; // Start with base URL
  let autoRestoreUsed = false;

  const pulseSeconds = restoreDelayMs ? Math.round(restoreDelayMs / 1000) : 0;

  if (action === config.openAction && pulseSeconds > 0) {
    if (action === "on") {
      url += `&auto_off=${pulseSeconds}`;
      autoRestoreUsed = true;
    } else if (action === "off") {
      url += `&auto_on=${pulseSeconds}`;
      autoRestoreUsed = true;
    }
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, { timeoutMs: config.timeoutMs });

      if (!response.ok) {
        let errorBody = null;
        try { errorBody = await response.text(); } catch { /* ignore */ }
        throw new Error(`Shelly respondió con estado ${response.status}. Body: ${errorBody || '(vacio)'}`);
      }

      let bodyText = null;
      try {
        bodyText = await response.text();
      } catch {
        bodyText = null;
      }

      return {
        success: true,
        attempts: attempt,
        responseBody: bodyText,
        restoreScheduled: autoRestoreUsed || Boolean(restoreAction),
        autoRestoreUsed,
      };
    } catch (err) {
      lastError = err;
      console.error(`Shelly attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        await sleep(config.retryDelayMs);
      }
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    error: formatError(lastError),
    restoreScheduled: autoRestoreUsed || Boolean(restoreAction),
    autoRestoreUsed,
  };
}

function scheduleRestore({ baseUrl, channel, timeoutMs, restoreAction, delayMs }) {
  if (!restoreAction || !delayMs || delayMs <= 0) return;

  setTimeout(async () => {
    const restoreUrl = `${baseUrl}/relay/${channel}?turn=${restoreAction}`;
    try {
      const response = await fetchWithTimeout(restoreUrl, { timeoutMs });
      if (!response.ok) {
        let errorBody = null;
        try { errorBody = await response.text(); } catch { /* ignore */ }
        throw new Error(`Shelly respondió con estado ${response.status} al restaurar. Body: ${errorBody || '(vacio)'}`);
      }
    } catch (err) {
      console.error("Shelly restore error:", err.message);
    }
  }, delayMs);
}

// Wrapper function that handles the fallback restore scheduling
async function triggerShellyRelayWithConfig(options = {}) {
  const config = getShellyConfig();
  const result = await _triggerShellyRelay(options);

  if (result.success && options.restoreAction && !result.autoRestoreUsed) {
    scheduleRestore({
      baseUrl: config.baseUrl,
      channel: config.channel,
      timeoutMs: config.timeoutMs,
      restoreAction: options.restoreAction,
      delayMs: options.restoreDelayMs ?? config.pulseDurationMs,
    });
    return { ...result, restoreScheduled: true };
  }
  return result;
}

module.exports = {
  getShellyConfig,
  triggerShellyRelay: triggerShellyRelayWithConfig, // Export the wrapper
};