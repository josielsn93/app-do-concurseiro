import { describe, expect, it, vi } from 'vitest';
import { createAulasStore } from '../../src/js/store/aulas-store.js';

function memoryBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: vi.fn(async (id) => data.get(id) ?? null),
    putMany: vi.fn(async (map) => {
      for (const [id, text] of map) data.set(id, text);
      return map.size;
    }),
    has: vi.fn(async (id) => data.has(id)),
  };
}

describe('createAulasStore', () => {
  it('lê do armazém local sem consultar a nuvem', async () => {
    const local = memoryBackend({ a_1_1: 'texto local' });
    const cloud = memoryBackend({ a_1_1: 'texto nuvem' });
    const store = createAulasStore({ local, cloud });
    expect(await store.get('a_1_1')).toBe('texto local');
    expect(cloud.get).not.toHaveBeenCalled();
  });

  it('busca na nuvem quando falta localmente e guarda em cache', async () => {
    const local = memoryBackend();
    const cloud = memoryBackend({ a_2_2: 'da nuvem' });
    const store = createAulasStore({ local, cloud });
    expect(await store.get('a_2_2')).toBe('da nuvem');
    expect(local.data.get('a_2_2')).toBe('da nuvem');
    await store.get('a_2_2');
    expect(cloud.get).toHaveBeenCalledTimes(1);
  });

  it('retorna null quando não existe em lugar nenhum', async () => {
    const store = createAulasStore({ local: memoryBackend(), cloud: memoryBackend() });
    expect(await store.get('a_9_9')).toBeNull();
  });

  it('funciona sem nuvem (usuário não logado)', async () => {
    const store = createAulasStore({ local: memoryBackend(), cloud: null });
    expect(await store.get('a_9_9')).toBeNull();
  });

  it('tolera falha da nuvem na leitura', async () => {
    const cloud = { get: vi.fn(async () => { throw new Error('offline'); }), putMany: vi.fn(), has: vi.fn() };
    const store = createAulasStore({ local: memoryBackend(), cloud });
    expect(await store.get('a_9_9')).toBeNull();
  });

  it('putMany grava local e envia à nuvem, informando o resultado', async () => {
    const local = memoryBackend();
    const cloud = memoryBackend();
    const store = createAulasStore({ local, cloud });
    const res = await store.putMany(new Map([['a_1_1', 'um'], ['a_2_2', 'dois']]));
    expect(res).toEqual({ local: 2, cloud: 2, cloudError: null });
    expect(cloud.data.get('a_2_2')).toBe('dois');
  });

  it('putMany mantém o local mesmo se a nuvem falhar', async () => {
    const local = memoryBackend();
    const cloud = { get: vi.fn(), has: vi.fn(), putMany: vi.fn(async () => { throw new Error('sem permissão'); }) };
    const store = createAulasStore({ local, cloud });
    const res = await store.putMany(new Map([['a_1_1', 'um']]));
    expect(res.local).toBe(1);
    expect(res.cloud).toBe(0);
    expect(res.cloudError).toContain('sem permissão');
    expect(local.data.get('a_1_1')).toBe('um');
  });

  it('putMany não reenvia à nuvem o que ela já tem', async () => {
    const cloud = memoryBackend({ a_1_1: 'um' });
    const store = createAulasStore({ local: memoryBackend(), cloud });
    await store.putMany(new Map([['a_1_1', 'um'], ['a_2_2', 'dois']]));
    expect(cloud.putMany).toHaveBeenCalledTimes(1);
    expect([...cloud.putMany.mock.calls[0][0].keys()]).toEqual(['a_2_2']);
  });
});
