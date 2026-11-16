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

describe('aulas aprofundadas (conteúdo de 1 hora) das semanas 1 e 2', () => {
  const diasComAula = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];

  it.each(diasComAula)('%s: o bloco de teoria é uma aula completa', async (data) => {
    const { renderLessonNotes } = await import('../../src/js/ui/event-detail-view.js');
    const bloco = plano.dias.find((d) => d.data === data).blocos[0];
    const n = bloco.notas;
    expect(n.length).toBeGreaterThan(3500);
    expect(n.length).toBeLessThan(10000);
    for (const secao of ['## 🎯 Objetivo', '## ⏱ Roteiro', '## 📖 Teoria', '## 🏦 Como a Vunesp cobra', '## ⚠️', '## ✍️ Exercícios', '## 📝 Para o caderno de erros']) {
      expect(n, `${data} sem "${secao}"`).toContain(secao);
    }
    expect((n.match(/\*\*Questão \d/g) || []).length).toBeGreaterThanOrEqual(4);
    expect((n.match(/^::: Gabarito/gm) || []).length).toBeGreaterThanOrEqual(4);
    const html = renderLessonNotes(n);
    expect(html).toContain('<table');
    expect(html).toContain('<details');
    expect(html).not.toContain('**'); // nenhum negrito sem converter
  });

  it('cada questão tem alternativas A a E e a letra do gabarito é uma delas', () => {
    for (const data of diasComAula) {
      const n = plano.dias.find((d) => d.data === data).blocos[0].notas;
      const questoes = n.split(/\*\*Questão \d+\./).slice(1);
      for (const q of questoes) {
        for (const letra of ['A', 'B', 'C', 'D', 'E']) expect(q, `${data}: falta (${letra})`).toContain(`- (${letra})`);
        expect(q).toMatch(/\*\*Letra [A-E]\.\*\*/);
      }
    }
  });
});
