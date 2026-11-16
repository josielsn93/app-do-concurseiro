// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildEventDetailHtml, renderLessonNotes } from '../../src/js/ui/event-detail-view.js';

describe('renderLessonNotes', () => {
  it('escapa HTML do texto (sem XSS)', () => {
    const html = renderLessonNotes('<script>alert(1)</script> e <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converte títulos em h3/h4 e parágrafos em <p>', () => {
    const html = renderLessonNotes('## Teoria\n\nTexto simples.\n\n### Detalhe\n\nOutro.');
    expect(html).toContain('<h3');
    expect(html).toContain('Teoria</h3>');
    expect(html).toContain('<h4');
    expect(html).toContain('<p>Texto simples.</p>');
  });

  it('converte listas com marcadores e numeradas', () => {
    const html = renderLessonNotes('- um\n- dois\n\n1. primeiro\n2. segundo');
    expect(html).toMatch(/<ul[^>]*>\s*<li>um<\/li>\s*<li>dois<\/li>\s*<\/ul>/);
    expect(html).toMatch(/<ol[^>]*>\s*<li>primeiro<\/li>\s*<li>segundo<\/li>\s*<\/ol>/);
  });

  it('converte **negrito**, *itálico* e `código`', () => {
    const html = renderLessonNotes('Isto é **forte**, *leve* e `x`.');
    expect(html).toContain('<strong>forte</strong>');
    expect(html).toContain('<em>leve</em>');
    expect(html).toContain('<code>x</code>');
  });

  it('converte citações (> ) em destaque e tabelas em <table> com cabeçalho', () => {
    const html = renderLessonNotes('> Dica importante\n\n| Regra | Exemplo |\n|---|---|\n| A | B |');
    expect(html).toContain('<blockquote');
    expect(html).toContain('Dica importante');
    expect(html).toMatch(/<table[\s\S]*<thead>[\s\S]*<th[^>]*>Regra<\/th>[\s\S]*<tbody>[\s\S]*<td>B<\/td>/);
  });

  it('transforma blocos ::: em <details> recolhível (gabarito)', () => {
    const html = renderLessonNotes('::: Gabarito\nLetra C. Porque sim.\n:::');
    expect(html).toMatch(/<details[^>]*>\s*<summary>Gabarito<\/summary>/);
    expect(html).toContain('Letra C. Porque sim.');
  });

  it('só aceita links http(s) e abre em nova aba com rel seguro', () => {
    const ok = renderLessonNotes('[Planalto](https://www.planalto.gov.br/)');
    expect(ok).toContain('href="https://www.planalto.gov.br/"');
    expect(ok).toContain('rel="noopener noreferrer"');
    const bad = renderLessonNotes('[x](javascript:alert(1))');
    expect(bad).not.toContain('href="javascript');
  });

  it('retorna string vazia para texto vazio', () => {
    expect(renderLessonNotes('')).toBe('');
    expect(renderLessonNotes(null)).toBe('');
  });
});

describe('buildEventDetailHtml', () => {
  const base = {
    ev: { data: '2026-11-16', duracao: 60, notas: '## Objetivo\n\nEstudar.', tempoAcumulado: 0 },
    status: { label: 'Agendado', class: 'badge-muted' },
    disciplina: '📚 Língua Portuguesa',
    assunto: 'Interpretação de textos',
    aula: '',
    tempo: '—',
  };

  it('usa estrutura semântica: article, lista de definição e seção da aula', () => {
    const html = buildEventDetailHtml(base);
    expect(html).toContain('<article class="event-detail"');
    expect(html).toMatch(/<dl class="event-meta"[\s\S]*<dt>[\s\S]*<dd>/);
    expect(html).toContain('<section class="lesson"');
    expect(html).toContain('<h3');
  });

  it('mostra a data em formato brasileiro e a duração em minutos', () => {
    const html = buildEventDetailHtml(base);
    expect(html).toContain('16/11/2026');
    expect(html).toContain('60 min');
  });

  it('não usa as divs sem estilo antigas (event-detail-field)', () => {
    expect(buildEventDetailHtml(base)).not.toContain('event-detail-field');
  });

  it('escapa nome de disciplina e assunto', () => {
    const html = buildEventDetailHtml({ ...base, disciplina: '<b>x</b>', assunto: '<i>y</i>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<i>y</i>');
  });

  it('omite a seção da aula quando não há anotações', () => {
    const html = buildEventDetailHtml({ ...base, ev: { ...base.ev, notas: '' } });
    expect(html).not.toContain('class="lesson"');
  });
});
