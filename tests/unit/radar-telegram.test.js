// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { sendTelegram } from '../../radar/lib/telegram.js';

function okResponse() {
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
}

describe('sendTelegram', () => {
  it('envia cada texto como HTML sem pré-visualização de link', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const sent = await sendTelegram({ token: 'T0KEN', chatId: '42', texts: ['um', 'dois'], fetchImpl });
    expect(sent).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botT0KEN/sendMessage');
    expect(JSON.parse(init.body)).toEqual({
      chat_id: '42',
      text: 'um',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    expect(init.method).toBe('POST');
  });

  it('falha com a descrição do Telegram e sem vazar o token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });
    await expect(
      sendTelegram({ token: 'SECRET123', chatId: '1', texts: ['x'], fetchImpl })
    ).rejects.toThrow(/Unauthorized/);
    await sendTelegram({ token: 'SECRET123', chatId: '1', texts: ['x'], fetchImpl }).catch((e) => {
      expect(String(e.message)).not.toContain('SECRET123');
    });
  });

  it('exige token e chat id', async () => {
    await expect(sendTelegram({ token: '', chatId: '1', texts: ['x'], fetchImpl: vi.fn() })).rejects.toThrow(/token/i);
    await expect(sendTelegram({ token: 't', chatId: '', texts: ['x'], fetchImpl: vi.fn() })).rejects.toThrow(/chat/i);
  });
});
