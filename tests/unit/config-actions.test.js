import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/config.js', () => {
  let registerAction;
  let configView;
  let storeModule;
  let appModule;
  let componentsModule;
  let nuvem;
  let statusUi;
  let notificationsModule;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    configView = {
      updateConfig: vi.fn(),
      toggleConfig: vi.fn(),
      updateFrequencia: vi.fn(),
      archiveOldEvents: vi.fn(),
      clearAllData: vi.fn(),
      setTheme: vi.fn(),
      exportData: vi.fn(),
      importData: vi.fn(),
    };
    storeModule = { scheduleSave: vi.fn(), state: { config: {} } };
    appModule = { showToast: vi.fn(), openModal: vi.fn(), showConfirm: vi.fn() };
    componentsModule = { renderCurrentView: vi.fn() };
    nuvem = {
      nuvemSignIn: vi.fn(() => Promise.resolve({ uid: 'u1' })),
      nuvemSignOut: vi.fn(() => Promise.resolve()),
      nuvemSyncNow: vi.fn(() => Promise.resolve(true)),
      downloadNuvemDiagnostic: vi.fn(),
    };
    statusUi = { setSyncPopoverOpen: vi.fn(), toggleSyncPopover: vi.fn() };
    notificationsModule = { adoptNotificationPermission: vi.fn() };
    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/config-view.js?v=8.37', () => configView);
    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/sync/nuvem.js?v=8.37', () => nuvem);
    vi.doMock('../../src/js/sync/nuvem-status-ui.js?v=8.37', () => statusUi);
    vi.doMock('../../src/js/notifications.js?v=8.37', () => notificationsModule);

    await import('../../src/js/ui/actions/config.js');
  });

  it('request-notification-permission sincroniza o engine após conceder', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted'));
    window.Notification = { permission: 'default', requestPermission };
    const handler = registerAction.mock.calls.find(
      (c) => c[0] === 'request-notification-permission'
    )[1];

    handler();
    await vi.waitFor(() => expect(componentsModule.renderCurrentView).toHaveBeenCalled());

    expect(requestPermission).toHaveBeenCalled();
    expect(notificationsModule.adoptNotificationPermission).toHaveBeenCalled();
    delete window.Notification;
  });

  it('registers config actions', () => {
    const calls = registerAction.mock.calls.map((c) => c[0]);
    for (const name of [
      'update-config', 'toggle-config', 'update-frequencia', 'toggle-password-visibility',
      'archive-old-events', 'clear-all-data', 'set-theme', 'export-data', 'import-data',
      'restore-backup', 'request-notification-permission', 'test-notification',
      'nuvem-sign-in', 'nuvem-sign-out', 'nuvem-sync-now', 'nuvem-download-log',
      'toggle-sync-popover', 'force-sw-cache-clear',
    ]) {
      expect(calls).toContain(name);
    }
    for (const gone of ['toggle-cf-sync', 'open-drive-modal', 'firestore-force-push', 'cloud-conflict-pull-remote', 'drive-sync-now']) {
      expect(calls).not.toContain(gone);
    }
  });

  it('update-config handler parses number values', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: { configKey: 'revisoesIntervalo', valueType: 'number' }, value: '7' });
    expect(configView.updateConfig).toHaveBeenCalledWith('revisoesIntervalo', 7);
  });

  it('update-config ignora campo numérico limpo/inválido (NaN não vai para o estado)', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: { configKey: 'silentModeStart', valueType: 'number' }, value: '' });
    handler({ dataset: { configKey: 'silentModeStart', valueType: 'number' }, value: 'abc' });
    expect(configView.updateConfig).not.toHaveBeenCalled();
  });

  it('update-config aceita 0 como valor numérico válido', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: { configKey: 'silentModeStart', valueType: 'number' }, value: '0' });
    expect(configView.updateConfig).toHaveBeenCalledWith('silentModeStart', 0);
  });

  it('update-config handler trims URL values', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({
      dataset: { configKey: 'apiUrl', valueTransform: 'trim-url' },
      value: 'https://api.test/',
    });
    expect(configView.updateConfig).toHaveBeenCalledWith('apiUrl', 'https://api.test');
  });

  it('update-config handler trims plain text values', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: { configKey: 'nome', valueTransform: 'trim' }, value: '  test  ' });
    expect(configView.updateConfig).toHaveBeenCalledWith('nome', 'test');
  });

  it('update-config handler skips when no key', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: {}, value: 'test' });
    expect(configView.updateConfig).not.toHaveBeenCalled();
  });

  it('toggle-config handler updates aria-pressed', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'toggle-config')[1];
    const el = {
      dataset: { configKey: 'darkMode' },
      classList: { contains: () => true },
      setAttribute: vi.fn(),
    };
    handler(el);
    expect(configView.toggleConfig).toHaveBeenCalledWith('darkMode', el);
    expect(el.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
  });

  it('update-frequencia handler passes value', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-frequencia')[1];
    handler({ value: '15' });
    expect(configView.updateFrequencia).toHaveBeenCalledWith('15');
  });

  it('toggle-password-visibility toggles input type', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'toggle-password-visibility')[1];
    const input = { type: 'password' };
    vi.spyOn(document, 'getElementById').mockReturnValue(input);
    handler({ dataset: { targetId: 'pwd-input' } });
    expect(input.type).toBe('text');
  });

  it('archive-old-events handler parses days', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'archive-old-events')[1];
    handler({ dataset: { days: '30' } });
    expect(configView.archiveOldEvents).toHaveBeenCalledWith(30);
  });

  it('archive-old-events handler uses default 90 days', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'archive-old-events')[1];
    handler({ dataset: {} });
    expect(configView.archiveOldEvents).toHaveBeenCalledWith(90);
  });

  it('set-theme handler passes value', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'set-theme')[1];
    handler({ value: 'dark' });
    expect(configView.setTheme).toHaveBeenCalledWith('dark');
  });


  const handler = (name) => registerAction.mock.calls.find((c) => c[0] === name)[1];

  it('nuvem-sign-in entra com o Google e avisa', async () => {
    await handler('nuvem-sign-in')();
    expect(nuvem.nuvemSignIn).toHaveBeenCalled();
    expect(appModule.showToast).toHaveBeenCalledWith(expect.stringContaining('Conectado'), 'success');
  });

  it('nuvem-sync-now sincroniza e fecha o menu', async () => {
    await handler('nuvem-sync-now')();
    expect(statusUi.setSyncPopoverOpen).toHaveBeenCalledWith(false);
    expect(nuvem.nuvemSyncNow).toHaveBeenCalled();
    expect(appModule.showToast).toHaveBeenCalledWith('Sincronizado.', 'success');
  });

  it('nuvem-sign-out sai e mantém os dados no aparelho', async () => {
    await handler('nuvem-sign-out')();
    expect(nuvem.nuvemSignOut).toHaveBeenCalled();
    expect(appModule.showToast).toHaveBeenCalledWith(expect.stringContaining('continuam neste aparelho'), 'info');
  });
});
