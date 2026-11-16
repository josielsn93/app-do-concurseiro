import { STAGE_RANK } from './classify.js';

const STAGE_TAG = { autorizado: 'autorizado', comissao: 'comissão', banca: 'banca' };

const LIMIT = 3900;
const FOOTER = '<i>Estágio detectado automaticamente; confira o link.</i>';

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function formatDate(now) {
  return now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function shorten(text, max = 110) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function line(item, withTag) {
  const tag = withTag ? `[${STAGE_TAG[item.stage] ?? item.stage}] ` : '';
  const source = item.source ? ` — ${escapeHtml(item.source)}` : '';
  return `• ${tag}<a href="${escapeAttr(item.link)}">${escapeHtml(shorten(item.title))}</a>${source}`;
}

function trackBlock(track, news, maxPerTrack) {
  const prep = news
    .filter((i) => i.stage !== 'edital')
    .sort((a, b) => (STAGE_RANK[b.stage] ?? 0) - (STAGE_RANK[a.stage] ?? 0));
  const published = news.filter((i) => i.stage === 'edital');
  const ordered = [...prep, ...published];
  const shown = ordered.slice(0, maxPerTrack);
  const shownPrep = shown.filter((i) => i.stage !== 'edital');
  const shownPublished = shown.filter((i) => i.stage === 'edital');

  const lines = [`<b>${escapeHtml(track.label)}</b>`];
  if (shownPrep.length) {
    lines.push('<i>Em preparação</i>', ...shownPrep.map((i) => line(i, true)));
  }
  if (shownPublished.length) {
    lines.push('<i>Edital publicado</i>', ...shownPublished.map((i) => line(i, false)));
  }
  if (ordered.length > shown.length) lines.push(`+${ordered.length - shown.length} outras`);
  return lines.join('\n');
}

export function buildDigest({ tracks, added, now = new Date(), maxPerTrack = 3 }) {
  const header = `<b>📡 Radar de concursos — ${formatDate(now)}</b>`;
  const summary = added.length
    ? `${added.length} novidade${added.length > 1 ? 's' : ''} confirmada${added.length > 1 ? 's' : ''}.`
    : 'Sem novidades confirmadas nesta semana.';

  const blocks = [];
  for (const track of tracks) {
    const news = added.filter((i) => i.track === track.id);
    if (news.length) blocks.push(trackBlock(track, news, maxPerTrack));
  }

  const messages = [];
  let current = `${header}\n${summary}`;
  for (const block of blocks) {
    if (current.length + block.length + 2 > LIMIT) {
      messages.push(current);
      current = '<b>📡 Radar de concursos (continuação)</b>';
    }
    current += `\n\n${block}`;
  }
  if (blocks.length) {
    if (current.length + FOOTER.length + 2 > LIMIT) {
      messages.push(current);
      current = FOOTER;
    } else {
      current += `\n\n${FOOTER}`;
    }
  }
  messages.push(current);
  return messages;
}
