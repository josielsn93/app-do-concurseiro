/**
 * Armazém das aulas longas (texto das notas), fora do estado sincronizado.
 *
 * Leitura: local (IndexedDB próprio) -> nuvem (Firestore, se logado) -> null.
 * Escrita: local sempre; nuvem quando possível, sem perder o local se falhar.
 */

const DB_NAME = 'EstudoAulasDB';
const STORE = 'aulas';

/** @param {{local: object, cloud: object|null}} backends */
export function createAulasStore({ local, cloud = null }) {
  return {
    async get(id) {
      if (!id) return null;
      const found = await local.get(id);
      if (found !== null && found !== undefined) return found;
      if (!cloud) return null;
      try {
        const remote = await cloud.get(id);
        if (typeof remote === 'string' && remote.length > 0) {
          await local.putMany(new Map([[id, remote]]));
          return remote;
        }
      } catch (err) {
        console.warn('Aula indisponível na nuvem:', err?.message || err);
      }
      return null;
    },

    async putMany(aulas) {
      const localCount = await local.putMany(aulas);
      if (!cloud || aulas.size === 0) return { local: localCount, cloud: 0, cloudError: null };
      try {
        const missing = new Map();
        for (const [id, text] of aulas) {
          if (!(await cloud.has(id))) missing.set(id, text);
        }
        const sent = missing.size > 0 ? await cloud.putMany(missing) : 0;
        return { local: localCount, cloud: sent, cloudError: null };
      } catch (err) {
        return { local: localCount, cloud: 0, cloudError: String(err?.message || err) };
      }
    },
  };
}

// ---------- backend local (IndexedDB) ----------

function openAulasDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbBackend() {
  const memory = new Map();
  let dbPromise = null;
  const db = () => {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    dbPromise = dbPromise || openAulasDb().catch(() => null);
    return dbPromise;
  };
  return {
    async get(id) {
      if (memory.has(id)) return memory.get(id);
      const conn = await db();
      if (!conn) return null;
      return new Promise((resolve) => {
        const req = conn.transaction(STORE).objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result?.text ?? null);
        req.onerror = () => resolve(null);
      });
    },
    async has(id) {
      return (await this.get(id)) !== null;
    },
    async putMany(map) {
      for (const [id, text] of map) memory.set(id, text);
      const conn = await db();
      if (!conn) return map.size;
      return new Promise((resolve) => {
        const tx = conn.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        for (const [id, text] of map) store.put({ id, text, updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve(map.size);
        tx.onerror = () => resolve(map.size);
        tx.onabort = () => resolve(map.size);
      });
    },
  };
}

// ---------- backend de nuvem (Firestore: users/{uid}/aulas/{id}) ----------

export function createFirestoreBackend() {
  async function ctx() {
    const { initFirebaseServices } = await import('../firebase/firebase-client.js?v=8.37');
    const { configured, auth, db } = initFirebaseServices();
    const uid = auth?.currentUser?.uid;
    if (!configured || !db || !uid) throw new Error('Sem login: aulas ficam só neste aparelho.');
    const fb = await import('../../vendor/firebase-client.bundle.js?v=8.37');
    return { db, uid, fb };
  }
  return {
    async get(id) {
      const { db, uid, fb } = await ctx();
      const snap = await fb.getDoc(fb.doc(db, 'users', uid, 'aulas', id));
      return snap.exists() ? snap.data()?.text ?? null : null;
    },
    async has(id) {
      return (await this.get(id)) !== null;
    },
    async putMany(map) {
      const { db, uid, fb } = await ctx();
      let sent = 0;
      for (const [id, text] of map) {
        await fb.setDoc(fb.doc(db, 'users', uid, 'aulas', id), {
          version: 1,
          text,
          updatedAt: new Date().toISOString(),
        });
        sent += 1;
      }
      return sent;
    },
  };
}

export const aulasStore = createAulasStore({
  local: createIndexedDbBackend(),
  cloud: createFirestoreBackend(),
});
