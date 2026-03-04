import type { LinkPreview } from '@/lib/types';

const URL_REGEX =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/gi;

const MAX_CACHE = 100;
const cache = new Map<string, LinkPreview | null>();

/** Extract the first URL from a text string */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

/** Extract all URLs from a text string */
export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

/** Fetch Open Graph metadata for a URL */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (cache.has(url)) return cache.get(url) ?? null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'MindArena/1.0 LinkPreview' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      evictAndSet(url, null);
      return null;
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      evictAndSet(url, null);
      return null;
    }

    // Read only the first 16KB to avoid downloading huge pages
    const reader = res.body?.getReader();
    if (!reader) {
      evictAndSet(url, null);
      return null;
    }

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const maxBytes = 16384;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.byteLength;
    }
    reader.cancel();

    const preview = parseOpenGraph(url, html);
    evictAndSet(url, preview);
    return preview;
  } catch {
    evictAndSet(url, null);
    return null;
  }
}

function evictAndSet(url: string, value: LinkPreview | null) {
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(url, value);
}

function parseOpenGraph(url: string, html: string): LinkPreview | null {
  const getMetaContent = (property: string): string | undefined => {
    const regex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      'i',
    );
    const altRegex = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      'i',
    );
    const match = html.match(regex) || html.match(altRegex);
    return match?.[1]?.trim() || undefined;
  };

  const title =
    getMetaContent('og:title') ||
    getMetaContent('twitter:title') ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();

  if (!title) return null;

  const description =
    getMetaContent('og:description') ||
    getMetaContent('twitter:description') ||
    getMetaContent('description');

  const image = getMetaContent('og:image') || getMetaContent('twitter:image');

  let favicon: string | undefined;
  const faviconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i,
  );
  if (faviconMatch?.[1]) {
    favicon = faviconMatch[1].startsWith('http')
      ? faviconMatch[1]
      : new URL(faviconMatch[1], url).href;
  }

  return { url, title, description, image, favicon };
}
