import { describe, expect, it } from 'vitest';
import { hydrateAulas } from '../../src/js/ui/aulas-hydrate.js';

function root(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('hydrateAulas', () => {
  it('troca o espaço reservado pela aula formatada', async () => {
    const el = root('<div class="lesson" data-aula-id="a_1_1">Carregando aula…</div>');
    await hydrateAulas(el, async () => '## Teoria\n\nTexto **forte**.');
    expect(el.querySelector('h3')?.textContent).toContain('Teoria');
    expect(el.querySelector('strong')?.textContent).toBe('forte');
    expect(el.querySelector('[data-aula-id]')?.getAttribute('data-aula-state')).toBe('ok');
  });

  it('avisa de forma clara quando a aula não existe neste aparelho', async () => {
    const el = root('<div class="lesson" data-aula-id="a_1_1">Carregando aula…</div>');
    await hydrateAulas(el, async () => null);
    expect(el.textContent).toContain('Aula não encontrada');
    expect(el.textContent).toContain('Google');
    expect(el.querySelector('[data-aula-id]')?.getAttribute('data-aula-state')).toBe('missing');
  });

  it('escapa HTML da aula', async () => {
    const el = root('<div data-aula-id="a_1_1"></div>');
    await hydrateAulas(el, async () => '<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img');
  });

  it('não falha quando o resolvedor lança erro', async () => {
    const el = root('<div data-aula-id="a_1_1"></div>');
    await hydrateAulas(el, async () => { throw new Error('x'); });
    expect(el.textContent).toContain('Aula não encontrada');
  });

  it('ignora raiz sem referências', async () => {
    const el = root('<p>nada</p>');
    await expect(hydrateAulas(el, async () => 'x')).resolves.toBeUndefined();
    expect(el.textContent).toBe('nada');
  });
});
