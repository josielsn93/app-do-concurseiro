import { describe, expect, it } from 'vitest';
import { describeNuvemPill, renderNuvemPopover } from '../../src/js/sync/nuvem-status-ui.js?v=8.37';

const base = { configured: true, state: 'off', uid: null, email: null, lastSyncAt: null, error: null, pending: false };

describe('indicador de sincronização no topo', () => {
  it.each([
    [{ ...base }, 'idle', 'Só neste aparelho'],
    [{ ...base, state: 'syncing', uid: 'u' }, 'syncing', 'Sincronizando…'],
    [{ ...base, state: 'synced', uid: 'u' }, 'ok', 'Sincronizado'],
    [{ ...base, state: 'synced', uid: 'u', pending: true }, 'pending', 'Enviando…'],
    [{ ...base, state: 'offline', uid: 'u', pending: true }, 'offline', 'Sem internet'],
    [{ ...base, state: 'error', uid: 'u', error: 'x' }, 'error', 'Erro na sincronização'],
  ])('mostra um rótulo claro para cada situação (%#)', (status, kind, label) => {
    expect(describeNuvemPill(status, 'saved')).toMatchObject({ kind, label });
  });

  it('um erro ao salvar no aparelho tem prioridade', () => {
    expect(describeNuvemPill({ ...base, state: 'synced', uid: 'u' }, 'error')).toMatchObject({ kind: 'save-error' });
  });

  it('sem login, o menu oferece entrar com o Google', () => {
    const html = renderNuvemPopover({ ...base });
    expect(html).toContain('data-action="nuvem-sign-in"');
    expect(html).not.toContain('data-action="nuvem-sync-now"');
  });

  it('logado, mostra a conta, a última sincronização e "Sincronizar agora"', () => {
    const html = renderNuvemPopover({
      ...base,
      state: 'synced',
      uid: 'u',
      email: 'pessoa@exemplo.com',
      lastSyncAt: '2026-11-18T14:58:00.000Z',
    });
    expect(html).toContain('pessoa@exemplo.com');
    expect(html).toContain('data-action="nuvem-sync-now"');
    expect(html).toMatch(/\d{2}:\d{2}/);
    expect(html).not.toContain('Conflito');
  });

  it('escapa a mensagem de erro', () => {
    const html = renderNuvemPopover({ ...base, state: 'error', uid: 'u', error: '<img src=x>' });
    expect(html).not.toContain('<img src=x>');
  });
});
