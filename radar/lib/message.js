import { STAGE_RANK } from './classify.js';

const STAGE_LABEL = {
  edital: 'edital publicado',
  banca: 'banca definida',
  comissao: 'comissão formada',
  autorizado: 'autorizado',
  previsto: 'previsão',
  noticia: 'notícia',
};

const LIMIT = 3900;
const FOOTER =
  '<i>Classificação automática por palavras-chave: confira sempre a fonte antes de agir.</i>';

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

function shorten(text, max = 160) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function topStage(entries) {
  return entries.reduce(
    (best, e) => ((STAGE_RANK[e.stage] ?? 0) > (STAGE_RANK[best] ?? -1) ? e.stage : best),
    'noticia'
  );
}

function trackBlock(track, news, all, maxPerTrack) {
  const stage = topStage([...news, ...all]);
  const lines = [`<b>${escapeHtml(track.label)}</b> — mais avançado: ${STAGE_LABEL[stage]}`];
  const sorted = [...news].sort((a, b) => (STAGE_RANK[b.stage] ?? 0) - (STAGE_RANK[a.stage] ?? 0));
  for (const item of sorted.slice(0, maxPerTrack)) {
    const src = item.source ? ` — ${escapeHtml(item.source)}` : '';
    lines.push(
      `• [${STAGE_LABEL[item.stage]}] <a href="${escapeAttr(item.link)}">${escapeHtml(shorten(item.title))}</a>${src}`
    );
  }
  if (sorted.length > maxPerTrack) lines.push(`+${sorted.length - maxPerTrack} outras notícias nesta trilha`);
  return lines.join('\n');
}

export function buildDigest({ tracks, added, items, now = new Date(), maxPerTrack = 5 }) {
  const header = `<b>📡 Radar de concursos — ${formatDate(now)}</b>`;
  const summary = added.length
    ? `${added.length} novidade${added.length > 1 ? 's' : ''} nesta semana.`
    : 'Sem novidades nesta semana.';

  const blocks = [];
  for (const track of tracks) {
    const news = added.filter((i) => i.track === track.id);
    const all = items.filter((i) => i.track === track.id);
    if (!news.length && !all.length) continue;
    blocks.push(trackBlock(track, news, all, maxPerTrack));
  }

  const messages = [];
  let current = `${header}\n${summary}`;
  for (const block of blocks) {
    if (current.length + block.length + 2 > LIMIT) {
      messages.push(current);
      current = `<b>📡 Radar de concursos (continuação)</b>`;
    }
    current += `\n\n${block}`;
  }
  if (current.length + FOOTER.length + 2 > LIMIT) {
    messages.push(current);
    current = FOOTER;
  } else {
    current += `\n\n${FOOTER}`;
  }
  messages.push(current);
  return messages;
}
