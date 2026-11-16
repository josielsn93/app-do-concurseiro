// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFeedUrl, runRadar } from '../../radar/run.mjs';

const NOW = new Date('2026-11-16T12:00:00Z');

const SOURCES = {
  trusted: { domains: ['.gov.br', '.jus.br'], names: ['Folha Dirigida'] },
  tracks: [
    { id: 'tjsp', label: 'TJ-SP', queries: ['"TJ-SP" concurso'] },
    { id: 'pmsp', label: 'Prefeitura de São Paulo', queries: ['Prefeitura de São Paulo concurso'] },
  ],
};

function feed(items) {
  return `<rss><channel>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate><source url="${i.url ?? 'https://s.example'}">${i.source ?? 'Folha Dirigida'}</source></item>`
    )
    .join('')}</channel></rss>`;
}

function xmlResponse(xml) {
  return { ok: true, status: 200, text: async () => xml };
}

const telegramOk = { ok: true, status: 200, json: async () => ({ ok: true }) };
const isTelegram = (url) => String(url).includes('api.telegram.org');

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
      if (isTelegram(url)) return telegramOk;
      if (decodeURIComponent(String(url)).includes('TJ-SP'))
        return xmlResponse(
          feed([
            { title: 'TJ-SP autoriza concurso com 500 vagas - Folha Dirigida', link: 'https://n/1' },
            { title: 'Gabarito do concurso do TJ-SP', link: 'https://n/2' },
          ])
        );
      return xmlResponse(feed([{ title: 'Prefeitura de São Paulo autoriza concurso', link: 'https://n/3' }]));
    });

    const summary = await runRadar({
      sources: SOURCES,
      fetchImpl,
      dataDir: dir,
      now: NOW,
      env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '9' },
      log: vi.fn(),
    });

    expect(summary.added).toBe(2);
    expect(summary.failedSources).toBe(0);
    expect(summary.telegramSent).toBeGreaterThan(0);
    const radar = JSON.parse(readFileSync(join(dir, 'radar.json'), 'utf8'));
    expect(radar.items.map((i) => i.title).sort()).toEqual([
      'Prefeitura de São Paulo autoriza concurso',
      'TJ-SP autoriza concurso com 500 vagas',
    ]);
    const telegramCall = fetchImpl.mock.calls.find(([u]) => isTelegram(u));
    expect(JSON.parse(telegramCall[1].body).text).toContain('TJ-SP autoriza concurso');
  });

  it('só aceita fonte confiável, estágio confirmado, notícia específica e cargo do perfil', async () => {
    const fetchImpl = vi.fn(async () =>
      xmlResponse(
        feed([
          { title: 'TJ-SP autoriza concurso para escrevente', link: 'https://n/ok' },
          { title: 'TJ-SP autoriza concurso para escrevente (blog)', link: 'https://n/blog', source: 'Blog Gran Cursos Online' },
          { title: 'Concurso TJ-SP: previsão de edital em 2027', link: 'https://n/prev' },
          { title: 'Concursos 2026: editais abertos e previstos', link: 'https://n/resumo' },
          { title: 'TJ-SP autoriza concurso para juiz', link: 'https://n/juiz' },
          { title: 'TJ-SP forma comissão do concurso', link: 'https://n/gov', source: 'Portal', url: 'https://www.tjsp.jus.br/x' },
        ])
      )
    );
    const summary = await runRadar({
      sources: { ...SOURCES, tracks: [SOURCES.tracks[0]] },
      fetchImpl,
      dataDir: dir,
      now: NOW,
      env: {},
      log: vi.fn(),
    });
    expect(summary.added).toBe(2);
    const radar = JSON.parse(readFileSync(join(dir, 'radar.json'), 'utf8'));
    expect(radar.items.map((i) => i.link).sort()).toEqual(['https://n/gov', 'https://n/ok']);
  });

  it('remove do radar anterior itens que não passam mais nos critérios', async () => {
    const old = (over) => ({
      id: over.id,
      track: 'tjsp',
      stage: 'autorizado',
      title: over.title,
      link: `https://n/${over.id}`,
      source: 'Folha Dirigida',
      publishedAt: '2026-11-10T00:00:00.000Z',
      firstSeen: '2026-11-09T12:00:00.000Z',
      ...over,
    });
    writeFileSync(
      join(dir, 'radar.json'),
      JSON.stringify({
        version: 1,
        generatedAt: '2026-11-09T12:00:00.000Z',
        items: [
          old({ id: 'a', title: 'TJ-SP autoriza concurso' }),
          old({ id: 'b', title: 'TJ-SP previsão de concurso', stage: 'previsto' }),
          old({ id: 'c', title: 'TJ-SP autoriza concurso (blog)', source: 'Blog Gran Cursos Online' }),
        ],
      })
    );
    const fetchImpl = vi.fn(async () => xmlResponse(feed([])));
    await runRadar({ sources: SOURCES, fetchImpl, dataDir: dir, now: NOW, env: {}, log: vi.fn() });
    const radar = JSON.parse(readFileSync(join(dir, 'radar.json'), 'utf8'));
    expect(radar.items.map((i) => i.id)).toEqual(['a']);
  });

  it('segunda execução não repete o que já foi enviado', async () => {
    const fetchImpl = vi.fn(async (url) =>
      isTelegram(url) ? telegramOk : xmlResponse(feed([{ title: 'TJ-SP autoriza concurso', link: 'https://n/1' }]))
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
    expect(fetchImpl.mock.calls.some(([u]) => isTelegram(u))).toBe(false);
  });

  it('segue com as demais fontes quando uma falha e conta as falhas', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (decodeURIComponent(String(url)).includes('TJ-SP')) throw new Error('timeout');
      return xmlResponse(feed([{ title: 'Prefeitura de São Paulo autoriza concurso', link: 'https://n/3' }]));
    });
    const summary = await runRadar({ sources: SOURCES, fetchImpl, dataDir: dir, now: NOW, env: {}, log: vi.fn() });
    expect(summary.failedSources).toBe(1);
    expect(summary.added).toBe(1);
  });

  it('quando todas as fontes falham, não apaga o radar anterior e avisa no Telegram', async () => {
    const ok = vi.fn(async (url) =>
      isTelegram(url) ? telegramOk : xmlResponse(feed([{ title: 'TJ-SP autoriza concurso', link: 'https://n/1' }]))
    );
    await runRadar({ sources: SOURCES, fetchImpl: ok, dataDir: dir, now: NOW, env: {}, log: vi.fn() });
    const before = readFileSync(join(dir, 'radar.json'), 'utf8');

    const bad = vi.fn(async (url) => {
      if (isTelegram(url)) return telegramOk;
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
    const alert = bad.mock.calls.find(([u]) => isTelegram(u));
    expect(JSON.parse(alert[1].body).text).toMatch(/falh/i);
  });
});

