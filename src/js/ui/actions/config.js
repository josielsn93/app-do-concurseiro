/**
 * Ações de Configurações
 * Handlers para configurações, sync, backup e preferências
 */

import { registerAction } from './dispatcher.js';
import { adoptNotificationPermission } from '../../notifications.js?v=8.37';
import {
  updateConfig,
  toggleConfig,
  updateFrequencia,
  archiveOldEvents,
  clearAllData,
  setTheme,
  exportData,
  importData,
} from '../../views/config-view.js?v=8.37';
import { showToast } from '../../app.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import {
  downloadNuvemDiagnostic,
  nuvemSignIn,
  nuvemSignOut,
  nuvemSyncNow,
} from '../../sync/nuvem.js?v=8.37';
import { setSyncPopoverOpen, toggleSyncPopover } from '../../sync/nuvem-status-ui.js?v=8.37';
// Registrar ações
registerAction('update-config', (el) => {
  const key = el.dataset.configKey;
  if (!key) return;
  let value = el.value;
  if (el.dataset.valueType === 'number') {
    value = parseInt(value, 10);
    // Campo limpo/inválido viraria NaN no estado (e NaN ?? default não recupera).
    if (!Number.isFinite(value)) return;
  } else if (el.dataset.valueTransform === 'trim-url') {
    value = value.trim().replace(/\/$/, '');
  } else if (el.dataset.valueTransform === 'trim') {
    value = value.trim();
  }
  updateConfig(key, value);
});
registerAction('toggle-config', (el) => {
  const key = el.dataset.configKey;
  if (!key) return;
  toggleConfig(key, el);
  el.setAttribute('aria-pressed', el.classList.contains('on') ? 'true' : 'false');
});
registerAction('update-frequencia', (el) => updateFrequencia(el.value));
registerAction('toggle-password-visibility', (el) => {
  const input = document.getElementById(el.dataset.targetId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
});
registerAction('archive-old-events', (el) => {
  const days = parseInt(el.dataset.days || '90', 10);
  archiveOldEvents(days);
});
registerAction('clear-all-data', clearAllData);
registerAction('set-theme', (el) => setTheme(el.value));
registerAction('export-data', exportData);
registerAction('import-data', importData);
registerAction('restore-backup', () => importData());
registerAction('open-restore-preview', () => importData());
registerAction('request-notification-permission', () => {
  if (!('Notification' in window)) return;
  Notification.requestPermission()
    .then((permission) => {
      adoptNotificationPermission();
      if (permission === 'granted') showToast('Notificações ativadas!', 'success');
      renderCurrentView();
    })
    .catch((error) => console.warn(error));
});
registerAction('test-notification', () => {
  if ('Notification' in window) {
    new Notification('App de estudos', { body: 'Notificações funcionando!', icon: '📚' });
    showToast('Lembretes enviados!', 'success');
  }
});

// Conta e sincronização (nuvem)
registerAction('nuvem-sign-in', async () => {
  setSyncPopoverOpen(false);
  try {
    const user = await nuvemSignIn();
    if (user) showToast('Conectado. Sincronizando seus estudos…', 'success');
    renderCurrentView();
  } catch (error) {
    showToast('Não foi possível entrar: ' + (error?.message || 'erro desconhecido'), 'error');
  }
});
registerAction('nuvem-sign-out', async () => {
  await nuvemSignOut();
  showToast('Você saiu. Os dados continuam neste aparelho.', 'info');
  renderCurrentView();
});
async function syncNowAction() {
  setSyncPopoverOpen(false);
  const ok = await nuvemSyncNow();
  showToast(ok ? 'Sincronizado.' : 'Não foi possível sincronizar agora. Tentaremos de novo sozinhos.', ok ? 'success' : 'info');
}
registerAction('nuvem-sync-now', syncNowAction);
registerAction('sync-now', syncNowAction);
registerAction('nuvem-download-log', () => {
  setSyncPopoverOpen(false);
  downloadNuvemDiagnostic();
});
registerAction('toggle-sync-popover', () => toggleSyncPopover());
registerAction('force-sw-cache-clear', async () => {
  if (!('serviceWorker' in navigator)) {
    showToast('Service Worker não suportado neste browser.', 'error');
    return;
  }
  try {
    showToast('Limpando cache...', 'info');
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      await reg.update();
    }
    window.location.reload(true);
  } catch (err) {
    console.error('Erro ao limpar cache do SW:', err);
    showToast('Erro ao limpar cache. Tente Ctrl+Shift+R.', 'error');
  }
});
