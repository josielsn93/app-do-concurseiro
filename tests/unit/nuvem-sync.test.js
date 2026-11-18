// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNuvemSync, NUVEM_DOC_PATH, LEGACY_SNAPSHOT_PATH } from '../../src/js/sync/nuvem-sync.js';
import { decodeCloudDoc } from '../../src/js/sync/cloud-codec.js';

const UID = 'u1';

/** Firestore em memória compartilhado pelos "aparelhos" do teste. */
function createFakeCloud() {
  const docs = new Map();
  const listeners = new Map();
  let failNext = null;
  const notify = (path) => {
    for (const cb of listeners.get(path) || []) {
      const data = docs.get(path);
      queueMicrotask(() => cb({ exists: Boolean(data), data: data ? structuredClone(data) : null, hasPendingWrites: false }));
    }
  };
  const cloud = {
    docs,
    writes: 0,
    failWith(error) { failNext = error; },
    async getDocument(path) {
      const data = docs.get(path);
      return { exists: Boolean(data), data: data ? structuredClone(data) : null };
    },
    async runTransaction(fn) {
      if (failNext) { const e = failNext; failNext = null; throw e; }
      const pending = new Map();
      const tx = {
        get: async (path) => {
          const data = docs.get(path);
          return { exists: Boolean(data), data: data ? structuredClone(data) : null };
        },
        set: (path, data) => pending.set(path, structuredClone(data)),
      };
      const result = await fn(tx);
      for (const [path, data] of pending) { docs.set(path, data); cloud.writes++; notify(path); }
      return result;
    },
    listen(path, onNext) {
      if (!listeners.has(path)) listeners.set(path, new Set());
      listeners.get(path).add(onNext);
      notify(path);
      return () => listeners.get(path).delete(onNext);
    },
  };
  return cloud;
}

function evento(id, extra = {}) {
  return { id, titulo: id, data: '2026-11-18', duracao: 60, status: 'agendado', tempoAcumulado: 0, criadoEm: '2026-11-01T00:00:00.000Z', ...extra };
}

function plano(planId, importadoEm, blocos) {
  return {
    ativo: true, tipo: 'reta_final', schemaVersionRetaFinal: 2, planId, revision: 0, updatedAt: importadoEm,
    disciplinas: [...new Set(blocos.map((b) => b.discId))],
    retaFinal: { nome: 'P', dataFinal: '2027-03-14', minutosPadrao: 60, importadoEm, blocos },
  };
}

function bloco(id, ordem, discId) {
  return { id, data: '2026-11-18', dataOriginal: '2026-11-18', dataPlanejada: '2026-11-18', ordem, discId, topicos: [], minutos: 60, status: 'pendente', rolagens: 0, notas: '' };
}

function createDevice(cloud, deviceId, initialState) {
  let state = structuredClone(initialState);
  let changeHandler = null;
  const applied = [];
  const statuses = [];
  const store = {
    getState: () => state,
    applyMerged: async (next) => { state = next; applied.push(next); },
    onLocalChange: (cb) => { changeHandler = cb; return () => { changeHandler = null; }; },
  };
  const engine = createNuvemSync({
    cloud,
    store,
    deviceId,
    now: () => new Date().toISOString(),
    debounceMs: 3000,
    retryDelaysMs: [5000, 15000],
    dirtyFlag: { load: () => false, save: () => {} },
    // A compressão usa zlib em outra thread (tempo real); o formato é testado em cloud-codec.
    compression: false,
  });
  engine.onStatus((s) => statuses.push(s.state));
  return {
    engine,
    statuses,
    applied,
    get state() { return state; },
    change(mutator) {
      mutator(state);
      changeHandler?.();
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 50; j++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  }
};

async function readCloud(cloud) {
  return decodeCloudDoc(cloud.docs.get(NUVEM_DOC_PATH(UID)));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('nuvem: primeira sincronização', () => {
  it('envia o estado deste aparelho quando a nuvem está vazia', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [evento('e1')], config: { firestoreSync: { x: 1 } } });

    await a.engine.start(UID);
    await flush();

    const remote = await readCloud(cloud);
    expect(remote.eventos.map((e) => e.id)).toEqual(['e1']);
    expect(remote.config).toEqual({});
    expect(a.engine.getStatus()).toMatchObject({ state: 'synced', uid: UID, error: null });
  });

  it('migra o documento antigo (snapshots/main) na primeira vez', async () => {
    const cloud = createFakeCloud();
    cloud.docs.set(LEGACY_SNAPSHOT_PATH(UID), { version: 1, payload: { eventos: [evento('antigo')], config: {} } });
    const a = createDevice(cloud, 'A', { eventos: [evento('novo')], config: {} });

    await a.engine.start(UID);
    await flush();

    expect((await readCloud(cloud)).eventos.map((e) => e.id)).toEqual(['antigo', 'novo']);
    expect(a.state.eventos.map((e) => e.id)).toEqual(['antigo', 'novo']);
  });

  it('um aparelho novo recebe tudo da nuvem ao entrar', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [evento('e1')], planejamento: plano('p1', '2026-11-16T00:00:00Z', [bloco('b1', 1, 'd1')]), config: {} });
    await a.engine.start(UID);
    await flush();

    const b = createDevice(cloud, 'B', { eventos: [], config: { visualizacao: 'mes' } });
    await b.engine.start(UID);
    await flush();

    expect(b.state.planejamento.planId).toBe('p1');
    expect(b.state.eventos.map((e) => e.id)).toEqual(['e1']);
  });

  it('não regrava a nuvem quando nada mudou', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [evento('e1')], config: {} });
    await a.engine.start(UID);
    await flush();
    const writes = cloud.writes;

    await a.engine.syncNow();
    await flush();

    expect(cloud.writes).toBe(writes);
  });
});

