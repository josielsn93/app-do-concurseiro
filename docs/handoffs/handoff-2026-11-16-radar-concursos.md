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
