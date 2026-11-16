import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

// Estratégia de concurso (bancas, conteúdo de estudo, planos, editais verticalizados)
// não pode ir para o repositório público. Fica em /privado (ignorada pelo git).
const PRIVADOS = [
  'privado/estrategia/x.md',
  'privado/plano-tjsp/conteudo/LP-00.md',
  'privado/cronogramas/plano.json',
  'privado/editais/edital.json',
  'docs/estrategia/x.md',
  'docs/plano-tjsp/x.md',
  'docs/cronogramas/x.json',
  'docs/editais/x.json',
];

describe('privacidade da estratégia de concursos', () => {
  it.each(PRIVADOS)('%s é ignorado pelo git', (p) => {
    expect(() => git('check-ignore', '-q', p)).not.toThrow();
  });

  it('nenhum arquivo privado está versionado', () => {
    const tracked = git('ls-files').split('\n').filter(Boolean);
    const vazados = tracked.filter((f) => /^(privado\/|docs\/(estrategia|plano-tjsp|cronogramas|editais)\/)/.test(f));
    expect(vazados).toEqual([]);
  });
});
