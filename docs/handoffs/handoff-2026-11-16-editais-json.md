# Handoff — 2026-11-16 — JSONs de edital (TJ-SP e TRF3)

## Feito
- `privado/editais/edital-tjsp-escrevente-2026.json`: TJ-SP Escrevente (Edital 02/2026, Vunesp), 12 disciplinas / 69 tópicos.
- `privado/editais/edital-trf3-tecnico-suporte-tecnico-2026.json`: TRF3 Técnico Judiciário, Suporte Técnico, opção 007 (Edital 01/2026, Vunesp), 13 disciplinas / 88 tópicos (Anexo VI).
- Ambos validados com o importador do app (`validateEditalImportPayload` / `buildEditalImportPlan`), sem conflitos.

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
- Solução sem mudar o app: o importador de cronograma (Reta Final) alimenta Home e calendário. Plano em `privado/cronogramas/` (gitignored), gerado por `privado/plano-tjsp/gen_plano.py`.
- (detalhes de conteúdo/estratégia removidos: material privado, ver `privado/estrategia/CEREBRO.md`, fora do git).
- Importar: apagar o edital TJ-SP antigo no app, importar o JSON do edital novo, depois Ciclo de Estudos > Importar Reta Final (JSON).
- Limites: orientações são textos estáticos (sem IA no app); links não incluídos de propósito (sem URLs específicas). Não testado na interface real (e2e indisponível). Falta: mesmo tipo de plano para o TRF3 se ele virar principal; avaliar tela de dados/requisitos do edital.

## Atualização: aulas aprofundadas + layout da aula (16/11/2026)

**Feito**
- Novo renderizador `src/js/ui/event-detail-view.js` (`renderLessonNotes`, `buildEventDetailHtml`): o modal do evento agora mostra a aula com seções semânticas (h3/h4, tabelas, listas, gabarito recolhível em `<details>`), responsivo (CSS ao final de `src/css/views.css`, classe `modal-lesson` em `index.html`). Usado por `openEventDetail` em `event-modals.js`. Não foi validado no app real (só em página de teste no Chrome headless).
- (detalhes de conteúdo/estratégia removidos: material privado, ver `privado/estrategia/CEREBRO.md`, fora do git).
- `privado/plano-tjsp/gen_plano.py` agora usa `conteudo/<SIGLA>-<idx>[-<idx>].md` como `notas` do bloco de teoria de 60 min quando o arquivo existe; senão mantém a nota curta (FOCO/COMO/FONTES).
- Testes: `tests/unit/event-detail-view.test.js` e bloco novo em `plano-tjsp-json.test.js` (seções, ≥4 questões A–E com gabarito, <10.000 caracteres).

**Falta**
- Escrever as aulas das demais disciplinas/semanas (sugestão: Direito Constitucional em seguida, depois Administrativo, Penal, Processo Civil/Penal etc.). Seguir o formato dos arquivos LP-*.md; nomes: sigla da disciplina (LP, DA, PP, PC, DC, LI, DP, RL, INF, MAT, ATU) + índices dos tópicos do bloco.
- Conferir o layout no navegador real e em celular.

**Como regenerar**: `python3 -I privado/plano-tjsp/gen_plano.py` (reescreve `privado/cronogramas/plano-tjsp-escrevente-2026.json` e o edital JSON), depois `npx vitest run tests/unit/plano-tjsp-json.test.js tests/unit/editais-json.test.js`.
**Reimportar no app**: Ciclo de Estudos > Importar Reta Final (JSON) com o plano novo (apague o plano anterior antes).


## Privacidade (16/11/2026)
- Estratégia, conteúdo de aula, planos e editais verticalizados agora ficam em `privado/` (gitignored). Teste `tests/unit/privacy-estrategia.test.js` impede versionar. Quem for continuar: ler `privado/estrategia/CEREBRO.md` (local, não vai ao GitHub) antes de criar plano/aula e atualizar o Registro de revisões. Se o arquivo não existir na sua máquina, peça ao Josi.

