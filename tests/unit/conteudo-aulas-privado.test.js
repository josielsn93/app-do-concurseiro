// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Material privado (gitignored): sem ele (CI, clone novo) a suíte é pulada.
const dir = new URL('../../privado/plano-tjsp/conteudo/', import.meta.url);
const temPrivado = existsSync(dir);
const load = (nome) => readFileSync(new URL(nome, dir), 'utf8');

// Arquivos de aula esperados por sigla (um arquivo por hora de teoria).
const ESPERADOS = {
  PP: ['PP-00-p1', 'PP-00-p2', 'PP-00-p3', 'PP-01-p1', 'PP-01-p2', 'PP-02-p1', 'PP-02-p2', 'PP-02-p3', 'PP-02-p4', 'PP-02-p5', 'PP-02-p6', 'PP-03-p1', 'PP-03-p2', 'PP-04-p1', 'PP-04-p2', 'PP-04-p3', 'PP-04-p4', 'PP-05-p1', 'PP-05-p2', 'PP-05-p3'],
  PC: ['PC-00-p1', 'PC-00-p2', 'PC-01-p1', 'PC-01-p2', 'PC-01-p3', 'PC-01-p4', 'PC-01-p5', 'PC-01-p6', 'PC-01-p7', 'PC-02-p1', 'PC-02-p2', 'PC-02-p3', 'PC-02-p4', 'PC-03-p1', 'PC-03-p2', 'PC-03-p3', 'PC-03-p4', 'PC-03-p5', 'PC-03-p6', 'PC-03-p7', 'PC-03-p8', 'PC-03-p9', 'PC-03-p10', 'PC-03-p11', 'PC-04-p1', 'PC-04-p2', 'PC-04-p3', 'PC-04-p4', 'PC-05', 'PC-06-p1', 'PC-06-p2'],
  DA: ['DA-00-p1', 'DA-00-p2', 'DA-00-p3', 'DA-00-p4', 'DA-01', 'DA-02-p1', 'DA-02-p2', 'DA-02-p3', 'DA-03-p1', 'DA-03-p2'],
};

const SECOES = ['## 🎯', '## ⏱', '## 📖', '## 🏦', '## ⚠️', '## ✍️', '## 📝', '## 📚'];

describe.skipIf(!temPrivado)('arquivos de aula (estrutura de apostila de 1 hora)', () => {
  for (const [sigla, arquivos] of Object.entries(ESPERADOS)) {
    describe(sigla, () => {
      for (const a of arquivos) {
        it(`${a}.md é uma aula completa`, () => {
          expect(existsSync(new URL(`${a}.md`, dir)), 'arquivo existe').toBe(true);
          const t = load(`${a}.md`);
          expect(t.length).toBeGreaterThan(3500);
          expect(t.length).toBeLessThan(10000);
          for (const s of SECOES) expect(t, s).toContain(s);
          for (const n of [1, 2, 3, 4, 5]) {
            expect(t, `questão ${n}`).toContain(`**Questão ${n}.**`);
            expect(t, `gabarito ${n}`).toContain(`::: Gabarito da questão ${n}`);
          }
          for (const l of ['(A)', '(B)', '(C)', '(D)', '(E)']) expect(t).toContain(l);
        });
      }
    });
  }
});
