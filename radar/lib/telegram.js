export async function sendTelegram({ token, chatId, texts, fetchImpl = fetch }) {
  if (!token) throw new Error('Token do Telegram ausente');
  if (!chatId) throw new Error('Chat id do Telegram ausente');

  let sent = 0;
  for (const text of texts) {
    let res;
    try {
      res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
    } catch {
      throw new Error('Falha de rede ao chamar o Telegram');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`Telegram recusou a mensagem (HTTP ${res.status}): ${data.description ?? 'sem detalhe'}`);
    }
    sent += 1;
  }
  return sent;
}
