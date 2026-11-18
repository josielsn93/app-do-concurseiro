import { describe, expect, it } from 'vitest';
import { mergeCloudStates } from '../../src/js/sync/cloud-merge.js';

const NOW = '2026-11-18T15:00:00.000Z';

function bloco(id, data, ordem, discId, extra = {}) {
  return { id, data, dataOriginal: data, dataPlanejada: data, ordem, discId, topicos: ['t'], minutos: 60, status: 'pendente', rolagens: 0, notas: '', ...extra };
}

function plano(planId, importadoEm, blocos, extra = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    schemaVersionRetaFinal: 2,
    planId,
    revision: 0,
    updatedAt: importadoEm,
    disciplinas: [...new Set(blocos.map((b) => b.discId))],
    retaFinal: { nome: 'Plano', dataFinal: '2027-03-14', minutosPadrao: 60, importadoEm, blocos },
    ...extra,
  };
}

function evento(id, extra = {}) {
  return { id, titulo: id, data: '2026-11-18', duracao: 60, status: 'agendado', tempoAcumulado: 0, criadoEm: '2026-11-01T00:00:00.000Z', ...extra };
}

function estado(extra = {}) {
  return { schemaVersion: 12, editais: [], eventos: [], arquivo: [], revisoes: [], habitos: {}, syncTombstones: [], config: {}, planejamento: null, ...extra };
}

const ids = (list) => (list || []).map((item) => item.id).sort();

describe('mergeCloudStates: itens por id', () => {
  it('une os dois lados e, no mesmo item, fica a edição mais recente', () => {
    const local = estado({ eventos: [evento('a', { updatedAt: '2026-11-18T10:00:00Z', notas: 'local' }), evento('so-local')] });
    const remote = estado({ eventos: [evento('a', { updatedAt: '2026-11-18T11:00:00Z', notas: 'remoto' }), evento('so-remoto')] });

    const merged = mergeCloudStates(local, remote, { now: NOW });

    expect(ids(merged.eventos)).toEqual(['a', 'so-local', 'so-remoto']);
    expect(merged.eventos.find((e) => e.id === 'a').notas).toBe('remoto');
  });

  it('não ressuscita o que foi apagado em qualquer lado', () => {
    const local = estado({
      eventos: [],
      syncTombstones: [{ col: 'eventos', id: 'x', deletedAt: '2026-11-18T12:00:00Z' }],
    });
    const remote = estado({ eventos: [evento('x', { updatedAt: '2026-11-18T09:00:00Z' })] });

    expect(ids(mergeCloudStates(local, remote, { now: NOW }).eventos)).toEqual([]);
    expect(ids(mergeCloudStates(remote, local, { now: NOW }).eventos)).toEqual([]);
  });

  it('mantém um item editado depois de ter sido apagado', () => {
    const local = estado({ syncTombstones: [{ col: 'eventos', id: 'x', deletedAt: '2026-11-18T08:00:00Z' }] });
    const remote = estado({ eventos: [evento('x', { updatedAt: '2026-11-18T09:00:00Z' })] });

    expect(ids(mergeCloudStates(local, remote, { now: NOW }).eventos)).toEqual(['x']);
  });

  it('mescla hábitos por tipo e descarta tombstones com mais de 180 dias', () => {
    const local = estado({
      habitos: { questoes: [{ id: 'q1', criadoEm: '2026-11-01' }] },
      syncTombstones: [{ col: 'eventos', id: 'velho', deletedAt: '2026-01-01T00:00:00Z' }],
    });
    const remote = estado({ habitos: { questoes: [{ id: 'q2', criadoEm: '2026-11-02' }], leitura: [{ id: 'l1' }] } });

    const merged = mergeCloudStates(local, remote, { now: NOW });

    expect(ids(merged.habitos.questoes)).toEqual(['q1', 'q2']);
    expect(ids(merged.habitos.leitura)).toEqual(['l1']);
    expect(merged.syncTombstones).toEqual([]);
  });

  it('é simétrico e idempotente nas coleções', () => {
    const a = estado({ eventos: [evento('1', { updatedAt: '2026-11-18T10:00:00Z' }), evento('2')], editais: [{ id: 'e1', nome: 'A' }] });
    const b = estado({ eventos: [evento('1', { updatedAt: '2026-11-18T11:00:00Z', notas: 'b' }), evento('3')], editais: [{ id: 'e2', nome: 'B' }] });

    const ab = mergeCloudStates(a, b, { now: NOW });
    const ba = mergeCloudStates(b, a, { now: NOW });

    expect(ids(ab.eventos)).toEqual(ids(ba.eventos));
    expect(ab.eventos.find((e) => e.id === '1').notas).toBe('b');
    expect(ba.eventos.find((e) => e.id === '1').notas).toBe('b');
    expect(mergeCloudStates(ab, ab, { now: NOW }).eventos).toEqual(ab.eventos);
  });

  it('sem estado remoto, devolve o local intacto', () => {
    const local = estado({ eventos: [evento('a')] });
    expect(mergeCloudStates(local, null, { now: NOW })).toEqual(local);
  });
});

