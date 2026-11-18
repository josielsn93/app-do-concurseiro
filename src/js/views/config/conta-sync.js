/**
 * Configurações: conta Google (sincronização), backup em arquivo e opções
 * avançadas. Substitui a antiga Central de Sincronização com três canais.
 */
import { esc } from '../../utils.js?v=8.37';
import { describeNuvemPill } from '../../sync/nuvem-status-ui.js?v=8.37';
import { getNuvemStatus } from '../../sync/nuvem.js?v=8.37';

// Atualiza só este cartão quando o status muda, sem redesenhar a página.
if (typeof document !== 'undefined') {
  document.addEventListener('app:nuvemStatus', () => {
    const card = document.querySelector('[data-testid="conta-sync"]');
    if (card) card.outerHTML = renderContaSyncCard(getNuvemStatus());
  });
}

function formatDateTime(iso) {
  if (!iso) return 'ainda não';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ainda não';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function renderContaSyncCard(status) {
  if (!status.configured) {
    return `
      <div class="card config-card" data-testid="conta-sync">
        <div class="card-header"><h3><i class="fa fa-cloud"></i> Conta e sincronização</h3></div>
        <div class="card-body"><div class="config-desc">A nuvem não está configurada neste app.</div></div>
      </div>`;
  }
  if (!status.uid) {
    return `
      <div class="card config-card" data-testid="conta-sync">
        <div class="card-header"><h3><i class="fa fa-cloud"></i> Conta e sincronização</h3></div>
        <div class="card-body">
          <div class="config-desc">
            Hoje seus dados ficam só neste aparelho. Entre com o Google para guardar o progresso na nuvem e continuar de onde parou em qualquer computador ou celular.
          </div>
          <button class="btn btn-primary" type="button" data-action="nuvem-sign-in"><i class="fa fa-right-to-bracket"></i> Entrar com Google</button>
        </div>
      </div>`;
  }
  const pill = describeNuvemPill(status);
  const error = status.state === 'error' && status.error
    ? `<div class="config-hint config-hint--error">${esc(status.error)}</div>`
    : '';
  return `
    <div class="card config-card" data-testid="conta-sync">
      <div class="card-header"><h3><i class="fa fa-cloud"></i> Conta e sincronização</h3></div>
      <div class="card-body">
        <div class="config-row">
          <div>
            <div class="config-label">${esc(status.email || 'Conta Google')}</div>
            <div class="config-sub"><i class="fa ${pill.icon}"></i> ${esc(pill.label)} · última vez ${esc(formatDateTime(status.lastSyncAt))}</div>
          </div>
        </div>
        <div class="config-desc">As mudanças sobem sozinhas alguns segundos depois e chegam aos outros aparelhos abertos na hora.</div>
        ${error}
        <div class="config-actions-row">
          <button class="btn btn-primary btn-sm" type="button" data-action="nuvem-sync-now"><i class="fa fa-arrows-rotate"></i> Sincronizar agora</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="nuvem-sign-out"><i class="fa fa-right-from-bracket"></i> Sair</button>
        </div>
      </div>
    </div>`;
}

export function renderBackupCard(config = {}) {
  return `
    <div class="card config-card" data-testid="backup-card">
      <div class="card-header"><h3><i class="fa fa-shield-halved"></i> Backup em arquivo</h3></div>
      <div class="card-body">
        <div class="config-desc">
          Guarde uma cópia de tudo num arquivo JSON. Ao importar, o app mostra o que vai mudar antes de substituir.
        </div>
        <div class="flex flex-between config-backup-grid"><span>Último salvamento neste aparelho:</span><strong>${esc(formatDateTime(config.localBackupAt))}</strong></div>
        <div class="backup-center-primary-actions">
          <button class="btn btn-primary" type="button" data-action="export-data"><i class="fa fa-download"></i> Exportar backup</button>
          <button class="btn btn-outline" type="button" data-action="import-data"><i class="fa fa-file-import"></i> Importar backup</button>
        </div>
      </div>
    </div>`;
}

export function renderAdvancedCard() {
  return `
    <div class="card config-card" data-testid="advanced-settings">
      <div class="card-header"><h3><i class="fa fa-triangle-exclamation"></i> Avançado</h3></div>
      <div class="card-body">
        <details class="advanced-details">
          <summary>Mostrar opções avançadas</summary>
          <div class="advanced-content">
            <div class="config-desc">Operações pouco frequentes. Algumas são destrutivas: leia antes de clicar.</div>
            <div class="config-row">
              <div>
                <div class="config-label">Arquivar eventos antigos</div>
                <div class="config-sub">Move concluídos com mais de 90 dias para o arquivo.</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-action="archive-old-events" data-days="90"><i class="fa fa-box-archive"></i> Arquivar</button>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Diagnóstico da sincronização</div>
                <div class="config-sub">Arquivo para suporte, sem o conteúdo dos seus estudos.</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-action="nuvem-download-log"><i class="fa fa-file-lines"></i> Baixar</button>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Cache do app</div>
                <div class="config-sub">Limpa o cache e força a versão mais recente.</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-action="force-sw-cache-clear"><i class="fa fa-rotate"></i> Limpar cache</button>
            </div>
            <div class="config-row advanced-danger-row">
              <div>
                <div class="config-label">Limpar todos os dados deste aparelho</div>
                <div class="config-sub">Remove tudo deste aparelho. Não pode ser desfeito. Exporte um backup antes.</div>
              </div>
              <button class="btn btn-danger btn-sm" data-action="clear-all-data"><i class="fa fa-trash"></i> Limpar tudo</button>
            </div>
          </div>
        </details>
      </div>
    </div>`;
}
