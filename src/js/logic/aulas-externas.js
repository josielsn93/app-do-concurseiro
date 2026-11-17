/**
 * Aulas longas fora do estado sincronizado.
 *
 * O estado do app vai inteiro para um único documento do Firestore (limite de
 * 1 MiB). Um plano com aulas completas passa disso, então na importação cada
 * nota longa vira uma referência curta (`::aula:<id>::`) e o texto é guardado à
 * parte, identificado pelo próprio conteúdo (mesmo texto = mesmo id).
 */

export const AULA_MIN_CHARS = 1200;
const REF_RE = /::aula:(a_[0-9a-f]+_\d+)::/;

/** Hash não criptográfico de 53 bits (cyrb53); suficiente para identificar conteúdo. */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function aulaIdFor(text) {
  const value = String(text ?? '');
  return `a_${cyrb53(value).toString(16)}_${value.length}`;
}

function firstHeading(text) {
  const line = String(text)
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line || 'Aula').replace(/^#+\s*/, '').slice(0, 120);
}

export function buildAulaStub(text, id = aulaIdFor(text)) {
  return `📖 Aula completa: ${firstHeading(text)}\n\n::aula:${id}::`;
}

export function parseAulaRef(notas) {
  if (typeof notas !== 'string') return null;
  const match = REF_RE.exec(notas);
  return match ? match[1] : null;
}

/**
 * Troca notas longas por referência.
 * @returns {{ payload: object, aulas: Map<string,string> }}
 */
export function externalizeLessonNotes(payload, { minChars = AULA_MIN_CHARS } = {}) {
  const aulas = new Map();
  const next = JSON.parse(JSON.stringify(payload ?? {}));
  for (const dia of Array.isArray(next.dias) ? next.dias : []) {
    for (const bloco of Array.isArray(dia?.blocos) ? dia.blocos : []) {
      const notas = bloco?.notas;
      if (typeof notas !== 'string' || notas.length < minChars || parseAulaRef(notas)) continue;
      const id = aulaIdFor(notas);
      aulas.set(id, notas);
      bloco.notas = buildAulaStub(notas, id);
    }
  }
  return { payload: next, aulas };
}
