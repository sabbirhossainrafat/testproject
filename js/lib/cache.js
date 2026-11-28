// Shared access to optional browser storage. Storage can be unavailable (blocked cookies,
// private browsing) or hold malformed data, so every access is guarded and never throws.

export function readCachedJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function writeCachedJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
