# Handoff — Radar de concursos (2026-11-16)

## O que foi feito
- Branch `feat/radar-concursos`: módulo `radar/` (sem dependências), workflow `.github/workflows/radar-concursos.yml`, `.gitignore` liberando `/radar/`, documentação em `docs/radar-concursos.md`.
- Testes primeiro (TDD): `tests/unit/radar-{rss,classify,merge,message,telegram,run}.test.js` — 37 testes, verdes.
- Trilhas iniciais em `radar/sources.json`: TJ-SP, Justiça Federal/Trabalhista/Eleitoral (SP), Tribunais (nacional), TJs do Sul, TJ-MG, Prefeitura de SP, Polícia Civil SP, Educação.

## Estado atual
- Nunca rodou contra a internet real (o ambiente de desenvolvimento não alcança o Google News). A primeira execução real é a manual via `workflow_dispatch`.
- Telegram depende dos secrets `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`; sem eles o radar é gravado e nada é enviado.
- Nada do app (`src/`) foi alterado.

## O que falta
- Rodar o workflow manualmente e conferir o resumo recebido; ajustar queries e palavras-chave de `radar/lib/classify.js` conforme o ruído real.
- Fontes diretas: DOU, DOE-SP e páginas de notícias dos tribunais (hoje só Google News).
- Tela "Radar" no app lendo `radar.json` da branch `radar-data` (exige rota, navegação, bump de cache e testes de views).
- Importar o edital do TJ-SP (`edital-tjsp-escrevente-2026.json`) pela tela de editais do app.

## Próximos passos
1. Configurar o bot e os secrets (ver `docs/radar-concursos.md`).
2. Disparar o workflow e revisar a primeira mensagem.
3. Só então avançar para fontes diretas e para a tela no app.

## Atualização (v2, mesmo dia)
- Primeira execução real concluída com sucesso (resumo chegou no Telegram, 217 novidades por falta de histórico).
- Refinado a pedido do usuário: só estágios confirmados (autorizado, comissão, banca, edital), só fontes oficiais ou da lista `trusted` em `radar/sources.json`, sem resumos genéricos nem cargos fora do perfil, resumo com no máximo 3 itens por trilha separado em "Em preparação" e "Edital publicado".
- Trilha "Tribunais (nacional)" removida (trazia concursos de outros estados); adicionada consulta de TRF4/TRT-4 na trilha do Sul.
- Itens antigos do `radar.json` que não passam nos critérios novos são descartados na próxima execução.
- Pendente: avaliar se a lista de fontes confiáveis está restrita demais depois de uma semana real de envios.
