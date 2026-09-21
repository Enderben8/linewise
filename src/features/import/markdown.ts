/** Light Markdown clean-up for pasted or imported .md files: keeps the words, drops the markup. */
export function markdownToText(md: string): string {
  let inFence = false;
  const out: string[] = [];
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(raw);
      continue;
    }
    let line = raw
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s{0,3}>\s?/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?=[^\w*]|$)/g, '$1$2')
      .replace(/(^|[^\w_])_(?!\s)(.+?)_(?=[^\w_]|$)/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1');
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) line = '';
    out.push(line.trimEnd());
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function titleFromFileName(name: string): string {
  return name
    .replace(/\.(txt|md|markdown)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}
