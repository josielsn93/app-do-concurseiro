const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function unwrapCdata(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? match[1] : '';
}

function plainText(raw) {
  const decoded = decodeEntities(unwrapCdata(raw));
  return decodeEntities(decoded.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function toIso(value) {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function parseRss(xml) {
  if (!xml) return [];
  const items = [];
  for (const block of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    const link = decodeEntities(unwrapCdata(tag(block, 'link'))).trim();
    if (!link) continue;
    const source = plainText(tag(block, 'source'));
    let title = decodeEntities(unwrapCdata(tag(block, 'title'))).replace(/\s+/g, ' ').trim();
    const suffix = ` - ${source}`;
    if (source && title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();
    items.push({
      title,
      link,
      pubDate: toIso(tag(block, 'pubDate').trim()),
      source,
      description: plainText(tag(block, 'description')),
    });
  }
  return items;
}
