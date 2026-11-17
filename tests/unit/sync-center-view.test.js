import { describe, expect, it } from 'vitest';
import {
  renderCloudflareConflict,
  visibleSyncSources,
} from '../../src/js/views/config/sync-center.js?v=8.37';

const sources = [
  { id: 'local' },
  { id: 'firebase' },
  { id: 'cloudflare' },
  { id: 'drive' },
];

describe('central de sincronização: só o que a pessoa usa', () => {
  it('esconde Cloudflare e Google Drive quando nunca foram configurados', () => {
    const ids = visibleSyncSources(sources, { config: {} }).map((s) => s.id);
    expect(ids).toEqual(['local', 'firebase']);
  });

  it('mantém Cloudflare e Drive visíveis para quem já os configurou', () => {
    const ids = visibleSyncSources(sources, {
      config: { cfUrl: 'https://x.workers.dev' },
      driveFileId: 'abc',
    }).map((s) => s.id);
    expect(ids).toEqual(['local', 'firebase', 'cloudflare', 'drive']);
  });

  it('não mostra o painel "Conflito Cloudflare" num conflito do Firebase', () => {
    const conflict = { type: 'reta-final-conflict', cause: 'lineage' };
    expect(renderCloudflareConflict({ id: 'firebase', conflict })).toBe('');
    expect(renderCloudflareConflict({ id: 'cloudflare', conflict: { remoteUpdatedAt: 'x' } })).toContain(
      'Conflito Cloudflare'
    );
  });
});
