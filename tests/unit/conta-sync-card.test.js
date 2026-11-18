import { describe, expect, it } from 'vitest';
import { renderContaSyncCard, renderBackupCard } from '../../src/js/views/config/conta-sync.js?v=8.37';

const off = { configured: true, state: 'off', uid: null, email: null, lastSyncAt: null, error: null, pending: false };

describe('Configurações: conta e sincronização', () => {
  it('sem login, explica e oferece só "Entrar com Google"', () => {
    const html = renderContaSyncCard(off);
    expect(html).toContain('data-action="nuvem-sign-in"');
    expect(html).not.toMatch(/Cloudflare|Drive|Shadow|primário|Mesclar|Enviar local/);
  });

  it('logado, mostra conta e status, com "Sincronizar agora" e "Sair"', () => {
    const html = renderContaSyncCard({ ...off, state: 'synced', uid: 'u', email: 'eu@exemplo.com', lastSyncAt: '2026-11-18T14:00:00Z' });
    expect(html).toContain('eu@exemplo.com');
    expect(html).toContain('data-action="nuvem-sync-now"');
    expect(html).toContain('data-action="nuvem-sign-out"');
    expect(html).toContain('Sincronizado');
    expect(html).not.toMatch(/Conflito|Forçar|Mesclar/);
  });

  it('backup é só exportar e importar um arquivo', () => {
    const html = renderBackupCard({ localBackupAt: null });
    expect(html).toContain('data-action="export-data"');
    expect(html).toContain('data-action="import-data"');
    expect(html).not.toMatch(/Firestore|Cloudflare|Google Drive|backup-restore-source/);
  });
});