describe('runRadar: lembrete avulso', () => {
  const emptyFeed = async (url) => (isTelegram(url) ? telegramOk : xmlResponse(feed([])));
  const telegramBodies = (fetchImpl) =>
    fetchImpl.mock.calls.filter(([u]) => isTelegram(u)).map(([, init]) => JSON.parse(init.body).text);

  it('envia o lembrete como mensagem separada, depois do resumo', async () => {
    const fetchImpl = vi.fn(emptyFeed);
    const summary = await runRadar({
      sources: SOURCES,
      fetchImpl,
      dataDir: dir,
      now: NOW,
      env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '9', RADAR_LEMBRETE: 'Enviar os textos pendentes <agora>' },
      log: vi.fn(),
    });
    const bodies = telegramBodies(fetchImpl);
    const last = bodies[bodies.length - 1];
    expect(bodies.length).toBeGreaterThan(1);
    expect(last).toContain('Lembrete');
    expect(last).toContain('Enviar os textos pendentes &lt;agora&gt;');
    expect(bodies.slice(0, -1).some((b) => b.includes('Lembrete'))).toBe(false);
    expect(summary.telegramSent).toBe(bodies.length);
  });

  it('não envia lembrete quando a variável está ausente ou vazia', async () => {
    for (const lembrete of [undefined, '', '   ']) {
      const fetchImpl = vi.fn(emptyFeed);
      await runRadar({
        sources: SOURCES,
        fetchImpl,
        dataDir: dir,
        now: NOW,
        env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '9', RADAR_LEMBRETE: lembrete },
        log: vi.fn(),
      });
      expect(telegramBodies(fetchImpl).some((b) => b.includes('Lembrete'))).toBe(false);
    }
  });

  it('não tenta enviar lembrete sem Telegram configurado', async () => {
    const fetchImpl = vi.fn(emptyFeed);
    await runRadar({ sources: SOURCES, fetchImpl, dataDir: dir, now: NOW, env: { RADAR_LEMBRETE: 'x' }, log: vi.fn() });
    expect(telegramBodies(fetchImpl)).toEqual([]);
  });
});
