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

  it('não trata banca "em definição" ou prazo de escolha como banca definida', () => {
    expect(classify('Concurso TJ PR segue com banca em definição').stage).not.toBe('banca');
    expect(classify('Concurso TJ PR: prazo para escolha da banca é reaberto').stage).not.toBe('banca');
  });

  it('não trata orçamento ou LOA genéricos como autorização', () => {
    expect(classify('Orçamento 2027 prevê gastos com pessoal; concurso incerto').stage).not.toBe('autorizado');
  });

  it('descarta resumos genéricos de vários concursos', () => {
    for (const title of [
      'Concursos DF 2026: confira os editais abertos e previstos',
      'Concursos Sul 2026: editais previstos e abertos',
      'Concursos policiais 2027: mais de 20 mil vagas previstas em todo o país',
      'Concursos Nível Médio 2026: editais previstos e oportunidades',
    ]) {
      expect(classify(title).relevant).toBe(false);
    }
  });

  it('descarta cargos fora do perfil (exigem formação específica)', () => {
    for (const title of [
      'Concurso TJ MG Juiz: edital publicado',
      'Concurso TJ SP Oficial de Justiça: inscrições abertas',
      'Concurso para médico da prefeitura autorizado',
      'Concurso de professor da rede estadual: edital publicado',
      'Concursos de cartórios: edital publicado com vagas',
    ]) {
      expect(classify(title).relevant).toBe(false);
    }
  });

  it('mantém cargos de nível médio e técnico', () => {
    expect(classify('TJ-SP: edital publicado para Escrevente Técnico Judiciário').relevant).toBe(true);
    expect(classify('Concurso TRF3 autoriza vagas para técnico judiciário').relevant).toBe(true);
  });

  it('expõe a ordem dos estágios do mais avançado ao menos avançado', () => {
    expect(STAGE_RANK.edital).toBeGreaterThan(STAGE_RANK.banca);
    expect(STAGE_RANK.banca).toBeGreaterThan(STAGE_RANK.comissao);
    expect(STAGE_RANK.comissao).toBeGreaterThan(STAGE_RANK.autorizado);
    expect(STAGE_RANK.autorizado).toBeGreaterThan(STAGE_RANK.previsto);
    expect(STAGE_RANK.previsto).toBeGreaterThan(STAGE_RANK.noticia);
  });
});
