/**
 * Safe, robust, error-tolerant cross-browser storage helper supporting:
 * - Chrome, Opera, Brave, Edge (chrome.storage.local)
 * - Mozilla Firefox (browser.storage.local / chrome.storage.local)
 * - Web / Local Dev (localStorage)
 */

export const getStorageApi = () => {
  try {
    if (typeof globalThis !== "undefined") {
      // 1. Firefox Native WebExtension API
      const browserApi = globalThis.browser;
      if (
        browserApi?.storage?.local &&
        typeof browserApi.storage.local.get === "function" &&
        typeof browserApi.storage.local.set === "function"
      ) {
        return browserApi.storage.local;
      }

      // 2. Chromium API (Chrome, Opera, Edge, Brave)
      const chromeApi = globalThis.chrome;
      if (
        chromeApi?.storage?.local &&
        typeof chromeApi.storage.local.get === "function" &&
        typeof chromeApi.storage.local.set === "function"
      ) {
        return chromeApi.storage.local;
      }
    }
  } catch {
    /* fallback to localStorage */
  }
  return null;
};

export const checkHasChromeStorage = () => getStorageApi() !== null;
export const hasChromeStorage = checkHasChromeStorage();

const parseIfJsonString = (val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      trimmed === "true" ||
      trimmed === "false" ||
      trimmed === "null"
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return val;
      }
    }
  }
  return val;
};

const getFromLocalStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return undefined;
    return parseIfJsonString(raw);
  } catch {
    return undefined;
  }
};

const setToLocalStorage = (key, value) => {
  try {
    if (value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    }
  } catch (err) {
    console.warn("localStorage setItem fallback error:", key, err);
  }
};

/**
 * Reads value for key from storage. Always resolves gracefully without throwing.
 */
export const storageGet = async (key) => {
  const api = getStorageApi();
  if (api) {
    try {
      const val = await new Promise((resolve) => {
        let settled = false;
        try {
          const ret = api.get([key], (result) => {
            if (settled) return;
            settled = true;
            if (globalThis.chrome?.runtime?.lastError) {
              resolve(undefined);
            } else {
              resolve(result?.[key]);
            }
          });
          // Handle native Promise return (Firefox WebExtension)
          if (ret && typeof ret.then === "function") {
            ret
              .then((res) => {
                if (settled) return;
                settled = true;
                resolve(res?.[key]);
              })
              .catch(() => {
                if (settled) return;
                settled = true;
                resolve(undefined);
              });
          }
        } catch {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        }
      });
      if (val !== undefined) {
        return parseIfJsonString(val);
      }
    } catch {
      /* fallback to localStorage */
    }
  }
  return getFromLocalStorage(key);
};

/**
 * Reads multiple keys from storage at once. Always resolves object mapping key -> value.
 */
export const storageGetMultiple = async (keys) => {
  const api = getStorageApi();
  if (api) {
    try {
      const res = await new Promise((resolve) => {
        let settled = false;
        try {
          const ret = api.get(keys, (result) => {
            if (settled) return;
            settled = true;
            const out = {};
            for (const key of keys) {
              const val = result?.[key];
              out[key] =
                val !== undefined
                  ? parseIfJsonString(val)
                  : getFromLocalStorage(key);
            }
            resolve(out);
          });
          // Handle native Promise return (Firefox WebExtension)
          if (ret && typeof ret.then === "function") {
            ret
              .then((result) => {
                if (settled) return;
                settled = true;
                const out = {};
                for (const key of keys) {
                  const val = result?.[key];
                  out[key] =
                    val !== undefined
                      ? parseIfJsonString(val)
                      : getFromLocalStorage(key);
                }
                resolve(out);
              })
              .catch(() => {
                if (settled) return;
                settled = true;
                const out = {};
                for (const key of keys) out[key] = getFromLocalStorage(key);
                resolve(out);
              });
          }
        } catch {
          if (!settled) {
            settled = true;
            const out = {};
            for (const key of keys) out[key] = getFromLocalStorage(key);
            resolve(out);
          }
        }
      });
      return res;
    } catch {
      /* fallback */
    }
  }

  const out = {};
  for (const key of keys) out[key] = getFromLocalStorage(key);
  return Promise.resolve(out);
};

/**
 * Writes value for key to storage. Always resolves gracefully without throwing.
 */
export const storageSet = async (key, value) => {
  const api = getStorageApi();
  if (api) {
    try {
      await new Promise((resolve) => {
        let settled = false;
        try {
          const ret = api.set({ [key]: value }, () => {
            if (settled) return;
            settled = true;
            if (globalThis.chrome?.runtime?.lastError) {
              setToLocalStorage(key, value);
            }
            resolve();
          });
          // Handle native Promise return (Firefox WebExtension)
          if (ret && typeof ret.then === "function") {
            ret
              .then(() => {
                if (settled) return;
                settled = true;
                resolve();
              })
              .catch(() => {
                if (settled) return;
                settled = true;
                setToLocalStorage(key, value);
                resolve();
              });
          }
        } catch {
          if (!settled) {
            settled = true;
            setToLocalStorage(key, value);
            resolve();
          }
        }
      });
      return;
    } catch {
      setToLocalStorage(key, value);
      return;
    }
  }
  setToLocalStorage(key, value);
  return Promise.resolve();
};

