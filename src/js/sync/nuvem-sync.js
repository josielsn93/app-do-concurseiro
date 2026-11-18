/**
 * Sincronização com a nuvem (Firebase), automática e sem conflitos.
 *
 * Um documento por conta (users/{uid}/estado/atual) guarda o estado de estudo
 * compactado. Toda sincronização é uma transação "ler → mesclar → gravar":
 * o que a nuvem tem e o que este aparelho tem viram um estado só
 * (cloud-merge.js), então nada se perde e nada fica bloqueado.
 *
 *  - Envio: alguns segundos depois de cada mudança local.
 *  - Recebimento: em tempo real, enquanto o app está aberto.
 *  - Sem internet: a mudança fica marcada e é enviada quando der.
 *
 * As dependências (nuvem, store, relógio) são injetadas para os testes; o app
 * monta a instância real em sync/nuvem.js.
 */
import { buildCloudPayload, decodeCloudDoc, encodeCloudDoc } from './cloud-codec.js';
import { mergeCloudStates } from './cloud-merge.js';

export const NUVEM_DOC_PATH = (uid) => `users/${uid}/estado/atual`;
export const LEGACY_SNAPSHOT_PATH = (uid) => `users/${uid}/snapshots/main`;

const OFFLINE_CODES = new Set(['unavailable', 'deadline-exceeded', 'failed-precondition', 'aborted', 'cancelled']);
const PERMISSION_CODES = new Set(['permission-denied', 'unauthenticated']);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const sameContent = (a, b) => stableStringify(buildCloudPayload(a)) === stableStringify(buildCloudPayload(b));

function describeError(error) {
  const code = error?.code || '';
  if (PERMISSION_CODES.has(code)) {
    return 'Sem permissão para acessar a nuvem. Confira se entrou com a conta certa e se as regras do Firestore foram publicadas.';
  }
  return error?.message || 'Falha ao sincronizar.';
}

/**
 * @param {object} deps
 * @param {{ getDocument: Function, runTransaction: Function, listen: Function }} deps.cloud
 * @param {{ getState: Function, applyMerged: Function, onLocalChange: Function }} deps.store
 * @param {string} deps.deviceId
 * @param {() => string} [deps.now]
 * @param {number} [deps.debounceMs]
 * @param {number[]} [deps.retryDelaysMs]
 * @param {{ load: () => boolean, save: (dirty: boolean) => void }} [deps.dirtyFlag]
 * @param {boolean} [deps.compression] gzip no documento (desligado nos testes)
 */
