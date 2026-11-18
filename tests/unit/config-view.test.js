import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views/config-view.js', () => {
  let appModule;
  let storeModule;
  let logicModule;
  let componentsModule;
  let nuvem;
  let configView;

  beforeEach(async () => {
    vi.resetModules();
    appModule = {
      THEME_OPTIONS: [
        { value: 'dark', label: 'Grafite' },
        { value: 'light', label: 'Claro' },
        { value: 'auto', label: 'Automático' },
      ],
      applyTheme: vi.fn(),
      normalizeTheme: vi.fn((t) => t || 'dark'),
      showConfirm: vi.fn((msg, cb) => cb()),
      showToast: vi.fn(),
      openModal: vi.fn(),
      getLastSaveStatus: vi.fn(() => null),
      currentView: 'config',
    };
    storeModule = {
      scheduleSave: vi.fn(),
      state: {
        config: {
          darkMode: true,
          tema: 'dark',
          revisoesIntervalo: 7,
          metas: { horasSemana: 20 },
        },
        eventos: [],
        arquivo: [],
        editais: [],
        disciplinas: [],
        revisoes: [],
        planejamento: { ativo: false },
      },
      setState: vi.fn(),
      runMigrations: vi.fn(),
      createExportableState: vi.fn(() => ({ config: {}, eventos: [] })),
      clearData: vi.fn(() => Promise.resolve()),
    };
    logicModule = {
      syncCicloToEventos: vi.fn(),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
    };
    componentsModule = { renderCurrentView: vi.fn() };
    nuvem = {
      getNuvemStatus: vi.fn(() => ({ configured: true, state: 'off', uid: null, email: null, lastSyncAt: null, error: null, pending: false })),
    };
    vi.doMock('../../src/js/backup-restore.js?v=8.37', () => ({
      previewRestoreImpact: vi.fn(() => ({
        totals: { added: 2, removed: 1, changed: 1, preserved: 3 },
        byCollection: {
          eventos: { added: 1, removed: 1, changed: 0, preserved: 2 },
          habitos: { added: 1, removed: 0, changed: 1, preserved: 1 },
        },
        risks: ['remove-data'],
      })),
      validateBackupPayload: vi.fn(() => ({ ok: true, issues: [] })),
    }));

    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      cutoffDateStr: vi.fn((d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().slice(0, 10);
      }),
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      invalidateTodayCache: vi.fn(),
      addCleanupListener: vi.fn(),
    }));
    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/sync/nuvem.js?v=8.37', () => nuvem);

    configView = await import('../../src/js/views/config-view.js?v=8.37');
  });

  describe('setTheme()', () => {
    it('updates theme state and applies it', () => {
      configView.setTheme('dark');
      expect(storeModule.state.config.tema).toBe('dark');
      expect(storeModule.state.config.darkMode).toBe(true);
      expect(appModule.applyTheme).toHaveBeenCalled();
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('updateConfig()', () => {
    it('sets config key for regular keys', () => {
      configView.updateConfig('revisoesIntervalo', 14);
      expect(storeModule.state.config.revisoesIntervalo).toBe(14);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      // renderCurrentView removed to prevent input focus loss (fix: Cloudflare credentials)
    });

    it('calls syncCicloToEventos for materiasPorDia', () => {
      configView.updateConfig('materiasPorDia', 5);
      expect(logicModule.syncCicloToEventos).toHaveBeenCalled();
    });

    it('re-renders the current view for materiasPorDia so the forecast recalculates', () => {
      const handler = vi.fn();
      document.addEventListener('app:renderCurrentView', handler);
      configView.updateConfig('materiasPorDia', 4);
      document.removeEventListener('app:renderCurrentView', handler);
      expect(handler).toHaveBeenCalled();
    });

    it('stores cfToken directly in state.config', () => {
      configView.updateConfig('cfToken', 'new-token');
      expect(storeModule.state.config.cfToken).toBe('new-token');
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });
  });

  describe('toggleConfig()', () => {
    it('toggles boolean config value', () => {
      storeModule.state.config.darkMode = true;
      const el = { classList: { toggle: vi.fn() } };
      configView.toggleConfig('darkMode', el);
      expect(storeModule.state.config.darkMode).toBe(false);
      expect(el.classList.toggle).toHaveBeenCalledWith('on', false);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });

    it('turns on when was off', () => {
      storeModule.state.config.darkMode = false;
      const el = { classList: { toggle: vi.fn() } };
      configView.toggleConfig('darkMode', el);
      expect(storeModule.state.config.darkMode).toBe(true);
      expect(el.classList.toggle).toHaveBeenCalledWith('on', true);
    });
  });

  describe('updateFrequencia()', () => {
    it('parses comma-separated numbers', () => {
      configView.updateFrequencia('1, 3, 7, 14');
      expect(storeModule.state.config.frequenciaRevisao).toEqual([1, 3, 7, 14]);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });

    it('filters out invalid numbers', () => {
      configView.updateFrequencia('1, abc, 0, -5, 7');
      expect(storeModule.state.config.frequenciaRevisao).toEqual([1, 7]);
    });

    it('does nothing for empty input', () => {
      configView.updateFrequencia('');
      expect(storeModule.scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe('archiveOldEvents()', () => {
    it('shows info toast when no events to archive', () => {
      storeModule.state.eventos = [];
      configView.archiveOldEvents(90);
      expect(appModule.showToast).toHaveBeenCalledWith('Nenhum evento para arquivar.', 'info');
    });

    it('archives old completed events', () => {
      const oldDate = '2025-01-01';
      storeModule.state.eventos = [
        { id: 'e1', status: 'estudei', data: oldDate },
        { id: 'e2', status: 'pendente', data: oldDate },
        { id: 'e3', status: 'estudei', data: '2026-04-28' },
      ];
      configView.archiveOldEvents(90);
      expect(appModule.showConfirm).toHaveBeenCalled();
    });
  });

  describe('exportData()', () => {
    it('creates downloadable JSON blob', () => {
      const mockCreateObjectURL = vi.fn(() => 'blob:url');
      const mockRevokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
      const mockClick = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({ click: mockClick, href: '', download: '' });

      configView.exportData();
      expect(storeModule.createExportableState).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(appModule.showToast).toHaveBeenCalledWith('Dados exportados!', 'success');
    });
  });

  describe('clearAllData()', () => {
    it('calls clearData and resets state', async () => {
      await configView.clearAllData();
      expect(storeModule.clearData).toHaveBeenCalled();
    });
  });

  describe('renderConfig(): conta e backup', () => {
    it('mostra o cartão de conta com "Entrar com Google" quando não há login', () => {
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).toContain('data-testid="conta-sync"');
      expect(el.innerHTML).toContain('data-action="nuvem-sign-in"');
      expect(el.innerHTML).not.toMatch(/Central de Sincronização|Cloudflare|Google Drive/);
    });

    it('logado, mostra a conta e "Sincronizar agora"', () => {
      nuvem.getNuvemStatus.mockReturnValue({ configured: true, state: 'synced', uid: 'u', email: 'eu@x.com', lastSyncAt: null, error: null, pending: false });
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).toContain('eu@x.com');
      expect(el.innerHTML).toContain('data-action="nuvem-sync-now"');
    });
  });

  describe('renderConfig()', () => {
    it('renders a backup card with export and import only', () => {
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).toContain('data-testid="backup-card"');
      expect(el.innerHTML).toContain('data-action="export-data"');
      expect(el.innerHTML).toContain('data-action="import-data"');
      expect(el.innerHTML).not.toContain('backup-restore-source');
    });

    it('renders the Avançado collapsed section with destructive actions', () => {
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).toContain('data-testid="advanced-settings"');
      expect(el.innerHTML).toContain('data-action="archive-old-events"');
      expect(el.innerHTML).toContain('data-action="force-sw-cache-clear"');
      expect(el.innerHTML).toContain('data-action="clear-all-data"');
    });

    it('does not render the Sobre card', () => {
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).not.toContain('Estudo Organizado é um app');
      expect(el.innerHTML).not.toContain('fa-circle-info');
    });

    it('renders the daily study goal field (metaDiariaMin) used by the MED sticky header', () => {
      storeModule.state.config.metaDiariaMin = 120;
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).toContain('data-config-key="metaDiariaMin"');
      expect(el.innerHTML).toContain('Meta diária de estudo');
      expect(el.innerHTML).toMatch(/data-config-key="metaDiariaMin"[^>]*value="120"|value="120"[^>]*data-config-key="metaDiariaMin"/);
    });

    it('merges Calendário and Planejamento Diário into a single card', () => {
      const el = document.createElement('div');
      configView.renderConfig(el);
      expect(el.innerHTML).toContain('Calendário &amp; Estudos');
      expect(el.innerHTML).toContain('Matérias por dia no Ciclo');
      // Standalone "Planejamento Diário" header should be gone
      expect(el.innerHTML).not.toContain('>📚 Planejamento Diário<');
    });
  });

  describe('openRestorePreviewModal()', () => {
    it('opens a restore preview modal with impact totals and export-before-restore action', () => {
      document.body.innerHTML = `
        <div id="modal-prompt">
          <h2 id="modal-prompt-title"></h2>
          <div id="modal-prompt-body"></div>
          <button id="modal-prompt-save"></button>
        </div>
      `;
      const onConfirm = vi.fn();

      configView.openRestorePreviewModal({ eventos: [{ id: 'novo' }], config: {} }, {
        sourceLabel: 'JSON local',
        onConfirm,
      });

      expect(document.getElementById('modal-prompt-title').textContent).toBe('Prévia de restauração');
      expect(document.getElementById('modal-prompt-body').innerHTML).toContain('2 adicionados');
      expect(document.getElementById('modal-prompt-body').innerHTML).toContain('Exportar antes de restaurar');
      expect(appModule.openModal).toHaveBeenCalledWith('modal-prompt');
    });
  });
});