describe('nuvem: no dia a dia', () => {
  it('uma mudança chega ao outro aparelho sozinha, alguns segundos depois', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [evento('e1')], config: {} });
    const b = createDevice(cloud, 'B', { eventos: [], config: {} });
    await a.engine.start(UID);
    await flush();
    await b.engine.start(UID);
    await flush();

    a.change((s) => s.eventos.push(evento('e2', { updatedAt: '2026-11-18T15:00:01.000Z' })));
    await vi.advanceTimersByTimeAsync(2000);
    expect((await readCloud(cloud)).eventos).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1500);
    await flush();

    expect((await readCloud(cloud)).eventos.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(b.state.eventos.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('ignora o eco da própria gravação', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [evento('e1')], config: {} });
    await a.engine.start(UID);
    await flush();
    const before = a.applied.length;

    a.change((s) => s.eventos.push(evento('e2')));
    await vi.advanceTimersByTimeAsync(3500);
    await flush();

    expect(a.applied.length).toBe(before);
  });

  it('mudanças feitas nos dois aparelhos ao mesmo tempo ficam todas', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [], config: {} });
    const b = createDevice(cloud, 'B', { eventos: [], config: {} });
    await a.engine.start(UID);
    await b.engine.start(UID);
    await flush();

    a.change((s) => s.eventos.push(evento('de-A')));
    b.change((s) => s.eventos.push(evento('de-B')));
    await vi.advanceTimersByTimeAsync(3500);
    await flush();
    await vi.advanceTimersByTimeAsync(3500);
    await flush();

    expect((await readCloud(cloud)).eventos.map((e) => e.id)).toEqual(['de-A', 'de-B']);
    expect(a.state.eventos.map((e) => e.id)).toEqual(['de-A', 'de-B']);
    expect(b.state.eventos.map((e) => e.id)).toEqual(['de-A', 'de-B']);
  });

  it('o mesmo plano importado nos dois aparelhos termina igual nos dois, sem conflito', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', {
      planejamento: plano('pA', '2026-11-16T00:00:00Z', [bloco('a1', 1, 'dA')]),
      eventos: [evento('estudo', { rfBlocoId: 'a1', status: 'estudei', tempoAcumulado: 3600 })],
      config: {},
    });
    await a.engine.start(UID);
    await flush();
    const b = createDevice(cloud, 'B', {
      planejamento: plano('pB', '2026-11-17T00:00:00Z', [bloco('b1', 1, 'dB')]),
      eventos: [evento('agenda-b1', { rfBlocoId: 'b1' })],
      config: {},
    });
    await b.engine.start(UID);
    await flush();

    expect(b.state.planejamento.planId).toBe('pB');
    expect(a.state.planejamento.planId).toBe('pB');
    expect(a.state.eventos.map((e) => e.id)).toEqual(['estudo']);
    expect(a.state.eventos[0].rfBlocoId).toBe('b1');
    expect(a.engine.getStatus().state).toBe('synced');
  });
});

describe('nuvem: falhas', () => {
  it('sem permissão, avisa e não fica tentando', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [evento('e1')], config: {} });
    cloud.failWith(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));

    await a.engine.start(UID);
    await flush();
    await vi.advanceTimersByTimeAsync(60000);

    expect(a.engine.getStatus()).toMatchObject({ state: 'error' });
    expect(a.engine.getStatus().error).toMatch(/permiss/i);
    expect(cloud.writes).toBe(0);
  });

  it('sem internet, guarda a mudança e envia quando a conexão volta', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [], config: {} });
    await a.engine.start(UID);
    await flush();

    cloud.failWith(Object.assign(new Error('offline'), { code: 'unavailable' }));
    a.change((s) => s.eventos.push(evento('offline')));
    await vi.advanceTimersByTimeAsync(3500);
    await flush();
    expect(a.engine.getStatus().state).toBe('offline');

    await vi.advanceTimersByTimeAsync(5000);
    await flush();

    expect((await readCloud(cloud)).eventos.map((e) => e.id)).toEqual(['offline']);
    expect(a.engine.getStatus().state).toBe('synced');
  });

  it('para de ouvir a nuvem ao sair da conta', async () => {
    const cloud = createFakeCloud();
    const a = createDevice(cloud, 'A', { eventos: [], config: {} });
    await a.engine.start(UID);
    await flush();
    a.engine.stop();

    a.change((s) => s.eventos.push(evento('depois')));
    await vi.advanceTimersByTimeAsync(10000);

    expect(a.engine.getStatus().state).toBe('off');
    expect((await readCloud(cloud)).eventos).toEqual([]);
  });
});
