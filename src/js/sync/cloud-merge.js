/**
 * Mesclagem entre aparelhos para a sincronização com a nuvem.
 *
 * Função pura: recebe o estado deste aparelho e o estado da nuvem e devolve um
 * estado único, sem nunca bloquear. Regras:
 *  - Coleções (editais, eventos, arquivo, revisoes, disciplinas, hábitos):
 *    união por id; no mesmo item vence a edição mais recente; um item apagado
 *    (tombstone) não volta, a menos que tenha sido editado depois de apagado.
 *  - Plano com a mesma identidade: vence o editado por último; o status dos
 *    blocos é recalculado a partir dos eventos estudados.
 *  - Planos com identidades diferentes (o mesmo arquivo importado em dois
 *    aparelhos): vence a importação mais nova. O que foi estudado no plano
 *    antigo passa para o bloco equivalente do novo; agendamentos e edital do
 *    antigo são apagados com tombstone.
 *  - Configurações deste aparelho (contas, canais, estado de sync) nunca
 *    viajam. Preferências e demais campos seguem o lado indicado em `newer`.
 */
import { reconcileRetaFinalWithEvents } from '../logic/reta-final-core.js';

const COLLECTIONS = ['editais', 'eventos', 'arquivo', 'revisoes', 'disciplinas'];
const TOMBSTONE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const TOMBSTONE_CAP = 2000;

// Chaves de config que descrevem este aparelho, não o estudo.
export const DEVICE_CONFIG_KEYS = new Set([
  'firestoreSync',
  'nuvemSync',
  'cfUrl',
  'cfToken',
  'cfTokenSaved',
  'cfSyncEnabled',
  'cfConflict',
  'cfRemoteUpdatedAt',
  'cfLastSyncAt',
  'localBackupAt',
  'lastManualSyncAt',
  'manualSyncHistory',
  'lastManualSyncResults',
  'syncPerformance',
  'globalSyncPaused',
  'syncMergeConflicts',
  'entitySync',
  '_lastUpdated',
]);
export const DEVICE_STATE_KEYS = new Set(['driveFileId', 'lastSync']);

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function itemTime(item) {
  return toTime(item?.updatedAt || item?._sync?.updatedAt || item?.criadoEm);
}

function isActivePlan(plan) {
  return plan?.ativo === true && plan.tipo === 'reta_final' && Boolean(plan.planId);
}

function importTime(plan) {
  return toTime(plan?.retaFinal?.importadoEm || plan?.updatedAt);
}

function mergeTombstones(lists, nowMs) {
  const byKey = new Map();
  for (const t of lists.flat()) {
    if (!t?.col || !t?.id) continue;
    const time = toTime(t.deletedAt);
    if (!time || time < nowMs - TOMBSTONE_MAX_AGE_MS) continue;
    const key = `${t.col}:${t.id}`;
    const existing = byKey.get(key);
    if (!existing || toTime(existing.deletedAt) < time) byKey.set(key, { col: t.col, id: t.id, deletedAt: t.deletedAt });
  }
  return [...byKey.values()]
    .sort((a, b) => toTime(b.deletedAt) - toTime(a.deletedAt))
    .slice(0, TOMBSTONE_CAP)
    .sort((a, b) => `${a.col}:${a.id}`.localeCompare(`${b.col}:${b.id}`));
}

function tombstoneIndex(tombstones, col) {
  const index = new Map();
  for (const t of tombstones) if (t.col === col) index.set(t.id, toTime(t.deletedAt));
  return index;
}

