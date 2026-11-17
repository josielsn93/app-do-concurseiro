import { describe, expect, it } from 'vitest';
import {
  aulaIdFor,
  buildAulaStub,
  externalizeLessonNotes,
  parseAulaRef,
} from '../../src/js/logic/aulas-externas.js';

const AULA = '## 🎯 Objetivo desta hora\n' + 'Texto da aula. '.repeat(200);
const CURTA = 'Revisão de 1 dia: refaça de memória.';

describe('aulaIdFor', () => {
  it('é determinístico e depende do conteúdo', () => {
    expect(aulaIdFor(AULA)).toBe(aulaIdFor(AULA));
    expect(aulaIdFor(AULA)).not.toBe(aulaIdFor(AULA + '.'));
    expect(aulaIdFor(AULA)).toMatch(/^a_[0-9a-f]+_\d+$/);
  });
});

describe('buildAulaStub / parseAulaRef', () => {
  it('gera um resumo curto com a referência e a recupera', () => {
    const id = aulaIdFor(AULA);
    const stub = buildAulaStub(AULA, id);
    expect(stub.length).toBeLessThan(300);
    expect(stub).toContain('Objetivo desta hora');
    expect(parseAulaRef(stub)).toBe(id);
  });

  it('retorna null quando não há referência', () => {
    expect(parseAulaRef(AULA)).toBeNull();
    expect(parseAulaRef('')).toBeNull();
    expect(parseAulaRef(undefined)).toBeNull();
  });
});

describe('externalizeLessonNotes', () => {
  const payload = () => ({
    versao: 1,
    nome: 'Plano',
    dataFinal: '2027-03-14',
    dias: [
      { data: '2026-11-16', blocos: [{ disciplina: 'LP', topicos: ['a'], notas: AULA }] },
      { data: '2026-11-17', blocos: [{ disciplina: 'LP', topicos: ['b'], notas: CURTA }, { disciplina: 'LP', topicos: ['c'] }] },
      { data: '2026-11-18', blocos: [{ disciplina: 'LP', topicos: ['d'], notas: AULA }] },
    ],
  });

  it('troca só as notas longas por referência e devolve as aulas separadas', () => {
    const { payload: p, aulas } = externalizeLessonNotes(payload());
    const id = aulaIdFor(AULA);
    expect(parseAulaRef(p.dias[0].blocos[0].notas)).toBe(id);
    expect(p.dias[1].blocos[0].notas).toBe(CURTA);
    expect('notas' in p.dias[1].blocos[1]).toBe(false);
    expect(aulas.get(id)).toBe(AULA);
    expect(aulas.size).toBe(1);
    expect(parseAulaRef(p.dias[2].blocos[0].notas)).toBe(id);
  });

  it('não altera o payload original', () => {
    const original = payload();
    externalizeLessonNotes(original);
    expect(original.dias[0].blocos[0].notas).toBe(AULA);
  });

  it('é idempotente (referência já existente permanece)', () => {
    const uma = externalizeLessonNotes(payload());
    const duas = externalizeLessonNotes(uma.payload);
    expect(duas.payload).toEqual(uma.payload);
    expect(duas.aulas.size).toBe(0);
  });

  it('reduz o tamanho do payload de forma relevante', () => {
    const { payload: p } = externalizeLessonNotes(payload());
    expect(JSON.stringify(p).length).toBeLessThan(JSON.stringify(payload()).length / 4);
  });
});
