/**
 * Indicador de sincronização no topo (pílula + menu).
 *
 * Um só estado, em português claro: só neste aparelho, sincronizando,
 * sincronizado, enviando, sem internet ou erro. O menu mostra a conta e a
 * última sincronização, com "Sincronizar agora" ou "Entrar com Google".
 */
import { esc } from '../utils.js?v=8.37';
import { getNuvemStatus } from './nuvem.js?v=8.37';

const PILL = {
  idle: { icon: 'fa-circle', label: 'Só neste aparelho' },
  syncing: { icon: 'fa-spinner fa-spin', label: 'Sincronizando…' },
  ok: { icon: 'fa-circle-check', label: 'Sincronizado' },
  pending: { icon: 'fa-clock', label: 'Enviando…' },
  offline: { icon: 'fa-wifi', label: 'Sem internet' },
  error: { icon: 'fa-circle-exclamation', label: 'Erro na sincronização' },
  'save-error': { icon: 'fa-circle-exclamation', label: 'Erro ao salvar' },
};

let lastSaveStatus = 'saved';
let pillEl = null;
let popoverEl = null;
let outsideHandler = null;

export function describeNuvemPill(status, saveStatus = 'saved') {
  let kind = 'idle';
  if (saveStatus === 'error') kind = 'save-error';
  else if (!status?.uid) kind = 'idle';
  else if (status.state === 'syncing') kind = 'syncing';
  else if (status.state === 'offline') kind = 'offline';
  else if (status.state === 'error') kind = 'error';
  else if (status.pending) kind = 'pending';
  else if (status.state === 'synced') kind = 'ok';
  return { kind, ...PILL[kind] };
}

function formatTime(iso) {
  if (!iso) return 'ainda não';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ainda não';
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toDateString() === d.toDateString();
  return today ? `hoje às ${time}` : `${d.toLocaleDateString('pt-BR')} às ${time}`;
}

function detailText(status) {
  if (!status.configured) return 'A nuvem não está configurada neste app.';
  if (!status.uid) return 'Seus dados ficam só neste aparelho. Entre com o Google para estudar em qualquer lugar.';
  if (status.state === 'offline') return 'Suas mudanças estão salvas aqui e sobem quando a conexão voltar.';
  if (status.state === 'error') return status.error || 'Não foi possível sincronizar.';
  if (status.pending) return 'Há mudanças sendo enviadas.';
  return 'Tudo igual neste aparelho e na nuvem.';
}

export function renderNuvemPopover(status) {
  const rows = status.uid
    ? `
      <div class="sync-popover-row"><span class="sync-popover-row-label">Conta</span><span class="sync-popover-row-value">${esc(status.email || 'Google')}</span></div>
      <div class="sync-popover-row"><span class="sync-popover-row-label">Última sincronização</span><span class="sync-popover-row-value">${esc(formatTime(status.lastSyncAt))}</span></div>`
    : '';
  const primary = status.uid
    ? `<button class="btn btn-primary btn-sm" type="button" data-action="nuvem-sync-now"><i class="fa fa-arrows-rotate"></i> Sincronizar agora</button>`
    : status.configured
      ? `<button class="btn btn-primary btn-sm" type="button" data-action="nuvem-sign-in"><i class="fa fa-right-to-bracket"></i> Entrar com Google</button>`
      : '';
  return `
    <div class="sync-popover-status">
      ${rows}
      <p class="sync-popover-detail">${esc(detailText(status))}</p>
    </div>
    <hr class="sync-popover-divider" />
    <div class="sync-popover-actions">
      ${primary}
      <button class="btn btn-ghost btn-sm" type="button" data-action="nuvem-download-log"><i class="fa fa-file-lines"></i> Baixar diagnóstico</button>
    </div>`;
}

function render() {
  if (!pillEl) return;
  const status = getNuvemStatus();
  const pill = describeNuvemPill(status, lastSaveStatus);
  pillEl.className = `sync-pill sync-pill--${pill.kind}`;
  const icon = pillEl.querySelector('.sync-pill-icon');
  if (icon) icon.innerHTML = `<i class="fa ${pill.icon}"></i>`;
  const label = pillEl.querySelector('.sync-pill-label');
  if (label) label.textContent = pill.label;
  pillEl.title = pill.label;
  if (popoverEl && !popoverEl.hidden) popoverEl.innerHTML = renderNuvemPopover(status);
}

export function setSyncPopoverOpen(open) {
  if (!popoverEl || !pillEl) return;
  popoverEl.hidden = !open;
  pillEl.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    popoverEl.innerHTML = renderNuvemPopover(getNuvemStatus());
    setTimeout(() => {
      outsideHandler = (evt) => {
        if (popoverEl.contains(evt.target) || pillEl.contains(evt.target)) return;
        setSyncPopoverOpen(false);
      };
      document.addEventListener('click', outsideHandler, true);
    }, 0);
  } else if (outsideHandler) {
    document.removeEventListener('click', outsideHandler, true);
    outsideHandler = null;
  }
}

export function toggleSyncPopover() {
  if (popoverEl) setSyncPopoverOpen(popoverEl.hidden);
}

export function initNuvemStatusUI() {
  pillEl = document.getElementById('sync-pill');
  popoverEl = document.getElementById('sync-popover');
  document.addEventListener('app:nuvemStatus', render);
  document.addEventListener('app:saveStatus', (event) => {
    lastSaveStatus = event.detail?.status || 'saved';
    render();
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') setSyncPopoverOpen(false);
  });
  render();
}