## Atualização técnica (16/11/2026, tarde)
- Gerador do plano (em `privado/`) agora produz só dias úteis; revisões 24h/7d/30d por assunto; testes em `tests/unit/plano-tjsp-json.test.js` (pulados se `privado/` não existir). Regenerar: `python3 -I privado/plano-tjsp/gen_plano.py`.
- Gerador (em `privado/`) passou a aceitar aulas de várias horas por assunto (`SIGLA-idx-pN.md`); testes novos em `tests/unit/plano-tjsp-json.test.js`. Suíte completa: 193 arquivos / 3115 testes verdes.


## Atualização técnica (sessão atual)
- Novo teste `tests/unit/conteudo-aulas-privado.test.js`: valida a estrutura (seções, 5 questões A–E com gabarito, tamanho) dos arquivos de aula listados por sigla; pulado quando `privado/` não existe.
- Por decisão do usuário, nenhum JSON é regenerado até todas as matérias terem aulas escritas; depois: rodar o gerador, testes e reimportar.
- Teste de conteúdo agora cobre as siglas PP e DA (30 arquivos). Gerador em `privado/` ajustado para unidades de 60 min em um dos blocos. Nenhum JSON regenerado; pendentes as demais matérias antes de regenerar.
- Teste de conteúdo agora cobre as siglas PP, PC e DA (61 testes, todos verdes). O gerador em `privado/` teve os slots de um dos blocos divididos em unidades de 60 min. Nenhum JSON regenerado. Pendente: demais matérias, depois regenerar, rodar suíte e reimportar.
- Teste de conteúdo estendido para DP (11 arquivos): 72 testes passando. Slots de 120 min de DP divididos em unidades de 60 min no gerador (sem regenerar JSON). Restam as demais disciplinas; só então regenerar, rodar a suíte e reimportar.
- Teste de conteúdo estendido para LI parcial (LI-00 e LI-02, 6 arquivos): 78 testes passando. Slots de 120 min de LI-0 e LI-2 divididos no gerador. LI-1, LI-3 e LI-4 pendentes (dependem de textos-fonte). Nenhum JSON regenerado.
- PENDENTE (técnico): faltam 13 arquivos de conteúdo de LI (LI-01, LI-03, LI-04), aguardando textos-fonte do usuário; ao receber, estender o teste de conteúdo, escrever os arquivos e dividir os slots de 120 min restantes no gerador.
- Radar: adicionado envio opcional de lembrete avulso (variável de repositório `RADAR_LEMBRETE`, mensagem separada após o resumo; 3 testes novos em `radar-run.test.js`; workflow repassa `vars.RADAR_LEMBRETE`). A variável precisa ser criada/apagada no GitHub; o texto não é versionado.
- Teste de conteúdo estendido para RL (4 arquivos): 82 testes passando. Slots de 120 min de RL divididos no gerador (sem regenerar JSON). Restam INF, MAT, ATU, RED e as pendências de LI.
- Teste de conteúdo estendido para INF (6 arquivos): 88 testes passando. Slot de 120 min de INF-0 dividido no gerador (sem regenerar JSON). Restam MAT, ATU, RED e as pendências de LI.
- Teste de conteúdo estendido para MAT (9 arquivos) e MATB (6 arquivos de base opcionais, não referenciados pelo gerador): 103 testes passando. Slots de 120 min de MAT divididos no gerador (sem regenerar JSON). Decisão pendente do usuário: se as aulas MATB entram no cronograma (exigiria alterar o gerador e a carga semanal). Restam ATU, RED e as pendências de LI.
- Teste `conteudo-aulas-privado` estendido (ATU: 3 arquivos; RED: 6 arquivos); 121/121 verdes nos testes de conteúdo e privacidade. Gerador local ajustado (divisão de slot de 120 min e carga de arquivo no bloco semanal). JSON ainda não regenerado, conforme ordem do usuário. Pendências: LI (textos), decisão sobre MATB, nota de questões da banca.
