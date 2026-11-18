// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CLOUD_DOC_MAX_CHARS,
  buildCloudPayload,
  decodeCloudDoc,
  encodeCloudDoc,
} from '../../src/js/sync/cloud-codec.js';

const sample = {
  schemaVersion: 12,
  driveFileId: 'drive-123',
  lastSync: 'x',
  eventos: Array.from({ length: 400 }, (_, i) => ({
    id: `ev${i}`,
    titulo: 'Língua Portuguesa — Interpretação de textos',
    notas: '📖 Aula completa: Interpretação\n\n::aula:a_1f2e_4000::',
  })),
  config: {
    visualizacao: 'mes',
    firestoreSync: { enabled: true, uid: 'u1' },
    cfToken: 'segredo',
    localBackupAt: 'x',
  },
};

describe('pacote enviado para a nuvem', () => {
  it('leva o estudo e deixa de fora o que é deste aparelho', () => {
    const payload = buildCloudPayload(sample);

    expect(payload.eventos).toHaveLength(400);
    expect(payload.config).toEqual({ visualizacao: 'mes' });
    expect(payload).not.toHaveProperty('driveFileId');
    expect(payload).not.toHaveProperty('lastSync');
    expect(sample.config.cfToken).toBe('segredo');
  });

  it('compacta e devolve exatamente o mesmo estado', async () => {
    const payload = buildCloudPayload(sample);
    const doc = await encodeCloudDoc(payload, { deviceId: 'dev-a', updatedAt: '2026-11-18T15:00:00.000Z' });

    expect(doc).toMatchObject({ v: 1, format: 'gzip-base64', deviceId: 'dev-a', updatedAt: '2026-11-18T15:00:00.000Z' });
    expect(doc.data.length).toBeLessThan(JSON.stringify(payload).length / 5);
    expect(await decodeCloudDoc(doc)).toEqual(payload);
  });

  it('funciona sem compressão quando o navegador não oferece', async () => {
    const payload = buildCloudPayload(sample);
    const doc = await encodeCloudDoc(payload, { deviceId: 'd', updatedAt: 'x', compression: false });

    expect(doc.format).toBe('json');
    expect(await decodeCloudDoc(doc)).toEqual(payload);
  });

  it('recusa um estado grande demais para um documento, com mensagem clara', async () => {
    const huge = { blob: 'x'.repeat(CLOUD_DOC_MAX_CHARS + 10) };
    await expect(encodeCloudDoc(huge, { deviceId: 'd', updatedAt: 'x', compression: false })).rejects.toThrow(/grande demais/);
  });
});