export function createNuvemSync({
  cloud,
  store,
  deviceId,
  now = () => new Date().toISOString(),
  debounceMs = 3000,
  retryDelaysMs = [5000, 15000, 60000],
  dirtyFlag = { load: () => false, save: () => {} },
  compression = true,
}) {
  let uid = null;
  let unsubscribeRemote = null;
  let unsubscribeLocal = null;
  let debounceTimer = null;
  let retryTimer = null;
  let retryIndex = 0;
  let running = null;
  let rerun = false;
  let dirty = Boolean(dirtyFlag.load());
  let lastWritten = null; // { updatedAt } da última gravação deste aparelho
  const listeners = new Set();
  const status = { state: 'off', uid: null, lastSyncAt: null, error: null };

  function setStatus(patch) {
    Object.assign(status, patch);
    const snapshot = { ...status };
    for (const cb of listeners) {
      try {
        cb(snapshot);
      } catch {
        /* um ouvinte com erro não derruba a sincronização */
      }
    }
  }

  function setDirty(value) {
    dirty = value;
    try {
      dirtyFlag.save(value);
    } catch {
      /* armazenamento indisponível: segue em memória */
    }
  }

  function clearTimers() {
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    debounceTimer = null;
    retryTimer = null;
  }

  async function applyIfChanged(merged) {
    // Junta de novo com o estado atual: o usuário pode ter mexido no app
    // enquanto a nuvem respondia.
    const current = store.getState();
    const next = mergeCloudStates(current, merged, { now: now(), newer: 'local' });
    if (!sameContent(next, current)) await store.applyMerged(next);
    return next;
  }

  async function readRemoteState(tx) {
    const snap = await tx.get(NUVEM_DOC_PATH(uid));
    if (snap.exists) return { state: await decodeCloudDoc(snap.data), legacy: false };
    const legacy = await cloud.getDocument(LEGACY_SNAPSHOT_PATH(uid));
    const payload = legacy.exists ? legacy.data?.payload : null;
    return { state: payload && typeof payload === 'object' ? payload : null, legacy: Boolean(payload) };
  }

  async function runSync() {
    const syncUid = uid;
    setStatus({ state: 'syncing' });
    const wasDirty = dirty;
    const merged = await cloud.runTransaction(async (tx) => {
      const remote = await readRemoteState(tx);
      const local = store.getState();
      // Sem nada na nuvem, a mesclagem com {} só normaliza o formato local.
      const result = mergeCloudStates(local, remote.state || {}, {
        now: now(),
        newer: wasDirty || !remote.state ? 'local' : 'remote',
      });
      const needsWrite = !remote.state || remote.legacy || !sameContent(result, remote.state);
      if (needsWrite) {
        const updatedAt = now();
        const doc = await encodeCloudDoc(buildCloudPayload(result), { deviceId, updatedAt, compression });
        tx.set(NUVEM_DOC_PATH(syncUid), doc);
        lastWritten = { updatedAt };
      }
      return result;
    });
    if (uid !== syncUid) return;
    if (dirty === wasDirty) setDirty(false);
    await applyIfChanged(merged);
    retryIndex = 0;
    setStatus({ state: 'synced', lastSyncAt: now(), error: null });
  }

  function scheduleRetry(error) {
    const code = error?.code || '';
    if (PERMISSION_CODES.has(code)) {
      setStatus({ state: 'error', error: describeError(error) });
      return;
    }
    const offline = OFFLINE_CODES.has(code) || (typeof navigator !== 'undefined' && navigator.onLine === false);
    setStatus({ state: offline ? 'offline' : 'error', error: offline ? null : describeError(error) });
    const delay = retryDelaysMs[Math.min(retryIndex, retryDelaysMs.length - 1)];
    retryIndex++;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      syncNow();
    }, delay);
  }

  /** Sincroniza agora. Chamadas durante uma sincronização viram uma só, logo em seguida. */
  function syncNow() {
    if (!uid) return Promise.resolve(false);
    clearTimeout(debounceTimer);
    debounceTimer = null;
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      try {
        await runSync();
        return true;
      } catch (error) {
        scheduleRetry(error);
        return false;
      } finally {
        running = null;
        if (rerun && uid) {
          rerun = false;
          syncNow();
        }
      }
    })();
    return running;
  }

  function onLocalChange() {
    if (!uid) return;
    setDirty(true);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      syncNow();
    }, debounceMs);
  }

  async function onRemoteSnapshot(snap) {
    if (!uid || !snap?.exists || snap.hasPendingWrites) return;
    const doc = snap.data;
    if (doc?.deviceId === deviceId && lastWritten && doc.updatedAt === lastWritten.updatedAt) return;
    if (running) {
      rerun = true;
      return;
    }
    try {
      const remote = await decodeCloudDoc(doc);
      const local = store.getState();
      const merged = mergeCloudStates(local, remote, { now: now(), newer: dirty ? 'local' : 'remote' });
      await applyIfChanged(merged);
      if (!sameContent(merged, remote)) onLocalChange();
      else setStatus({ state: 'synced', lastSyncAt: now(), error: null });
    } catch (error) {
      setStatus({ state: 'error', error: describeError(error) });
    }
  }

  return {
    async start(newUid) {
      if (!newUid) return;
      if (uid === newUid && unsubscribeRemote) return;
      this.stop();
      uid = newUid;
      setStatus({ state: 'syncing', uid, error: null });
      unsubscribeLocal = store.onLocalChange(onLocalChange);
      await syncNow();
      if (uid !== newUid) return;
      unsubscribeRemote = cloud.listen(NUVEM_DOC_PATH(uid), onRemoteSnapshot, (error) =>
        setStatus({ state: 'error', error: describeError(error) })
      );
    },
    stop() {
      clearTimers();
      unsubscribeRemote?.();
      unsubscribeLocal?.();
      unsubscribeRemote = null;
      unsubscribeLocal = null;
      uid = null;
      rerun = false;
      setStatus({ state: 'off', uid: null, error: null });
    },
    syncNow,
    /** Chamar quando o navegador voltar a ficar online ou a aba voltar ao foco. */
    resume() {
      if (uid && (dirty || status.state === 'offline' || status.state === 'error')) syncNow();
    },
    getStatus: () => ({ ...status, pending: dirty }),
    onStatus(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
