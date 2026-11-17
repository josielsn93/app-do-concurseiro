/**
 * Preenche os espaços reservados de aula (`[data-aula-id]`) com o texto vindo do
 * armazém de aulas (local, depois nuvem).
 */

import { renderLessonNotes } from './event-detail-view.js?v=8.37';
import { aulasStore } from '../store/aulas-store.js?v=8.37';

const MISSING_HTML =
  '<p class="lesson-missing">Aula não encontrada neste aparelho. ' +
  'Entre com sua conta Google para baixá-la da nuvem ou importe o plano novamente.</p>';

export async function hydrateAulas(root, resolveAula = (id) => aulasStore.get(id)) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const slots = [...root.querySelectorAll('[data-aula-id]')];
  await Promise.all(
    slots.map(async (slot) => {
      const id = slot.getAttribute('data-aula-id');
      let text = null;
      try {
        text = await (resolveAula || ((x) => aulasStore.get(x)))(id);
      } catch {
        text = null;
      }
      if (typeof text === 'string' && text.length > 0) {
        slot.innerHTML = renderLessonNotes(text);
        slot.classList.add('lesson');
        slot.setAttribute('data-aula-state', 'ok');
      } else {
        slot.innerHTML = MISSING_HTML;
        slot.setAttribute('data-aula-state', 'missing');
      }
    }),
  );
}
