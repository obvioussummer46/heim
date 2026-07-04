/**
 * Safe note-content renderer. Content is only ever rendered as React text
 * nodes (escaped) — never raw HTML. URLs become links; image URLs become
 * lazy-loaded images.
 */
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;

export function RichText({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of content.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(content.slice(last, idx));
    const url = m[0];
    if (IMAGE_RE.test(url)) {
      parts.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key++}
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="my-1 max-h-72 max-w-full rounded-lg border border-white/10 object-contain"
        />
      );
    } else {
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-accent underline decoration-accent/40 break-all"
        >
          {url}
        </a>
      );
    }
    last = idx + url.length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}
