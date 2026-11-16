// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isTrusted } from '../../radar/lib/trust.js';

const TRUSTED = {
  domains: ['.gov.br', '.jus.br'],
  names: ['Folha Dirigida', 'G1', 'PCI Concursos'],
};

describe('isTrusted', () => {
  it('aceita fonte pelo nome, inclusive quando o nome contém o veículo', () => {
    expect(isTrusted({ source: 'Folha Dirigida' }, TRUSTED)).toBe(true);
    expect(isTrusted({ source: 'Qconcursos Folha Dirigida' }, TRUSTED)).toBe(true);
    expect(isTrusted({ source: 'pci concursos' }, TRUSTED)).toBe(true);
  });

  it('compara palavras inteiras, sem casar parte de outro nome', () => {
    expect(isTrusted({ source: 'Magazine G10 Cursos' }, TRUSTED)).toBe(false);
  });

  it('aceita site oficial pelo domínio, mesmo com nome desconhecido', () => {
    expect(isTrusted({ source: 'Portal', sourceUrl: 'https://www.tjsp.jus.br/Noticias' }, TRUSTED)).toBe(true);
    expect(isTrusted({ source: 'Portal', sourceUrl: 'https://www.sp.gov.br' }, TRUSTED)).toBe(true);
  });

  it('recusa fontes fora da lista e entradas vazias', () => {
    expect(isTrusted({ source: 'Blog Gran Cursos Online' }, TRUSTED)).toBe(false);
    expect(isTrusted({ source: 'X', sourceUrl: 'https://blog.example.com' }, TRUSTED)).toBe(false);
    expect(isTrusted({ source: '' }, TRUSTED)).toBe(false);
    expect(isTrusted({ source: 'Folha Dirigida' }, {})).toBe(false);
  });
});
