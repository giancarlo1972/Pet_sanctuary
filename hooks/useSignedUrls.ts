import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isUsablePhoto } from '@/lib/photos';

const EXPIRY = 3600;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function resolveStorageUrl(path: string): Promise<string | null> {
  const buckets = path.startsWith('reports/')
    ? ['report-photos', 'pet-photos']
    : ['pet-photos', 'report-photos', 'pet-documents'];
  for (const bucket of buckets) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, EXPIRY);
    if (signed.data?.signedUrl && !signed.error) return signed.data.signedUrl;
  }
  const publicBucket = path.startsWith('reports/') ? 'report-photos' : 'pet-photos';
  const pub = supabase.storage.from(publicBucket).getPublicUrl(path);
  return pub.data?.publicUrl || null;
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
    const skip: string[] = [];
    const toFetch: string[] = [];
    for (const p of needed) {
      if (!isUsablePhoto(p)) skip.push(p);
      else if (isHttpUrl(p)) passthrough.push(p);
      else toFetch.push(p);
    }

    setUrlMap((prev) => {
      const next = { ...prev };
      for (const p of passthrough) next[p] = { url: p, loading: false, error: null };
      for (const p of skip) next[p] = { url: null, loading: false, error: 'unusable' };
      for (const p of toFetch) next[p] = { url: null, loading: true, error: null };
      return next;
    });

    if (toFetch.length === 0) return;

    (async () => {
      const resolved = await Promise.all(toFetch.map((p) => resolveStorageUrl(p)));
      if (cancelled) return;
      setUrlMap((prev) => {
        const next = { ...prev };
        toFetch.forEach((path, i) => {
          const url = resolved[i];
          next[path] = { url, loading: false, error: url ? null : 'Failed' };
        });
        return next;
      });
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join(',')]);

  const result: Record<string, string | null> = {};
  for (const p of paths) {
    if (!p) continue;
    result[p] = urlMap[p]?.url ?? null;
  }
  return result;
}

export function useSignedUrl(path: string | null | undefined): { url: string | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ url: string | null; loading: boolean; error: string | null }>({
    url: null, loading: false, error: null,
  });

  useEffect(() => {
    if (!path) { setState({ url: null, loading: false, error: null }); return; }
    if (!isUsablePhoto(path)) { setState({ url: null, loading: false, error: 'unusable' }); return; }
    if (isHttpUrl(path)) { setState({ url: path, loading: false, error: null }); return; }
    let cancelled = false;
    setState({ url: null, loading: true, error: null });
    (async () => {
      const url = await resolveStorageUrl(path);
      if (cancelled) return;
      setState({ url, loading: false, error: url ? null : 'Failed' });
    })();
    return () => { cancelled = true; };
  }, [path]);

  return state;
}
