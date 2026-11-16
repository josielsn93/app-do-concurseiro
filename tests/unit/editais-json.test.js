// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateEditalImportPayload } from '../../src/js/logic/edital-import-core.js';

const DIR = new URL('../../privado/editais/', import.meta.url);
// Material privado (gitignored): sem ele (CI, clone novo) a suíte é pulada.
const temPrivado = existsSync(DIR);
const files = temPrivado ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];

describe.skipIf(!temPrivado)('JSONs de edital em privado/editais', () => {
  it('existe ao menos um edital', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe.each(files)('%s', (file) => {
    const payload = JSON.parse(readFileSync(new URL(file, DIR), 'utf8'));

    it('é aceito pelo importador do app', () => {
      expect(validateEditalImportPayload(payload).valid).toBe(true);
    });

    it('tem uma aula para cada tópico (a Home sugere "próxima ação" a partir das aulas)', () => {
      for (const disc of payload.disciplinas) {
        expect(disc.aulas.length, disc.nome).toBe(disc.topicos.length);
        expect(disc.aulas.map((a) => a.nome), disc.nome).toEqual(disc.topicos.map((t) => t.nome));
      }
    });
  });
});