describe('mergeCloudStates: configurações', () => {
  it('nunca leva configurações deste aparelho para o outro', () => {
    const local = estado({ config: { firestoreSync: { enabled: true, mode: 'primary' }, cfUrl: 'local', visualizacao: 'mes' } });
    const remote = estado({ config: { firestoreSync: { enabled: false }, cfUrl: 'remoto', visualizacao: 'semana' } });

    const merged = mergeCloudStates(local, remote, { now: NOW, newer: 'remote' });

    expect(merged.config.firestoreSync).toEqual({ enabled: true, mode: 'primary' });
    expect(merged.config.cfUrl).toBe('local');
    expect(merged.config.visualizacao).toBe('semana');
  });

  it('preferências seguem o lado mais novo', () => {
    const local = estado({ config: { visualizacao: 'mes' } });
    const remote = estado({ config: { visualizacao: 'semana', materiasPorDia: 4 } });

    const keepLocal = mergeCloudStates(local, remote, { now: NOW, newer: 'local' });
    expect(keepLocal.config.visualizacao).toBe('mes');
    expect(keepLocal.config.materiasPorDia).toBe(4);
  });
});

describe('mergeCloudStates: plano com a mesma identidade', () => {
  it('fica o plano editado por último e o status vem dos eventos estudados', () => {
    const blocos = [bloco('b1', '2026-11-18', 1, 'd1'), bloco('b2', '2026-11-18', 2, 'd1')];
    const local = estado({
      planejamento: plano('p1', '2026-11-16T00:00:00Z', blocos, { updatedAt: '2026-11-17T00:00:00Z' }),
      eventos: [evento('ev1', { rfBlocoId: 'b1', isAutoGenerated: true })],
    });
    const remotePlan = plano('p1', '2026-11-16T00:00:00Z', blocos.map((b) => ({ ...b, notas: 'editado' })), { updatedAt: '2026-11-18T00:00:00Z' });
    const remote = estado({
      planejamento: remotePlan,
      eventos: [evento('ev1', { rfBlocoId: 'b1', isAutoGenerated: true, status: 'estudei', updatedAt: '2026-11-18T12:00:00Z' })],
    });

    const merged = mergeCloudStates(local, remote, { now: NOW });

    expect(merged.planejamento.retaFinal.blocos[0].notas).toBe('editado');
    expect(merged.planejamento.retaFinal.blocos.find((b) => b.id === 'b1').status).toBe('concluido');
    expect(merged.planejamento.retaFinal.blocos.find((b) => b.id === 'b2').status).toBe('pendente');
  });

  it('um aparelho sem plano recebe o plano do outro', () => {
    const remote = estado({ planejamento: plano('p1', '2026-11-16T00:00:00Z', [bloco('b1', '2026-11-18', 1, 'd1')]) });
    expect(mergeCloudStates(estado(), remote, { now: NOW }).planejamento.planId).toBe('p1');
    expect(mergeCloudStates(remote, estado(), { now: NOW }).planejamento.planId).toBe('p1');
  });
});

