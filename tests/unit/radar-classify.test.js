// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classify, STAGE_RANK } from '../../radar/lib/classify.js';

describe('classify', () => {
  it.each([
    ['Edital do concurso do TJ-SP é publicado; inscrições abertas', 'edital'],
    ['Concurso TRT-2: banca organizadora é definida', 'banca'],
    ['Comissão do concurso do TJ-MG é formada', 'comissao'],
    ['Governo autoriza concurso com 300 vagas', 'autorizado'],
    ['Portaria libera concurso para técnico judiciário', 'autorizado'],
    ['Concurso TJ-RS: previsão de edital para 2027', 'previsto'],
    ['Concurso da Prefeitura de São Paulo: o que se sabe', 'noticia'],
  ])('"%s" -> %s', (title, stage) => {
    expect(classify(title)).toEqual({ relevant: true, stage });
  });

  it('usa o estágio mais avançado quando há vários sinais', () => {
    expect(classify('Banca definida e edital publicado').stage).toBe('edital');
    expect(classify('Comissão formada e banca definida').stage).toBe('banca');
  });

  it('descarta ruído: resultado, gabarito, convocação, curso preparatório', () => {
    for (const title of [
      'Gabarito do concurso do TJ-SP divulgado',
      'Resultado final do concurso TRT-15',
      'Convocação de aprovados no concurso da PM',
      'Apostila para concurso TJ-SP com desconto',
      'Curso preparatório para o concurso do TRF3',
    ]) {
      expect(classify(title).relevant).toBe(false);
    }
  });

  it('descarta texto sem relação com concurso', () => {
    expect(classify('Time vence o clássico paulista').relevant).toBe(false);
  });

  it('expõe a ordem dos estágios do mais avançado ao menos avançado', () => {
    expect(STAGE_RANK.edital).toBeGreaterThan(STAGE_RANK.banca);
    expect(STAGE_RANK.banca).toBeGreaterThan(STAGE_RANK.comissao);
    expect(STAGE_RANK.comissao).toBeGreaterThan(STAGE_RANK.autorizado);
    expect(STAGE_RANK.autorizado).toBeGreaterThan(STAGE_RANK.previsto);
    expect(STAGE_RANK.previsto).toBeGreaterThan(STAGE_RANK.noticia);
  });
});
