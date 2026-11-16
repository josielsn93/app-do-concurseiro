// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildDigest, escapeHtml } from '../../radar/lib/message.js';

const TRACKS = [
  { id: 'tjsp', label: 'TJ-SP' },
  { id: 'pmsp', label: 'Prefeitura de São Paulo' },
];
const NOW = new Date('2026-11-16T12:00:00Z');

function item(over = {}) {
  return {
    id: 'x',
    track: 'tjsp',
    stage: 'autorizado',
    title: 'TJ-SP autoriza concurso',
    link: 'https://n.example/1',
    source: 'Folha',
    publishedAt: '2026-11-10T00:00:00.000Z',
    firstSeen: '2026-11-16T12:00:00.000Z',
    ...over,
  };
}

describe('escapeHtml', () => {
  it('escapa &, < e >', () => {
    expect(escapeHtml('a & b <c>')).toBe('a &amp; b &lt;c&gt;');
  });
});

describe('buildDigest', () => {
  it('monta cabeçalho com data e agrupa novidades por trilha', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [item(), item({ track: 'pmsp', title: 'Prefeitura prevê concurso', stage: 'previsto', link: 'https://n.example/2' })],
      items: [],
      now: NOW,
    });
    expect(text).toContain('Radar de concursos');
    expect(text).toContain('16/11/2026');
    expect(text).toContain('<b>TJ-SP</b>');
    expect(text).toContain('<b>Prefeitura de São Paulo</b>');
    expect(text).toContain('<a href="https://n.example/1">TJ-SP autoriza concurso</a>');
    expect(text.indexOf('TJ-SP</b>')).toBeLessThan(text.indexOf('Prefeitura de São Paulo</b>'));
  });

  it('ordena itens de uma trilha do estágio mais avançado ao menos avançado', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [
        item({ title: 'Notícia solta', stage: 'noticia', link: 'https://n.example/3' }),
        item({ title: 'Edital publicado', stage: 'edital', link: 'https://n.example/4' }),
      ],
      items: [],
      now: NOW,
    });
    expect(text.indexOf('Edital publicado')).toBeLessThan(text.indexOf('Notícia solta'));
  });

  it('escapa HTML do título e aspas do link', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [item({ title: 'A <b> & B', link: 'https://n.example/?q="x"' })],
      items: [],
      now: NOW,
    });
    expect(text).toContain('A &lt;b&gt; &amp; B');
    expect(text).toContain('href="https://n.example/?q=&quot;x&quot;"');
  });

  it('avisa quando não há novidades e mostra o estágio mais avançado já visto', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [],
      items: [item({ stage: 'banca' })],
      now: NOW,
    });
    expect(text).toContain('Sem novidades');
    expect(text).toMatch(/TJ-SP[^\n]*banca/i);
  });

  it('limita itens por trilha e informa quantos ficaram de fora', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      item({ title: `Item ${i}`, link: `https://n.example/m${i}` })
    );
    const [text] = buildDigest({ tracks: TRACKS, added: many, items: [], now: NOW, maxPerTrack: 5 });
    expect(text).toContain('Item 0');
    expect(text).not.toContain('Item 7');
    expect(text).toContain('+3');
  });

  it('divide em várias mensagens abaixo do limite do Telegram', () => {
    const tracks = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: `Trilha ${i}` }));
    const added = tracks.flatMap((t) =>
      Array.from({ length: 5 }, (_, i) =>
        item({ track: t.id, title: `Título longo ${'x'.repeat(120)} ${t.id}-${i}`, link: `https://n.example/${t.id}/${i}` })
      )
    );
    const texts = buildDigest({ tracks, added, items: [], now: NOW });
    expect(texts.length).toBeGreaterThan(1);
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(4096);
  });
});
