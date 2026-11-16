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

## Atualização — plano dia a dia (instrutor)
- Pedido: ao subir o JSON, o app devia gerar plano com o que estudar cada dia, orientação, questões, revisão e simulados.
- Solução sem mudar o app: o importador de cronograma (Reta Final, formato `dias[].blocos[]` com `notas`) já alimenta Home ("Próxima ação") e calendário. Gerado `docs/cronogramas/plano-tjsp-escrevente-2026.json` (17 semanas, 16/11/2026 a 14/03/2027, 119 dias, 314 blocos, horas por semana conforme o plano do Docs) por `gen_plano.py` (fora do repo, em /home/claude/work; regenerar se mudar o plano).
- Edital TJ-SP JSON ganhou: tópico "Questões da banca Vunesp" em cada matéria (exceto Redação) e a disciplina "Simulados e Revisão" (diagnóstico, simulados 1–4, prova TRF3, revisão de erros etc.). O plano referencia só nomes que existem no edital (teste `tests/unit/plano-tjsp-json.test.js`).
- Importar: apagar o edital TJ-SP antigo no app, importar o JSON do edital novo, depois Ciclo de Estudos > Importar Reta Final (JSON).
- Limites: orientações são textos estáticos (sem IA no app); links não incluídos de propósito (sem URLs específicas). Não testado na interface real (e2e indisponível). Falta: mesmo tipo de plano para o TRF3 se ele virar principal; avaliar tela de dados/requisitos do edital.

## Atualização: aulas aprofundadas + layout da aula (16/11/2026)

**Feito**
- Novo renderizador `src/js/ui/event-detail-view.js` (`renderLessonNotes`, `buildEventDetailHtml`): o modal do evento agora mostra a aula com seções semânticas (h3/h4, tabelas, listas, gabarito recolhível em `<details>`), responsivo (CSS ao final de `src/css/views.css`, classe `modal-lesson` em `index.html`). Usado por `openEventDetail` em `event-modals.js`. Não foi validado no app real (só em página de teste no Chrome headless).
- Aulas completas de 1 hora (objetivo, roteiro minuto a minuto, teoria, como a Vunesp cobra, pegadinhas, 5 questões com gabarito comentado, caderno de erros) em `docs/plano-tjsp/conteudo/LP-*.md` — Língua Portuguesa, semanas 1 e 2 (dias 16/11 a 26/11).
- `docs/plano-tjsp/gen_plano.py` agora usa `conteudo/<SIGLA>-<idx>[-<idx>].md` como `notas` do bloco de teoria de 60 min quando o arquivo existe; senão mantém a nota curta (FOCO/COMO/FONTES).
- Testes: `tests/unit/event-detail-view.test.js` e bloco novo em `plano-tjsp-json.test.js` (seções, ≥4 questões A–E com gabarito, <10.000 caracteres).

**Falta**
- Escrever as aulas das demais disciplinas/semanas (sugestão: Direito Constitucional em seguida, depois Administrativo, Penal, Processo Civil/Penal etc.). Seguir o formato dos arquivos LP-*.md; nomes: sigla da disciplina (LP, DA, PP, PC, DC, LI, DP, RL, INF, MAT, ATU) + índices dos tópicos do bloco.
- Conferir o layout no navegador real e em celular.

**Como regenerar**: `python3 -I docs/plano-tjsp/gen_plano.py` (reescreve `docs/cronogramas/plano-tjsp-escrevente-2026.json` e o edital JSON), depois `npx vitest run tests/unit/plano-tjsp-json.test.js tests/unit/editais-json.test.js`.
**Reimportar no app**: Ciclo de Estudos > Importar Reta Final (JSON) com o plano novo (apague o plano anterior antes).
