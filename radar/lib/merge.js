import { createHash } from 'node:crypto';
import { STAGE_RANK } from './classify.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function idFor(title) {
  return createHash('sha1').update(normalizeTitle(title)).digest('hex').slice(0, 12);
}

function refTime(item, fallbackMs) {
  const ms = Date.parse(item.publishedAt ?? item.firstSeen ?? '');
  return Number.isNaN(ms) ? fallbackMs : ms;
}

export function mergeRadar(previous, candidates, { now = new Date(), maxAgeDays = 60 } = {}) {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const cutoff = nowMs - maxAgeDays * DAY_MS;

  const known = new Map((previous?.items ?? []).map((item) => [item.id, { ...item }]));
  const seen = new Set();
  const added = [];

  for (const cand of candidates) {
    const publishedMs = cand.publishedAt ? Date.parse(cand.publishedAt) : nowMs;
    if (Number.isFinite(publishedMs) && publishedMs < cutoff) continue;
    const id = idFor(cand.title);
    if (seen.has(id)) continue;
    seen.add(id);

    const existing = known.get(id);
    if (existing) {
      if ((STAGE_RANK[cand.stage] ?? 0) > (STAGE_RANK[existing.stage] ?? 0)) existing.stage = cand.stage;
      continue;
    }
    const item = {
      id,
      track: cand.track,
      stage: cand.stage,
      title: cand.title,
      link: cand.link,
      source: cand.source ?? '',
      publishedAt: cand.publishedAt ?? null,
      firstSeen: nowIso,
    };
    known.set(id, item);
    added.push(item);
  }

  const items = [...known.values()]
    .filter((item) => refTime(item, nowMs) >= cutoff)
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));

  return { radar: { version: 1, generatedAt: nowIso, items }, added };
}