function mergeById(localList, remoteList, deadIndex) {
  const map = new Map();
  for (const item of Array.isArray(remoteList) ? remoteList : []) if (item?.id) map.set(item.id, item);
  for (const item of Array.isArray(localList) ? localList : []) {
    if (!item?.id) continue;
    const other = map.get(item.id);
    if (!other || itemTime(item) >= itemTime(other)) map.set(item.id, item);
  }
  return [...map.values()]
    .filter((item) => {
      const deletedAt = deadIndex.get(item.id);
      return !deletedAt || itemTime(item) > deletedAt;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(clone);
}

function blockKey(block) {
  return `${block?.dataOriginal || block?.data || ''}|${block?.ordem ?? ''}`;
}

/**
 * Converte o lado perdedor (plano importado antes) para o plano vencedor.
 * Devolve uma cópia do estado perdedor e as tombstones geradas.
 */
function adoptWinningPlan(loser, winner, nowIso) {
  const result = clone(loser);
  const tombstones = [];
  const winnerPlan = winner.planejamento;
  const loserPlan = loser.planejamento;
  const loserBlockIds = new Set((loserPlan.retaFinal?.blocos || []).map((b) => b.id));
  const winnerByKey = new Map((winnerPlan.retaFinal?.blocos || []).map((b) => [blockKey(b), b]));
  const loserBlockById = new Map((loserPlan.retaFinal?.blocos || []).map((b) => [b.id, b]));
  const winnerEvents = Array.isArray(winner.eventos) ? winner.eventos : [];

  const keptEvents = [];
  for (const ev of result.eventos || []) {
    if (!ev?.rfBlocoId || !loserBlockIds.has(ev.rfBlocoId)) {
      keptEvents.push(ev);
      continue;
    }
    const studied = ev.status === 'estudei' || Number(ev.tempoAcumulado) > 0;
    if (!studied) {
      tombstones.push({ col: 'eventos', id: ev.id, deletedAt: nowIso });
      continue;
    }
    const target = winnerByKey.get(blockKey(loserBlockById.get(ev.rfBlocoId)));
    if (!target) {
      // Sem bloco equivalente: a sessão fica, como sessão avulsa.
      delete ev.rfBlocoId;
      ev.isAutoGenerated = false;
      ev.updatedAt = nowIso;
      keptEvents.push(ev);
      continue;
    }
    const scheduled = winnerEvents.find((w) => w?.rfBlocoId === target.id && w.id !== ev.id);
    if (scheduled && scheduled.status === 'agendado') {
      tombstones.push({ col: 'eventos', id: scheduled.id, deletedAt: nowIso });
    }
    ev.rfBlocoId = target.id;
    ev.discId = target.discId;
    if (scheduled?.assId !== undefined) ev.assId = scheduled.assId;
    if (scheduled?.aulaId !== undefined) ev.aulaId = scheduled.aulaId;
    ev.updatedAt = nowIso;
    keptEvents.push(ev);
  }
  result.eventos = keptEvents;

  const winnerDisc = new Set(winnerPlan.disciplinas || []);
  const loserDisc = new Set(loserPlan.disciplinas || []);
  result.editais = (result.editais || []).filter((edital) => {
    const discIds = (edital?.disciplinas || []).map((d) => d?.id);
    const fromLoser = discIds.some((id) => loserDisc.has(id)) && !discIds.some((id) => winnerDisc.has(id));
    if (fromLoser) tombstones.push({ col: 'editais', id: edital.id, deletedAt: nowIso });
    return !fromLoser;
  });

  result.planejamento = clone(winnerPlan);
  result.syncTombstones = [...(result.syncTombstones || []), ...tombstones];
  return result;
}

function pickPlan(local, remote, newer) {
  const lp = local.planejamento;
  const rp = remote.planejamento;
  if (!lp && !rp) return lp ?? rp ?? null;
  if (!rp) return lp;
  if (!lp) return rp;
  const lt = toTime(lp.updatedAt);
  const rt = toTime(rp.updatedAt);
  if (lt !== rt) return lt > rt ? lp : rp;
  return newer === 'remote' ? rp : lp;
}

function mergeConfig(localConfig = {}, remoteConfig = {}, newer) {
  const preferred = newer === 'remote' ? remoteConfig : localConfig;
  const other = newer === 'remote' ? localConfig : remoteConfig;
  const merged = {};
  for (const [key, value] of Object.entries(other)) {
    if (!DEVICE_CONFIG_KEYS.has(key)) merged[key] = clone(value);
  }
  for (const [key, value] of Object.entries(preferred)) {
    if (!DEVICE_CONFIG_KEYS.has(key)) merged[key] = clone(value);
  }
  for (const [key, value] of Object.entries(localConfig)) {
    if (DEVICE_CONFIG_KEYS.has(key)) merged[key] = clone(value);
  }
  return merged;
}

/**
 * @param {object} localState estado deste aparelho
 * @param {object|null} remoteState estado da nuvem
 * @param {{ now?: string, newer?: 'local'|'remote' }} [options]
 *   newer: lado que vence nos campos sem data própria (preferências, ciclo…).
 */
export function mergeCloudStates(localState, remoteState, options = {}) {
  if (!remoteState || typeof remoteState !== 'object') return localState;
  const nowIso = options.now || new Date().toISOString();
  const newer = options.newer === 'remote' ? 'remote' : 'local';

  let local = localState || {};
  let remote = remoteState;
  if (
    isActivePlan(local.planejamento) &&
    isActivePlan(remote.planejamento) &&
    local.planejamento.planId !== remote.planejamento.planId
  ) {
    const lt = importTime(local.planejamento);
    const rt = importTime(remote.planejamento);
    const localWins = lt !== rt ? lt > rt : local.planejamento.planId > remote.planejamento.planId;
    if (localWins) remote = adoptWinningPlan(remote, local, nowIso);
    else local = adoptWinningPlan(local, remote, nowIso);
  }

  const preferred = newer === 'remote' ? remote : local;
  const other = newer === 'remote' ? local : remote;
  const merged = {};
  for (const source of [other, preferred]) {
    for (const [key, value] of Object.entries(source)) {
      if (DEVICE_STATE_KEYS.has(key)) continue;
      merged[key] = clone(value);
    }
  }
  for (const key of DEVICE_STATE_KEYS) {
    if (Object.hasOwn(local, key)) merged[key] = clone(local[key]);
  }

  merged.syncTombstones = mergeTombstones([local.syncTombstones || [], remote.syncTombstones || []], toTime(nowIso));
  for (const col of COLLECTIONS) {
    if (!Array.isArray(local[col]) && !Array.isArray(remote[col])) continue;
    merged[col] = mergeById(local[col], remote[col], tombstoneIndex(merged.syncTombstones, col));
  }
  const habitTypes = new Set([...Object.keys(local.habitos || {}), ...Object.keys(remote.habitos || {})]);
  merged.habitos = {};
  for (const type of [...habitTypes].sort()) {
    merged.habitos[type] = mergeById(
      local.habitos?.[type],
      remote.habitos?.[type],
      tombstoneIndex(merged.syncTombstones, `habitos.${type}`)
    );
  }

  merged.config = mergeConfig(local.config, remote.config, newer);
  merged.planejamento = clone(pickPlan(local, remote, newer));
  if (merged.planejamento) reconcileRetaFinalWithEvents(merged.planejamento, merged.eventos);
  return merged;
}
