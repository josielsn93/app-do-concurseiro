import { parseAulaRef } from '../logic/aulas-externas.js?v=8.37';
/**
 * Detalhe do evento: HTML semântico + renderizador seguro das anotações da aula.
 *
 * As anotações (ev.notas) aceitam um subconjunto de Markdown, sempre escapado:
 *   ## Título / ### Subtítulo, parágrafos, listas (- e 1.), > destaque,
 *   tabelas (| a | b |), blocos recolhíveis (::: Título ... :::),
 *   **negrito**, *itálico*, `código` e [texto](https://link).
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return out;
}

const isTableSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

export function renderLessonNotes(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Bloco recolhível: "::: Título" ... ":::"
    const details = line.match(/^:::\s*(.+)$/);
    if (details) {
      const inner = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i]);
        i++;
      }
      i++; // fecha ":::"
      html.push(
        `<details class="lesson-details"><summary>${inline(details[1].trim())}</summary>${renderLessonNotes(inner.join('\n'))}</details>`
      );
      continue;
    }

    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      const tag = h[1].length === 2 ? 'h3' : 'h4';
      html.push(`<${tag} class="lesson-heading">${inline(h[2].trim())}</${tag}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote class="lesson-callout">${inline(quote.join(' ').trim())}</blockquote>`);
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      html.push(
        `<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>${header
          .map((c) => `<th scope="col">${inline(c)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`
      );
      continue;
    }

    if (/^\s*[-•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-•]\s+/, ''));
        i++;
      }
      html.push(`<ul class="lesson-list">${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      html.push(`<ol class="lesson-list">${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,3}\s|>\s?|:::|\s*[-•]\s+|\s*\d+[.)]\s+)/.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length === 0) {
      // linha que começa com "|" sem tabela válida: trata como texto
      para.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return html.join('\n');
}

function formatDateBr(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : dateStr || '—';
}

function metaItem(label, valueHtml) {
  return `<div class="event-meta-item"><dt>${label}</dt><dd>${valueHtml}</dd></div>`;
}

function extraSection(title, value) {
  if (!value) return '';
  return `<section class="event-extra"><h3 class="lesson-heading">${title}</h3><p>${escapeHtml(value)}</p></section>`;
}

/**
 * @param {{ ev: object, status: {label:string,class:string}, disciplina?: string,
 *           assunto?: string, aula?: string, tempo?: string }} data
 */
export function buildEventDetailHtml({ ev, status, disciplina = '', assunto = '', aula = '', tempo = '—' }) {
  const meta = [
    metaItem('Situação', `<span class="badge ${escapeHtml(status.class)}">${escapeHtml(status.label)}</span>`),
    metaItem('Data', escapeHtml(formatDateBr(ev.data))),
    metaItem('Duração', ev.duracao ? `${escapeHtml(ev.duracao)} min` : '—'),
    metaItem('Tempo estudado', escapeHtml(tempo)),
    disciplina ? metaItem('Disciplina', escapeHtml(disciplina)) : '',
    assunto ? metaItem('Assunto', escapeHtml(assunto)) : '',
    aula ? metaItem('Aula', escapeHtml(aula)) : '',
  ].join('');

  const lesson = ev.notas
    ? `<section class="lesson" aria-label="Roteiro da aula">${renderLessonOrRef(ev.notas)}</section>`
    : '';

  return `<article class="event-detail" aria-label="Detalhes do estudo">
  <dl class="event-meta">${meta}</dl>
  ${lesson}
  ${extraSection('Fontes', ev.fontes)}
  ${extraSection('Legislação', ev.legislacao)}
</article>`;
}


/** Aula completa ou espaço reservado quando o texto está guardado à parte. */
export function renderLessonOrRef(notas) {
  const id = parseAulaRef(notas);
  if (!id) return renderLessonNotes(notas);
  return `<div class="lesson-pending" data-aula-id="${escapeHtml(id)}" aria-live="polite"><p>Carregando aula…</p></div>`;
}
