// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeNameKey, validateRetaFinalPayload } from '../../src/js/logic/reta-final-core.js';

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
// Material privado (gitignored): sem ele (CI, clone novo) a suíte é pulada.
const temPrivado = existsSync(new URL('../../privado/cronogramas/plano-tjsp-escrevente-2026.json', import.meta.url));
const plano = temPrivado ? read('../../privado/cronogramas/plano-tjsp-escrevente-2026.json') : null;
const edital = temPrivado ? read('../../privado/editais/edital-tjsp-escrevente-2026.json') : null;

describe.skipIf(!temPrivado)('plano de estudos TJ-SP Escrevente (cronograma dia a dia)', () => {
  it('é aceito pelo importador de cronograma', () => {
    expect(validateRetaFinalPayload(plano)).toEqual({ valid: true, errors: [] });
  });

  it('começa em 16/11/2026 e termina na prova (14/03/2027)', () => {
    expect(plano.dias[0].data).toBe('2026-11-16');
    expect(plano.dataFinal).toBe('2027-03-14');
    expect(plano.dias.at(-1).data).toBe('2027-03-14');
  });

  it('só tem dias úteis (seg a sex), exceto o dia da prova', () => {
    for (const { data } of plano.dias) {
      if (data === '2027-03-14') continue;
      const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
      expect(dow, data).toBeGreaterThanOrEqual(1);
      expect(dow, data).toBeLessThanOrEqual(5);
    }
  });

  it('revisões 24h / 7d / 30d ancoradas na data em que cada assunto foi estudado', () => {
    const add = (iso, n) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
    const ultima = plano.dias.at(-1).data;
    const porTopico = new Map(); // chave -> { primeira data de teoria, revisões }
    for (const dia of plano.dias) {
      for (const b of dia.blocos) {
        const n = b.notas || '';
        const chave = `${normalizeNameKey(b.disciplina)}|${normalizeNameKey(b.topicos[0])}`;
        const rev = /^Revisão de (1 dia|7 dias|30 dias)/.exec(n);
        const e = porTopico.get(chave) || { teoria: null, r: {} };
        if (rev) e.r[rev[1]] = e.r[rev[1]] || dia.data;
        else if (!/Revisão ativa|simulado|caderno/i.test(n.slice(0, 40)) && b.disciplina !== 'Simulados e Revisão' && !/Questões da banca/.test(b.topicos[0])) e.teoria = dia.data;
        porTopico.set(chave, e);
      }
    }
    let checados = 0;
    for (const [chave, e] of porTopico) {
      if (!e.teoria || chave.startsWith('redacao')) continue;
      const d1 = add(e.teoria, 1), d7 = add(e.teoria, 7), d30 = add(e.teoria, 30);
      if (d1 <= ultima) { expect(e.r['1 dia'], `${chave} R1`).toBeDefined(); expect(e.r['1 dia'] >= d1 && e.r['1 dia'] <= add(e.teoria, 5), `${chave} R1 fora da janela`).toBe(true); }
      if (d7 <= ultima && add(e.teoria, 11) < ultima) { expect(e.r['7 dias'], `${chave} R7`).toBeDefined(); expect(e.r['7 dias'] >= add(e.teoria, 5) && e.r['7 dias'] <= add(e.teoria, 11), `${chave} R7 fora da janela`).toBe(true); }
      if (add(e.teoria, 35) < ultima) { expect(e.r['30 dias'], `${chave} R30`).toBeDefined(); expect(e.r['30 dias'] >= add(e.teoria, 28) && e.r['30 dias'] <= add(e.teoria, 35), `${chave} R30 fora da janela`).toBe(true); }
      checados++;
    }
    expect(checados).toBeGreaterThan(30);
  });

  it('bloco de questões do dia tem meta numérica e pede registro de acertos', () => {
    const qs = plano.dias.flatMap((d) => d.blocos.filter((b) => b.topicos.includes('Questões da banca Vunesp')));
    expect(qs.length).toBeGreaterThan(20);
    for (const b of qs) {
      expect(b.notas).toMatch(/Meta:/);
      expect(b.notas).toMatch(/acertos/i);
    }
  });

  it('semana 1 tem mini-diagnóstico com questões reais da Vunesp', () => {
    const sem1 = plano.dias.filter((d) => d.data <= '2026-11-20');
    expect(sem1.some((d) => d.blocos.some((b) => b.topicos.includes('Diagnóstico — prova anterior Vunesp')))).toBe(true);
  });

  it('Legislação Interna manda conferir a versão vigente da norma', () => {
    const li = plano.dias.flatMap((d) => d.blocos.filter((b) => b.disciplina.startsWith('Legislação Interna') && !/^Revisão/.test(b.notas) && !b.topicos.includes('Questões da banca Vunesp')));
    expect(li.length).toBeGreaterThan(3);
    for (const b of li) expect(b.notas).toMatch(/versão vigente/i);
  });

  it('Matemática, Raciocínio Lógico e Informática são práticas (fazer, não só ler)', () => {
    for (const dia of plano.dias) {
      for (const b of dia.blocos) {
        if (/^(Matemática|Raciocínio|Informática)/.test(b.disciplina) && !/^Revisão|Questões/.test(b.notas) && !b.topicos.some((t) => /Questões da banca|Simulado|Revisão/.test(t))) {
          expect(b.notas, `${dia.data} ${b.disciplina}`).toMatch(/Pratique|Faça/);
        }
      }
    }
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
    expect(topicos.some((t) => t.includes('TRF3'))).toBe(true); // lembrete opcional (prova é domingo)
    expect(topicos.some((t) => t.startsWith('Revisão de erros'))).toBe(true);
  });
});

describe.skipIf(!temPrivado)('aulas aprofundadas (conteúdo de 1 hora) das semanas 1 e 2', () => {
  const diasComAula = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];

  it.each(diasComAula)('%s: o bloco de teoria é uma aula completa', async (data) => {
    const { renderLessonNotes } = await import('../../src/js/ui/event-detail-view.js');
    const bloco = plano.dias.find((d) => d.data === data).blocos.find((b) => (b.notas || '').startsWith('## 🎯'));
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
      const n = plano.dias.find((d) => d.data === data).blocos.find((b) => (b.notas || '').startsWith('## 🎯')).notas;
      const questoes = n.split(/\*\*Questão \d+\./).slice(1);
      for (const q of questoes) {
        for (const letra of ['A', 'B', 'C', 'D', 'E']) expect(q, `${data}: falta (${letra})`).toContain(`- (${letra})`);
        expect(q).toMatch(/\*\*Letra [A-E]\.\*\*/);
      }
    }
  });
});
