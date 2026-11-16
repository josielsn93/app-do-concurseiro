// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Material privado (gitignored): sem ele (CI, clone novo) a suíte é pulada.
const dir = new URL('../../privado/plano-tjsp/conteudo/', import.meta.url);
const temPrivado = existsSync(dir);
const load = (nome) => readFileSync(new URL(nome, dir), 'utf8');

// Arquivos de aula esperados por sigla (um arquivo por hora de teoria).
const ESPERADOS = {
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
