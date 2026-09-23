/**
 * Namespaced localStorage saves — high scores, progress, settings per game.
 * Fails soft (private mode etc.) so games never crash on storage errors.
 */

const PREFIX = 'maga:';

export function save<T>(game: string, key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + game + ':' + key, JSON.stringify(value));
  } catch { /* storage unavailable — non-fatal */ }
}

export function load<T>(game: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + game + ':' + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function clear(game: string): void {
  try {
    const pre = PREFIX + game + ':';
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(pre)) localStorage.removeItem(k);
    }
  } catch { /* non-fatal */ }
}
