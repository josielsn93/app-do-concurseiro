/**
 * Data Management
 * Archive, export, import, restore, and clear data operations
 */

import { showConfirm, showToast, openModal } from '../../app.js?v=8.37';
import { cutoffDateStr, esc, invalidateTodayCache, todayStr } from '../../utils.js?v=8.37';
import {
  state,
  setState,
  scheduleSave,
  runMigrations,
  createExportableState,
  clearData,
} from '../../store.js?v=8.37';
import {
  invalidateDiscCache,
  invalidateDashCaches,
  invalidateRevCache,
} from '../../logic.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { previewRestoreImpact, validateBackupPayload } from '../../backup-restore.js?v=8.37';
import { renderRestoreImpactSummary } from './backup-settings.js?v=8.37';

export function archiveOldEvents(days = 90) {
  const cutoffStr = cutoffDateStr(days);
  const toArchive = state.eventos.filter(
    (e) => e.status === 'estudei' && e.data && e.data < cutoffStr
  );
  if (toArchive.length === 0) {
    showToast('Nenhum evento para arquivar.', 'info');
    return;
  }
  showConfirm(
    `Arquivar ${toArchive.length} evento(s) concluído(s) com mais de ${days} dias?\n\nEles continuarão no export/backup, mas não aparecerão nos relatórios.`,
    () => {
      state.arquivo = [...(state.arquivo || []), ...toArchive];
      const archiveIds = new Set(toArchive.map((e) => e.id));
      state.eventos = state.eventos.filter((e) => !archiveIds.has(e.id));
      scheduleSave();
      renderCurrentView();
      showToast(`${toArchive.length} evento(s) arquivados.`, 'success');
    },
    { label: 'Arquivar', title: `Arquivar eventos (>${days} dias)` }
  );
}

export function exportData() {
  const blob = new Blob([JSON.stringify(createExportableState(), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estudo-organizado-backup-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast('Dados exportados!', 'success');
}

export function openRestorePreviewModal(payload = state, options = {}) {
  const modal = document.getElementById('modal-prompt');
  const title = document.getElementById('modal-prompt-title');
  const body = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!modal || !title || !body || !saveBtn) {
    showToast('Modal de restauração indisponível.', 'error');
    return false;
  }

  const sourceLabel = options.sourceLabel || 'backup selecionado';
  const impact = previewRestoreImpact(state, payload || {});
  title.textContent = 'Prévia de restauração';
  body.innerHTML = `
    <div class="restore-preview-modal">
      <div class="config-desc">Origem: <strong>${esc(sourceLabel)}</strong>. Revise o impacto antes de substituir os dados locais.</div>
      ${renderRestoreImpactSummary(impact)}
      <div class="restore-preview-warning">
        A restauração pode substituir eventos, editais, hábitos, revisões e configurações locais.
      </div>
      <div class="config-actions-row">
        <button type="button" class="btn btn-ghost btn-sm" data-action="export-data">
          <i class="fa fa-download"></i> Exportar antes de restaurar
        </button>
      </div>
    </div>
  `;
  saveBtn.textContent = options.label || 'Restaurar';
  saveBtn.className = 'btn btn-danger';
  saveBtn.onclick = () => {
    if (typeof options.onConfirm === 'function') {
      options.onConfirm();
    }
  };
  openModal('modal-prompt');
  return true;
}

export function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.className = 'sr-only';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      input.remove();
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
          showToast('Arquivo inválido! O JSON não contém um objeto de dados válido.', 'error');
          return;
        }
        const hasValidStructure =
          (Array.isArray(imported.editais) || imported.editais === undefined) &&
          (Array.isArray(imported.eventos) || imported.eventos === undefined) &&
          (typeof imported.config === 'object' || imported.config === undefined);
        const validation = validateBackupPayload(imported);
        if (!hasValidStructure || !validation.ok) {
          showToast(
            'Arquivo inválido! Este JSON não parece ser um backup do App de estudos.',
            'error'
          );
          return;
        }
        openRestorePreviewModal(imported, {
          sourceLabel: file.name,
          label: 'Importar',
          onConfirm: () => {
            setState(imported);
            runMigrations();
            invalidateDiscCache();
            invalidateDashCaches();
            invalidateRevCache();
            invalidateTodayCache();
            scheduleSave();
            renderCurrentView();
            showToast('Dados importados com sucesso!', 'success');
          },
        });
      } catch {
        showToast(
          'Arquivo inválido! Verifique se é um JSON de backup do App de estudos.',
          'error'
        );
      }
    };
    reader.onloadend = () => {
      input.remove();
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
}

// Restauração é sempre a partir de um arquivo: a nuvem já fica sincronizada.
export function restoreBackupFromSelectedSource() {
  importData();
}

export function clearAllData() {
  showConfirm(
    '⚠️ Apagar TODOS os dados permanentemente?\n\nEditais, eventos, hábitos e configurações serão removidos.\n\nEsta ação é irreversível.',
    () => {
      showConfirm('Última confirmação: isso não pode ser desfeito.', () => clearData(), {
        danger: true,
        label: 'Apagar tudo definitivamente',
        title: '⚠️ Confirmação final',
      });
    },
    { danger: true, label: 'Continuar com exclusão', title: '⚠️ Apagar todos os dados' }
  );
}
