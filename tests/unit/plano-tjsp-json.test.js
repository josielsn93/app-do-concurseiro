// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeNameKey, validateRetaFinalPayload } from '../../src/js/logic/reta-final-core.js';

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const plano = read('../../docs/cronogramas/plano-tjsp-escrevente-2026.json');
const edital = read('../../docs/editais/edital-tjsp-escrevente-2026.json');

describe('plano de estudos TJ-SP Escrevente (cronograma dia a dia)', () => {
  it('é aceito pelo importador de cronograma', () => {
    expect(validateRetaFinalPayload(plano)).toEqual({ valid: true, errors: [] });
  });

  it('começa em 16/11/2026 e termina na prova (14/03/2027)', () => {
    expect(plano.dias[0].data).toBe('2026-11-16');
    expect(plano.dataFinal).toBe('2027-03-14');
    expect(plano.dias.at(-1).data).toBe('2027-03-14');
  });

  it('todo bloco usa disciplina e tópicos que existem no edital importado', () => {
    const discs = new Map(
      edital.disciplinas.map((d) => [normalizeNameKey(d.nome), new Set(d.topicos.map((t) => normalizeNameKey(t.nome)))])
    );
    for (const dia of plano.dias) {
      for (const b of dia.blocos) {
        const topicos = discs.get(normalizeNameKey(b.disciplina));
        expect(topicos, `${dia.data}: disciplina "${b.disciplina}"`).toBeDefined();
        for (const t of b.topicos) expect(topicos.has(normalizeNameKey(t)), `${dia.data}: "${t}"`).toBe(true);
      }
    }
  });

  it('todo tópico do edital é estudado ao menos uma vez', () => {
    const usados = new Set(plano.dias.flatMap((d) => d.blocos.flatMap((b) => b.topicos.map((t) => `${normalizeNameKey(b.disciplina)}|${normalizeNameKey(t)}`))));
    for (const d of edital.disciplinas) {
      for (const t of d.topicos) {
        expect(usados.has(`${normalizeNameKey(d.nome)}|${normalizeNameKey(t.nome)}`), `${d.nome}: ${t.nome}`).toBe(true);
      }
    }
  });

  it('todo bloco tem duração e orientação de estudo (notas) preenchidas', () => {
    for (const dia of plano.dias) {
      for (const b of dia.blocos) {
        expect(b.minutos, dia.data).toBeGreaterThan(0);
        expect((b.notas || '').length, `${dia.data} ${b.disciplina}`).toBeGreaterThan(40);
      }
    }
  });

  it('não há dois dias com a mesma data e o tempo fica entre 1h e 6h por dia (exceto simulados)', () => {
    const datas = plano.dias.map((d) => d.data);
    expect(new Set(datas).size).toBe(datas.length);
    for (const dia of plano.dias) {
      const min = dia.blocos.reduce((s, b) => s + b.minutos, 0);
      const simulado = dia.blocos.some((b) => /simulado|prova/i.test(b.topicos.join(' ')));
      expect(min, dia.data).toBeGreaterThanOrEqual(60);
      if (!simulado) expect(min, dia.data).toBeLessThanOrEqual(360);
    }
  });

  it('tem os quatro simulados, a prova TRF3 e revisão de erros', () => {
    const topicos = plano.dias.flatMap((d) => d.blocos.flatMap((b) => b.topicos));
    for (const n of [1, 2, 3, 4]) expect(topicos.some((t) => t.startsWith(`Simulado ${n}`))).toBe(true);
    expect(topicos.some((t) => t.includes('TRF3'))).toBe(true);
    expect(topicos.some((t) => t.startsWith('Revisão de erros'))).toBe(true);
  });
});