/**
 * Subscribes to changes of a single key made from any extension context
 * (e.g. the Dynamic Island content script). Returns an unsubscribe function.
 */
export const subscribeStorageKey = (key, callback) => {
  let onChanged = null;
  try {
    onChanged = globalThis.browser?.storage?.onChanged || globalThis.chrome?.storage?.onChanged || null;
  } catch {
    onChanged = null;
  }
  if (!onChanged || typeof onChanged.addListener !== "function") return () => {};

  const listener = (changes, area) => {
    if (area && area !== "local") return;
    if (!changes || !Object.prototype.hasOwnProperty.call(changes, key)) return;
    callback(parseIfJsonString(changes[key].newValue));
  };

  try {
    onChanged.addListener(listener);
  } catch {
    return () => {};
  }
  return () => {
    try { onChanged.removeListener(listener); } catch { /* ignore */ }
  };
};

/**
 * Export all app data into a JS object.
 * Reads everything from extension storage (if available) and localStorage.
 */
export const exportAllStorageData = async () => {
  const result = {};
  const api = getStorageApi();

  if (api) {
    await new Promise((resolve) => {
      let settled = false;
      try {
        const ret = api.get(null, (items) => {
          if (settled) return;
          settled = true;
          if (items && typeof items === "object") {
            for (const [k, v] of Object.entries(items)) {
              if (!k.startsWith("project_os_auth_") && !k.startsWith("project_os_cloud_")) result[k] = parseIfJsonString(v);
            }
          }
          resolve();
        });
        if (ret && typeof ret.then === "function") {
          ret
            .then((items) => {
              if (settled) return;
              settled = true;
              if (items && typeof items === "object") {
                for (const [k, v] of Object.entries(items)) {
                  if (!k.startsWith("project_os_auth_") && !k.startsWith("project_os_cloud_")) result[k] = parseIfJsonString(v);
                }
              }
              resolve();
            })
            .catch(() => {
              if (settled) return;
              settled = true;
              resolve();
            });
        }
      } catch {
        if (!settled) {
          settled = true;
          resolve();
        }
      }
    });
  }

  try {
    if (typeof localStorage !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith("project_os_auth_") && !key.startsWith("project_os_cloud_") && result[key] === undefined) {
          const raw = localStorage.getItem(key);
          if (raw !== null && raw !== undefined) {
            result[key] = parseIfJsonString(raw);
          }
        }
      }
    }
  } catch (err) {
    console.warn("localStorage export error:", err);
  }

  return result;
};

/**
 * Import and restore all data into storage.
 * Writes to extension storage and localStorage.
 */
export const importAllStorageData = async (dataObj) => {
  if (!dataObj || typeof dataObj !== "object" || Array.isArray(dataObj)) {
    throw new Error("Invalid backup payload. Expected a valid JSON object.");
  }

  // Backups must never replace the current cloud session or sync baseline.
  dataObj = Object.fromEntries(Object.entries(dataObj).filter(([key]) => !key.startsWith("project_os_auth_") && !key.startsWith("project_os_cloud_")));

  const api = getStorageApi();
  if (api) {
    await new Promise((resolve) => {
      let settled = false;
      try {
        const ret = api.set(dataObj, () => {
          if (settled) return;
          settled = true;
          resolve();
        });
        if (ret && typeof ret.then === "function") {
          ret
            .then(() => {
              if (settled) return;
              settled = true;
              resolve();
            })
            .catch(() => {
              if (settled) return;
              settled = true;
              resolve();
            });
        }
      } catch {
        if (!settled) {
          settled = true;
          resolve();
        }
      }
    });
  }

  try {
    if (typeof localStorage !== "undefined") {
      for (const [key, val] of Object.entries(dataObj)) {
        if (val === undefined || val === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(
            key,
            typeof val === "string" ? val : JSON.stringify(val)
          );
        }
      }
    }
  } catch (err) {
    console.warn("localStorage import error:", err);
  }
};

/**
 * Clears all dashboard data from storage.
 */
export const clearAllStorageData = async () => {
  const api = getStorageApi();
  if (api) {
    await new Promise((resolve) => {
      let settled = false;
      try {
        const ret = api.clear(() => {
          if (settled) return;
          settled = true;
          resolve();
        });
        if (ret && typeof ret.then === "function") {
          ret
            .then(() => {
              if (settled) return;
              settled = true;
              resolve();
            })
            .catch(() => {
              if (settled) return;
              settled = true;
              resolve();
            });
        }
      } catch {
        if (!settled) {
          settled = true;
          resolve();
        }
      }
    });
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  } catch (err) {
    console.warn("localStorage clear error:", err);
  }
};
