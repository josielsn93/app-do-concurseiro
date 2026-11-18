/**
 * Registro de exclusões para a sincronização: um item apagado neste aparelho
 * não volta quando a nuvem ou outro aparelho ainda o têm (ver cloud-merge.js).
 */
export function recordSyncTombstone(state, col, id) {
  if (!state || !col || !id) return;
  if (!Array.isArray(state.syncTombstones)) state.syncTombstones = [];
  const deletedAt = new Date().toISOString();
  const existing = state.syncTombstones.find((t) => t?.col === col && t?.id === id);
  if (existing) {
    existing.deletedAt = deletedAt;
    return;
  }
  state.syncTombstones.push({ col, id, deletedAt });
}
