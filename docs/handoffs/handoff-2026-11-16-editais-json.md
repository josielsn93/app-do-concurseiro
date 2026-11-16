# Handoff — 2026-11-16 — JSONs de edital (TJ-SP e TRF3)

## Feito
- `docs/editais/edital-tjsp-escrevente-2026.json`: TJ-SP Escrevente (Edital 02/2026, Vunesp), 12 disciplinas / 69 tópicos.
- `docs/editais/edital-trf3-tecnico-suporte-tecnico-2026.json`: TRF3 Técnico Judiciário, Suporte Técnico, opção 007 (Edital 01/2026, Vunesp), 13 disciplinas / 88 tópicos (Anexo VI).
- Ambos validados com o importador do app (`validateEditalImportPayload` / `buildEditalImportPlan`), sem conflitos.
- Plano de estudos (Docs) atualizado: TRF3 vira simulado real em 31/01/2027 (semana 11); decisão do TJ-SP pendente.

## Estado
- TRF3: prova 31/01/2027; habilitação 12/24 gerais, 18/36 específicos, média ≥ 6,00, redação ≥ 5,00.
- TJ-SP: inscrição até 10/12/2026, prova 14/03/2027; vagas só no Interior (mais próxima: Jundiaí, ~3 h). Josi ainda decide se se inscreve.

## Próximos passos
- Josi importa o JSON do TRF3 no app (Edital > Importar).
- Se o TJ-SP for confirmado, manter o plano; se não, reaproveitar o tempo no TRF3/outros editais.
- Opcional: tela de datas/requisitos no app; mais veículos em `radar/sources.json` (`trusted.names`).

## Atualização — aulas nos JSONs
- Causa da Home sem "Próxima ação": `getNextSuggestedLesson` (src/js/logic/progress.js) olha só `aulas`; os JSONs tinham `aulas: []`.
- Correção: uma aula por tópico em ambos os JSONs; teste `tests/unit/editais-json.test.js` garante isso e a validação do importador.
- Agenda diária só existe com Planejamento ativo (Ciclo/Semanal/Reta Final); app usa um edital principal por vez (outros ficam arquivados).

## Atualização — calendário do planejamento e meta do ciclo
- Bug: `dispatcher.js` chamava `preventDefault()` no clique de qualquer `[data-action]`, inclusive `<input type="date">`, impedindo o seletor nativo. Agora campos date/time/datetime-local/month/week são ignorados no click (a ação roda no `change`).
- Meta de horas do Ciclo agora é opcional: `resolveCicloHoras` (src/js/planejamento/validation.js) = meta informada, ou dias ativos × matérias/dia × sessão máxima (h). Usado em `generatePlanejamento` e na validação do passo 4 (exige ao menos 1 dia ativo se a meta estiver vazia).
- Testes: actions-dispatcher, planejamento-validation. Suíte unit completa: 3067 passando.
