const isBrowser = typeof window !== "undefined";

export function readStorage(key, fallbackValue) {
  if (!isBrowser) {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeStorage(key, value) {
  if (!isBrowser) {
    return value;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function removeStorage(key) {
  if (!isBrowser) {
    return;
  }

  window.localStorage.removeItem(key);
}
