// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mergeRadar, normalizeTitle } from '../../radar/lib/merge.js';

const NOW = new Date('2026-11-16T12:00:00Z');

function cand(over = {}) {
  return {
    track: 'tjsp',
    stage: 'autorizado',
    title: 'TJ-SP autoriza concurso',
    link: 'https://n.example/1',
    source: 'Folha',
    publishedAt: '2026-11-10T00:00:00.000Z',
    ...over,
  };
}

describe('normalizeTitle', () => {
  it('ignora acentos, caixa e pontuação', () => {
    expect(normalizeTitle('TJ-SP: Autoriza Concurso!')).toBe(
      normalizeTitle('tj sp autoriza concurso')
    );
  });
});

describe('mergeRadar', () => {
  it('cria o radar do zero e marca tudo como novo', () => {
    const { radar, added } = mergeRadar(null, [cand()], { now: NOW });
    expect(radar.version).toBe(1);
    expect(radar.generatedAt).toBe('2026-11-16T12:00:00.000Z');
    expect(radar.items).toHaveLength(1);
    expect(radar.items[0].firstSeen).toBe('2026-11-16T12:00:00.000Z');
    expect(added).toHaveLength(1);
  });

  it('não repete item já visto e preserva firstSeen', () => {
    const first = mergeRadar(null, [cand()], { now: new Date('2026-11-09T12:00:00Z') });
    const second = mergeRadar(first.radar, [cand()], { now: NOW });
    expect(second.added).toHaveLength(0);
    expect(second.radar.items).toHaveLength(1);
    expect(second.radar.items[0].firstSeen).toBe('2026-11-09T12:00:00.000Z');
  });

  it('deduplica a mesma notícia em trilhas diferentes, mantendo a primeira', () => {
    const { radar } = mergeRadar(
      null,
      [cand({ track: 'tjsp' }), cand({ track: 'federal', link: 'https://n.example/2' })],
      { now: NOW }
    );
    expect(radar.items).toHaveLength(1);
    expect(radar.items[0].track).toBe('tjsp');
  });

  it('descarta candidatos e itens mais velhos que a janela', () => {
    const old = cand({ title: 'Antigo', link: 'https://n.example/old', publishedAt: '2026-06-01T00:00:00.000Z' });
    const { radar, added } = mergeRadar(null, [old, cand()], { now: NOW, maxAgeDays: 60 });
    expect(radar.items.map((i) => i.title)).toEqual(['TJ-SP autoriza concurso']);
    expect(added).toHaveLength(1);

    const later = mergeRadar(radar, [], { now: new Date('2027-03-01T00:00:00Z'), maxAgeDays: 60 });
    expect(later.radar.items).toHaveLength(0);
  });

  it('usa firstSeen quando a notícia não tem data de publicação', () => {
    const { radar } = mergeRadar(null, [cand({ publishedAt: null })], { now: NOW });
    expect(radar.items).toHaveLength(1);
    expect(radar.items[0].publishedAt).toBeNull();
  });

  it('atualiza o estágio quando o mesmo item reaparece mais avançado', () => {
    const first = mergeRadar(null, [cand({ stage: 'previsto' })], { now: new Date('2026-11-09T12:00:00Z') });
    const second = mergeRadar(first.radar, [cand({ stage: 'edital' })], { now: NOW });
    expect(second.radar.items[0].stage).toBe('edital');
    expect(second.added).toHaveLength(0);
  });
});
