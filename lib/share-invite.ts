import { Platform } from 'react-native';

const TOKEN_KEY = 'ra_share_invite_token';
const NEXT_KEY = 'ra_auth_next';

function store(key: string, value: string) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch { /* private mode */ }
}

function read(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch {
    return null;
  }
}

function drop(key: string) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch { /* */ }
}

export function publicShareUrl(token: string) {
  const q = encodeURIComponent(token);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/share-accept?token=${q}`;
  }
  return `https://rescue-army.com/share-accept?token=${q}`;
}

export function rememberShareToken(token: string) {
  if (!token) return;
  store(TOKEN_KEY, token);
  store(NEXT_KEY, `/share-accept?token=${encodeURIComponent(token)}`);
}

export function readShareToken(): string | null {
  return read(TOKEN_KEY);
}

export function clearShareToken() {
  drop(TOKEN_KEY);
}

export function peekAuthNext(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('next');
    if (q) {
      store(NEXT_KEY, q);
      return sanitizeNext(q);
    }
    return sanitizeNext(read(NEXT_KEY));
  } catch {
    return null;
  }
}

export function consumeAuthNext(): string | null {
  const n = peekAuthNext();
  if (n) drop(NEXT_KEY);
  return n;
}

function sanitizeNext(n: string | null): string | null {
  if (!n) return null;
  if (!n.startsWith('/') || n.startsWith('//')) return null;
  return n;
}
