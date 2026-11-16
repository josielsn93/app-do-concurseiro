// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseRss } from '../../radar/lib/rss.js';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Google News</title>
<item>
  <title><![CDATA[TJ-SP autoriza concurso com 500 vagas - Folha Dirigida]]></title>
  <link>https://news.example/a1</link>
  <pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate>
  <description><![CDATA[<a href="https://x">Concurso</a> &amp; vagas <b>novas</b>]]></description>
  <source url="https://folha.example">Folha Dirigida</source>
</item>
<item>
  <title>Banca &quot;Vunesp&quot; definida &amp; contratada</title>
  <link>https://news.example/a2</link>
  <pubDate>invalid date</pubDate>
  <source url="https://pci.example">PCI Concursos</source>
</item>
<item><title>Sem link</title></item>
</channel></rss>`;

describe('parseRss', () => {
  it('extrai título, link, data ISO, fonte e descrição limpa', () => {
    const items = parseRss(FEED);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'TJ-SP autoriza concurso com 500 vagas',
      link: 'https://news.example/a1',
      pubDate: '2026-11-09T12:00:00.000Z',
      source: 'Folha Dirigida',
      description: 'Concurso & vagas novas',
    });
  });

  it('decodifica entidades e tolera data inválida', () => {
    const [, second] = parseRss(FEED);
    expect(second.title).toBe('Banca "Vunesp" definida & contratada');
    expect(second.pubDate).toBeNull();
    expect(second.description).toBe('');
  });

  it('descarta itens sem link e devolve lista vazia para XML sem itens', () => {
    expect(parseRss('<rss><channel></channel></rss>')).toEqual([]);
    expect(parseRss('')).toEqual([]);
  });
});
