# Radar de concursos

Coleta semanal de notícias sobre concursos (autorização, comissão, banca, edital) e envio de um resumo no Telegram.
Roda no GitHub Actions, sem depender de máquina local.

## Como funciona

1. `.github/workflows/radar-concursos.yml` roda toda segunda às 08:00 (Brasília) e também sob demanda (`Actions > Radar de concursos > Run workflow`).
2. `radar/run.mjs` consulta feeds RSS do Google News definidos em `radar/sources.json` (uma ou mais buscas por trilha).
3. `radar/lib/classify.js` descarta ruído (gabarito, resultado, convocação, curso preparatório) e classifica o estágio por palavras-chave: previsto, autorizado, comissão, banca, edital.
4. `radar/lib/merge.js` deduplica por título, preserva `firstSeen` e descarta itens com mais de 60 dias.
5. O `radar.json` atualizado é gravado na branch `radar-data` (não polui a `main`).
6. `radar/lib/message.js` monta o resumo (só o que é novo, por trilha) e `radar/lib/telegram.js` envia.

Se todas as fontes falharem, o radar anterior é mantido e um alerta curto vai ao Telegram.

## Configuração (uma vez)

1. No Telegram, converse com `@BotFather`, envie `/newbot` e guarde o token.
2. Envie qualquer mensagem ao bot e descubra o chat id (por exemplo, abrindo `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador e lendo `chat.id`).
3. No GitHub: `Settings > Secrets and variables > Actions > New repository secret`, criando `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.
4. Rode o workflow manualmente uma vez para validar.

Nunca coloque o token no código nem em conversa.

## Editar o que é monitorado

Edite `radar/sources.json`: cada trilha tem `id`, `label` e `queries` (sintaxe de busca do Google News: aspas, `OR`). Depois de editar, rode `npx vitest run tests/unit/radar-*.test.js`.

## Limites conhecidos

- A classificação por palavras-chave é heurística e pode errar o estágio; o resumo sempre traz o link da fonte.
- A fonte é o Google News; Diário Oficial (DOU/DOE-SP) e sites dos tribunais ainda não são consultados diretamente.
- O GitHub pode pausar workflows agendados após 60 dias sem atividade no repositório.

## Testes

`tests/unit/radar-*.test.js` (rss, classify, merge, message, telegram, run). Usam fixtures e fetch simulado; nenhuma chamada de rede.