describe('mergeCloudStates: o mesmo plano importado em dois aparelhos', () => {
  function cenario() {
    // Aparelho A importou primeiro; B importou o mesmo arquivo depois (ids novos).
    const blocosA = [bloco('a1', '2026-11-16', 1, 'dA'), bloco('a2', '2026-11-16', 2, 'dA')];
    const blocosB = [bloco('b1', '2026-11-16', 1, 'dB'), bloco('b2', '2026-11-16', 2, 'dB')];
    const A = estado({
      planejamento: plano('pA', '2026-11-16T10:00:00Z', blocosA),
      editais: [{ id: 'edA', nome: 'TJ-SP', disciplinas: [{ id: 'dA', nome: 'Português', assuntos: [] }] }],
      eventos: [
        evento('evA1', { rfBlocoId: 'a1', isAutoGenerated: true, discId: 'dA', status: 'estudei', tempoAcumulado: 3600, updatedAt: '2026-11-16T12:00:00Z' }),
        evento('evA2', { rfBlocoId: 'a2', isAutoGenerated: true, discId: 'dA' }),
        evento('manual', { discId: 'dA', titulo: 'Sessão livre' }),
      ],
    });
    const B = estado({
      planejamento: plano('pB', '2026-11-17T10:00:00Z', blocosB),
      editais: [{ id: 'edB', nome: 'TJ-SP', disciplinas: [{ id: 'dB', nome: 'Português', assuntos: [] }] }],
      eventos: [
        evento('evB1', { rfBlocoId: 'b1', isAutoGenerated: true, discId: 'dB', assId: 'assB1' }),
        evento('evB2', { rfBlocoId: 'b2', isAutoGenerated: true, discId: 'dB' }),
      ],
    });
    return { A, B };
  }

  it('vale a importação mais nova, nos dois sentidos', () => {
    const { A, B } = cenario();
    expect(mergeCloudStates(A, B, { now: NOW }).planejamento.planId).toBe('pB');
    expect(mergeCloudStates(B, A, { now: NOW }).planejamento.planId).toBe('pB');
  });

  it('transfere o que foi estudado no plano antigo para o bloco equivalente do novo', () => {
    const { A, B } = cenario();
    const merged = mergeCloudStates(A, B, { now: NOW });

    const estudado = merged.eventos.find((e) => e.id === 'evA1');
    expect(estudado).toMatchObject({ rfBlocoId: 'b1', discId: 'dB', assId: 'assB1', status: 'estudei', tempoAcumulado: 3600 });
    expect(merged.eventos.find((e) => e.id === 'evB1')).toBeUndefined();
    expect(merged.planejamento.retaFinal.blocos.find((b) => b.id === 'b1').status).toBe('concluido');
  });

  it('descarta agendamentos e edital do plano antigo, sem duplicar, e mantém sessões manuais', () => {
    const { A, B } = cenario();
    const merged = mergeCloudStates(A, B, { now: NOW });

    expect(ids(merged.eventos)).toEqual(['evA1', 'evB2', 'manual']);
    expect(ids(merged.editais)).toEqual(['edB']);
  });

  it('deixa tombstones para que o aparelho antigo não traga nada de volta depois', () => {
    const { A, B } = cenario();
    const merged = mergeCloudStates(A, B, { now: NOW });
    const deadIds = merged.syncTombstones.map((t) => `${t.col}:${t.id}`).sort();

    expect(deadIds).toEqual(['editais:edA', 'eventos:evA2', 'eventos:evB1']);
    // O aparelho A, ainda com o estado antigo, mescla de novo com a nuvem.
    const again = mergeCloudStates(A, merged, { now: NOW });
    expect(ids(again.eventos)).toEqual(['evA1', 'evB2', 'manual']);
    expect(ids(again.editais)).toEqual(['edB']);
    expect(again.planejamento.planId).toBe('pB');
  });
});
