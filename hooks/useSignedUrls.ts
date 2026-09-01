import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET = 'pet-documents';
const EXPIRY = 3600;

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^blob:/i.test(value) || /^data:/i.test(value);
}

type UrlState = Record<string, { url: string | null; loading: boolean; error: string | null }>;

export function useSignedUrls(paths: string[]): Record<string, string | null> {
  const [urlMap, setUrlMap] = useState<UrlState>({});

  useEffect(() => {
    let cancelled = false;
    const valid = paths.filter(Boolean);
    const known = new Set(Object.keys(urlMap));
    const needed = valid.filter((p) => !known.has(p));

    if (needed.length === 0) return;

    const passthrough: string[] = [];
    const toFetch: string[] = [];
    for (const p of needed) {
      if (isAbsoluteUrl(p)) passthrough.push(p);
      else toFetch.push(p);
    }

    setUrlMap((prev) => {
      const next = { ...prev };
      for (const p of passthrough) next[p] = { url: p, loading: false, error: null };
      for (const p of toFetch) next[p] = { url: null, loading: true, error: null };
      return next;
    });

    if (toFetch.length === 0) return;

    (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(toFetch, EXPIRY);
      if (cancelled) return;
      setUrlMap((prev) => {
        const next = { ...prev };
        if (error || !data) {
          console.error('[useSignedUrls] createSignedUrls failed:', error?.message);
          for (const p of toFetch) next[p] = { url: null, loading: false, error: error?.message || 'Failed' };
        } else {
          for (let i = 0; i < toFetch.length; i++) {
            const item = data[i];
            const path = toFetch[i];
            if (item?.signedUrl) {
              next[path] = { url: item.signedUrl, loading: false, error: null };
            } else {
              console.error('[useSignedUrls] no signedUrl for path:', path);
              next[path] = { url: null, loading: false, error: 'No URL returned' };
            }
          }
        }
        return next;
      });
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join(',')]);

  const result: Record<string, string | null> = {};
  for (const p of paths) {
    if (!p) continue;
    const s = urlMap[p];
    result[p] = s?.url ?? null;
  }
  return result;
}

export function useSignedUrl(path: string | null | undefined): { url: string | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ url: string | null; loading: boolean; error: string | null }>({
    url: null, loading: false, error: null,
  });

  useEffect(() => {
    if (!path) { setState({ url: null, loading: false, error: null }); return; }
    if (isAbsoluteUrl(path)) { setState({ url: path, loading: false, error: null }); return; }
    let cancelled = false;
    setState({ url: null, loading: true, error: null });
    (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRY);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        console.error('[useSignedUrl] createSignedUrl failed for', path, ':', error?.message);
        setState({ url: null, loading: false, error: error?.message || 'Failed' });
      } else {
        setState({ url: data.signedUrl, loading: false, error: null });
      }
    })();
    return () => { cancelled = true; };
  }, [path]);

  return state;
}
