// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFeedUrl, runRadar } from '../../radar/run.mjs';

const NOW = new Date('2026-11-16T12:00:00Z');

const SOURCES = {
  tracks: [
    { id: 'tjsp', label: 'TJ-SP', queries: ['"TJ-SP" concurso'] },
    { id: 'pmsp', label: 'Prefeitura de São Paulo', queries: ['Prefeitura de São Paulo concurso'] },
  ],
};

function feed(items) {
  return `<rss><channel>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate><source url="https://s">${i.source ?? 'Fonte'}</source></item>`
    )
    .join('')}</channel></rss>`;
}

function xmlResponse(xml) {
  return { ok: true, status: 200, text: async () => xml };
}

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'radar-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('buildFeedUrl', () => {
  it('monta a URL do Google News com janela de dias e idioma pt-BR', () => {
    const url = buildFeedUrl('"TJ-SP" concurso', 21);
    expect(url).toContain('https://news.google.com/rss/search?q=');
    expect(decodeURIComponent(url)).toContain('"TJ-SP" concurso when:21d');
    expect(url).toContain('hl=pt-BR');
    expect(url).toContain('gl=BR');
  });
});

describe('runRadar', () => {
  it('coleta, classifica, grava radar.json e envia o resumo pelo Telegram', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('api.telegram.org')) return { ok: true, status: 200, json: async () => ({ ok: true }) };
      if (decodeURIComponent(String(url)).includes('TJ-SP'))
        return xmlResponse(
          feed([
            { title: 'TJ-SP autoriza concurso com 500 vagas - Folha', link: 'https://n/1', source: 'Folha' },
            { title: 'Gabarito do concurso do TJ-SP', link: 'https://n/2' },
          ])
        );
      return xmlResponse(feed([{ title: 'Prefeitura de São Paulo prevê concurso', link: 'https://n/3' }]));
    });
    const log = vi.fn();

    const summary = await runRadar({
      sources: SOURCES,
      fetchImpl,
      dataDir: dir,
      now: NOW,
      env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '9' },
      log,
    });

    expect(summary.added).toBe(2);
    expect(summary.failedSources).toBe(0);
    expect(summary.telegramSent).toBeGreaterThan(0);
    const radar = JSON.parse(readFileSync(join(dir, 'radar.json'), 'utf8'));
    expect(radar.items.map((i) => i.title).sort()).toEqual([
      'Prefeitura de São Paulo prevê concurso',
      'TJ-SP autoriza concurso com 500 vagas',
    ]);
    const telegramCall = fetchImpl.mock.calls.find(([u]) => String(u).includes('api.telegram.org'));
    expect(JSON.parse(telegramCall[1].body).text).toContain('TJ-SP autoriza concurso');
  });

  it('segunda execução não repete o que já foi enviado', async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).includes('api.telegram.org')
        ? { ok: true, status: 200, json: async () => ({ ok: true }) }
        : xmlResponse(feed([{ title: 'TJ-SP autoriza concurso', link: 'https://n/1' }]))
    );
    const base = { sources: SOURCES, fetchImpl, dataDir: dir, env: {}, log: vi.fn() };
    const first = await runRadar({ ...base, now: NOW });
    const second = await runRadar({ ...base, now: new Date('2026-11-23T12:00:00Z') });
    expect(first.added).toBe(1);
    expect(second.added).toBe(0);
  });

  it('sem credenciais do Telegram, grava o radar e não tenta enviar', async () => {
    const fetchImpl = vi.fn(async () => xmlResponse(feed([{ title: 'TJ-SP autoriza concurso', link: 'https://n/1' }])));
    const summary = await runRadar({ sources: SOURCES, fetchImpl, dataDir: dir, now: NOW, env: {}, log: vi.fn() });
    expect(summary.telegramSent).toBe(0);
    expect(existsSync(join(dir, 'radar.json'))).toBe(true);
    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('api.telegram.org'))).toBe(false);
  });

  it('segue com as demais fontes quando uma falha e conta as falhas', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (decodeURIComponent(String(url)).includes('TJ-SP')) throw new Error('timeout');
      return xmlResponse(feed([{ title: 'Prefeitura de São Paulo prevê concurso', link: 'https://n/3' }]));
    });
    const summary = await runRadar({ sources: SOURCES, fetchImpl, dataDir: dir, now: NOW, env: {}, log: vi.fn() });
    expect(summary.failedSources).toBe(1);
    expect(summary.added).toBe(1);
  });

  it('quando todas as fontes falham, não apaga o radar anterior e avisa no Telegram', async () => {
    const ok = vi.fn(async (url) =>
      String(url).includes('api.telegram.org')
        ? { ok: true, status: 200, json: async () => ({ ok: true }) }
        : xmlResponse(feed([{ title: 'TJ-SP autoriza concurso', link: 'https://n/1' }]))
    );
    await runRadar({ sources: SOURCES, fetchImpl: ok, dataDir: dir, now: NOW, env: {}, log: vi.fn() });
    const before = readFileSync(join(dir, 'radar.json'), 'utf8');

    const bad = vi.fn(async (url) => {
      if (String(url).includes('api.telegram.org')) return { ok: true, status: 200, json: async () => ({ ok: true }) };
      throw new Error('offline');
    });
    await expect(
      runRadar({
        sources: SOURCES,
        fetchImpl: bad,
        dataDir: dir,
        now: new Date('2026-11-23T12:00:00Z'),
        env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '9' },
        log: vi.fn(),
      })
    ).rejects.toThrow(/todas as fontes/i);
    expect(readFileSync(join(dir, 'radar.json'), 'utf8')).toBe(before);
    const alert = bad.mock.calls.find(([u]) => String(u).includes('api.telegram.org'));
    expect(JSON.parse(alert[1].body).text).toMatch(/falh/i);
  });
});
