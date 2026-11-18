/**
 * Liga o motor de sincronização (nuvem-sync.js) ao app: conta Google,
 * Firestore, store local e eventos da página.
 *
 * Entrar com o Google = sincronizar. Não há canais, modos ou botões de
 * conflito: o motor junta os aparelhos sozinho.
 */
import { createNuvemSync, NUVEM_DOC_PATH } from './nuvem-sync.js?v=8.37';
import {
  completeGoogleRedirectSignIn,
  getFirebaseConfigStatus,
  initFirebaseServices,
  observeFirebaseAuth,
  signInWithGoogle,
  signOutFirebase,
} from '../firebase/firebase-client.js?v=8.37';
import { doc, getDoc, onSnapshot, runTransaction } from '../../vendor/firebase-client.bundle.js?v=8.37';
import { saveStateToDB, setState, state } from '../store.js?v=8.37';

const DEVICE_KEY = 'nuvem_device_id';
const DIRTY_KEY = 'nuvem_pendente';
const LOCAL_CHANGE_EVENT = 'nuvem:localChange';

let engine = null;
let currentUser = null;
let started = false;
const userListeners = new Set();

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getDeviceId() {
  const ls = storage();
  let id = ls?.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    ls?.setItem(DEVICE_KEY, id);
  }
  return id;
}

function createFirestoreCloud() {
  const db = () => {
    const services = initFirebaseServices();
    if (!services.db) throw Object.assign(new Error('Firebase não configurado.'), { code: 'unavailable' });
    return services.db;
  };
  const ref = (path) => doc(db(), path);
  const toSnap = (snap) => ({
    exists: snap.exists(),
    data: snap.exists() ? snap.data() : null,
    hasPendingWrites: Boolean(snap.metadata?.hasPendingWrites),
  });
  return {
    async getDocument(path) {
      return toSnap(await getDoc(ref(path)));
    },
    runTransaction(fn) {
      return runTransaction(db(), (tx) =>
        fn({
          get: async (path) => toSnap(await tx.get(ref(path))),
          set: (path, data) => tx.set(ref(path), data),
        })
      );
    },
    listen(path, onNext, onError) {
      return onSnapshot(ref(path), (snap) => onNext(toSnap(snap)), onError);
    },
  };
}

const storeAdapter = {
  getState: () => state,
  async applyMerged(next) {
    setState(next);
    document.dispatchEvent(new Event('app:invalidateCaches'));
    await saveStateToDB({ skipFirestoreSync: true, skipCloudSync: true, skipDriveSync: true });
    document.dispatchEvent(new Event('app:renderCurrentView'));
  },
  onLocalChange(cb) {
    const onSaved = (event) => {
      if (event?.detail?.skipFirestoreSync) return;
      cb();
    };
    document.addEventListener('stateSaved', onSaved);
    document.addEventListener(LOCAL_CHANGE_EVENT, cb);
    return () => {
      document.removeEventListener('stateSaved', onSaved);
      document.removeEventListener(LOCAL_CHANGE_EVENT, cb);
    };
  },
};

function getEngine() {
  if (!engine) {
    engine = createNuvemSync({
      cloud: createFirestoreCloud(),
      store: storeAdapter,
      deviceId: getDeviceId(),
      dirtyFlag: {
        load: () => storage()?.getItem(DIRTY_KEY) === '1',
        save: (dirty) => (dirty ? storage()?.setItem(DIRTY_KEY, '1') : storage()?.removeItem(DIRTY_KEY)),
      },
    });
    engine.onStatus((status) => {
      document.dispatchEvent(new CustomEvent('app:nuvemStatus', { detail: status }));
    });
  }
  return engine;
}

/** Avisa que o estado mudou por um caminho que não passa por saveStateToDB. */
export function notifyLocalChange() {
  document.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

export function getNuvemStatus() {
  const configured = getFirebaseConfigStatus().configured;
  const status = engine ? engine.getStatus() : { state: 'off', uid: null, lastSyncAt: null, error: null, pending: false };
  return { ...status, configured, email: currentUser?.email || null };
}

export function onNuvemUser(cb) {
  userListeners.add(cb);
  return () => userListeners.delete(cb);
}

export function initNuvem() {
  if (started) return;
  started = true;
  if (!getFirebaseConfigStatus().configured) return;
  const sync = getEngine();
  completeGoogleRedirectSignIn().catch(() => {});
  observeFirebaseAuth((user) => {
    currentUser = user || null;
    if (user?.uid) sync.start(user.uid);
    else sync.stop();
    for (const cb of userListeners) cb(currentUser);
    document.dispatchEvent(new CustomEvent('app:nuvemStatus', { detail: getNuvemStatus() }));
  });
  window.addEventListener('online', () => sync.resume());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync.resume();
  });
}

export async function nuvemSignIn() {
  const result = await signInWithGoogle();
  return result?.user || null;
}

export async function nuvemSignOut() {
  getEngine().stop();
  await signOutFirebase();
}

export function nuvemSyncNow() {
  return getEngine().syncNow();
}

/** Arquivo de diagnóstico para suporte: estado da sincronização, sem dados de estudo. */
export function buildNuvemDiagnostic() {
  const status = getNuvemStatus();
  return {
    geradoEm: new Date().toISOString(),
    userAgent: navigator.userAgent,
    aparelho: getDeviceId(),
    projeto: getFirebaseConfigStatus().projectId,
    documento: status.uid ? NUVEM_DOC_PATH(status.uid) : null,
    status: { ...status, email: undefined },
    local: {
      eventos: state.eventos?.length || 0,
      editais: state.editais?.length || 0,
      blocosDoPlano: state.planejamento?.retaFinal?.blocos?.length || 0,
      planoId: state.planejamento?.planId || null,
      tombstones: state.syncTombstones?.length || 0,
      tamanhoAproximadoKB: Math.round(JSON.stringify(state).length / 1024),
    },
  };
}

export function downloadNuvemDiagnostic() {
  const blob = new Blob([JSON.stringify(buildNuvemDiagnostic(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diagnostico-sync-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
