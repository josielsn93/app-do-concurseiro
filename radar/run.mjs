import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseRss } from './lib/rss.js';
import { classify } from './lib/classify.js';
import { mergeRadar } from './lib/merge.js';
import { buildDigest } from './lib/message.js';
import { sendTelegram } from './lib/telegram.js';

const here = dirname(fileURLToPath(import.meta.url));

export function buildFeedUrl(query, days) {
  const q = encodeURIComponent(`${query} when:${days}d`);
  return `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

function loadPrevious(file, log) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    log('radar.json anterior ilegível; recomeçando do zero');
    return null;
  }
}

export async function runRadar({
  sources,
  fetchImpl = fetch,
  dataDir,
  now = new Date(),
  env = process.env,
  log = console.log,
  windowDays = 21,
}) {
  const file = join(dataDir, 'radar.json');
  const previous = loadPrevious(file, log);
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  const canSend = Boolean(token && chatId);

  const candidates = [];
  let total = 0;
  let failed = 0;

  for (const track of sources.tracks) {
    for (const query of track.queries) {
      total += 1;
      try {
        const res = await fetchImpl(buildFeedUrl(query, windowDays), {
          signal: AbortSignal.timeout(20000),
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; app-do-concurseiro-radar)' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const entry of parseRss(await res.text())) {
          const verdict = classify(`${entry.title} ${entry.description}`);
          if (!verdict.relevant) continue;
          candidates.push({
            track: track.id,
            stage: verdict.stage,
            title: entry.title,
            link: entry.link,
            source: entry.source,
            publishedAt: entry.pubDate,
          });
        }
      } catch (err) {
        failed += 1;
        log(`Fonte falhou (${track.id}: ${query}): ${err.message}`);
      }
    }
  }

  if (total > 0 && failed === total) {
    if (canSend) {
      await sendTelegram({
        token,
        chatId,
        texts: ['⚠️ Radar de concursos: todas as fontes falharam nesta execução. O radar anterior foi mantido.'],
        fetchImpl,
      }).catch((err) => log(`Alerta no Telegram falhou: ${err.message}`));
    }
    throw new Error('Todas as fontes falharam');
  }

  const { radar, added } = mergeRadar(previous, candidates, { now });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(radar, null, 2)}\n`);

  let telegramSent = 0;
  if (canSend) {
    const texts = buildDigest({ tracks: sources.tracks, added, items: radar.items, now });
    telegramSent = await sendTelegram({ token, chatId, texts, fetchImpl });
  } else {
    log('Telegram não configurado (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID); resumo não enviado.');
  }

  return {
    added: added.length,
    items: radar.items.length,
    failedSources: failed,
    totalSources: total,
    telegramSent,
  };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const sources = JSON.parse(readFileSync(join(here, 'sources.json'), 'utf8'));
  const dataDir = process.env.RADAR_DATA_DIR ?? join(here, 'data');
  runRadar({ sources, dataDir })
    .then((summary) => console.log(JSON.stringify(summary)))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
