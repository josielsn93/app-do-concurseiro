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
  it('monta cabeçalho com data e agrupa por trilha, na ordem configurada', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [
        item({ track: 'pmsp', title: 'Prefeitura forma comissão', stage: 'comissao', link: 'https://n.example/2' }),
        item(),
      ],
      now: NOW,
    });
    expect(text).toContain('Radar de concursos');
    expect(text).toContain('16/11/2026');
    expect(text).toContain('2 novidades');
    expect(text).toContain('<b>TJ-SP</b>');
    expect(text).toContain('<b>Prefeitura de São Paulo</b>');
    expect(text).toContain('<a href="https://n.example/1">TJ-SP autoriza concurso</a> — Folha');
    expect(text.indexOf('<b>TJ-SP</b>')).toBeLessThan(text.indexOf('<b>Prefeitura de São Paulo</b>'));
  });

  it('separa "Em preparação" de "Edital publicado", preparação primeiro', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [
        item({ title: 'TJ-SP divulga edital', stage: 'edital', link: 'https://n.example/4' }),
        item({ title: 'Comissão do concurso é formada', stage: 'comissao', link: 'https://n.example/5' }),
      ],
      now: NOW,
    });
    expect(text).toContain('<i>Em preparação</i>');
    expect(text).toContain('<i>Edital publicado</i>');
    expect(text.indexOf('<i>Em preparação</i>')).toBeLessThan(text.indexOf('Comissão do concurso é formada'));
    expect(text.indexOf('Comissão do concurso é formada')).toBeLessThan(text.indexOf('<i>Edital publicado</i>'));
    expect(text.indexOf('<i>Edital publicado</i>')).toBeLessThan(text.indexOf('TJ-SP divulga edital'));
    expect(text).toContain('[comissão]');
  });

  it('ordena a preparação do estágio mais avançado ao menos avançado', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [
        item({ title: 'Autorizado A', stage: 'autorizado', link: 'https://n.example/6' }),
        item({ title: 'Banca B', stage: 'banca', link: 'https://n.example/7' }),
      ],
      now: NOW,
    });
    expect(text.indexOf('Banca B')).toBeLessThan(text.indexOf('Autorizado A'));
  });

  it('escapa HTML do título e aspas do link', () => {
    const [text] = buildDigest({
      tracks: TRACKS,
      added: [item({ title: 'A <b> & B', link: 'https://n.example/?q="x"' })],
      now: NOW,
    });
    expect(text).toContain('A &lt;b&gt; &amp; B');
    expect(text).toContain('href="https://n.example/?q=&quot;x&quot;"');
  });

  it('sem novidades, avisa em uma linha e não lista trilhas', () => {
    const [text] = buildDigest({ tracks: TRACKS, added: [], now: NOW });
    expect(text).toContain('Sem novidades confirmadas');
    expect(text).not.toContain('<b>TJ-SP</b>');
  });

  it('mostra no máximo 3 itens por trilha e informa quantos ficaram de fora', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      item({ title: `Item ${i}`, link: `https://n.example/m${i}` })
    );
    const [text] = buildDigest({ tracks: TRACKS, added: many, now: NOW });
    expect(text).toContain('Item 0');
    expect(text).toContain('Item 2');
    expect(text).not.toContain('Item 3');
    expect(text).toContain('+2');
  });

  it('divide em várias mensagens abaixo do limite do Telegram', () => {
    const tracks = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: `Trilha ${i}` }));
    const added = tracks.flatMap((t) =>
      Array.from({ length: 3 }, (_, i) =>
        item({ track: t.id, title: `Título longo ${'x'.repeat(120)} ${t.id}-${i}`, link: `https://n.example/${t.id}/${i}` })
      )
    );
    const texts = buildDigest({ tracks, added, now: NOW });
    expect(texts.length).toBeGreaterThan(1);
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(4096);
  });
});
