// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSite } from '../../scripts/build-site.mjs';

const root = path.resolve(import.meta.dirname, '../..');
let outDir;
let result;
let html;
let sw;

const read = (rel) => fs.readFileSync(path.join(outDir, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(outDir, rel.replace(/^\.\//, '').split('?')[0]));

beforeAll(async () => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-site-'));
  result = await buildSite({ srcDir: path.join(root, 'src'), outDir, quiet: true });
  html = read('index.html');
  sw = read('sw.js');
}, 120_000);

describe('production build', () => {
  it('loads the whole app from one content-hashed script and one stylesheet', () => {
    const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
    const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);

    expect(scripts).toEqual([expect.stringMatching(/^assets\/app-[A-Z0-9]{8}\.js$/)]);
    expect(styles).toEqual([expect.stringMatching(/^assets\/app-[A-Z0-9]{8}\.css$/)]);
    expect(exists(scripts[0])).toBe(true);
    expect(exists(styles[0])).toBe(true);
    expect(html).not.toContain('js/main.js');
    expect(html).not.toContain('css/tokens.css');
  });

  it('resolves frozen ?v= import specifiers into a single module graph', () => {
    const assets = fs.readdirSync(path.join(outDir, 'assets')).filter((f) => f.endsWith('.js'));
    for (const file of assets) {
      expect(read(`assets/${file}`)).not.toMatch(/\.js\?v=\d/);
    }
  });

  it('keeps the CSS cascade order and every file the stylesheet points to', () => {
    const css = read(html.match(/href="(assets\/app-[A-Z0-9]{8}\.css)"/)[1]);
    expect(css.indexOf(':root')).toBeGreaterThan(-1);
    expect(css.indexOf(':root')).toBeLessThan(css.indexOf('.nav-item'));
    for (const [, ref] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (/^(data:|https?:|#)/.test(ref)) continue;
      expect(exists(path.join('assets', ref))).toBe(true);
    }
  });

  it('versions the service worker with the build and precaches exactly what exists', () => {
    const version = sw.match(/const APP_VERSION = '([^']+)'/)[1];
    expect(version).toBe(result.version);
    expect(html).toContain(`js/sw-register.js?v=${version}`);

    const list = JSON.parse(sw.match(/const ASSET_PATHS = (\[[\s\S]*?\]);/)[1]);
    const assets = fs
      .readdirSync(path.join(outDir, 'assets'), { recursive: true })
      .filter((f) => fs.statSync(path.join(outDir, 'assets', f)).isFile())
      .map((f) => `./assets/${f.split(path.sep).join('/')}`);
    for (const asset of assets.filter((a) => !a.endsWith('.map'))) {
      expect(list).toContain(asset);
    }
    for (const entry of list.filter((p) => p !== './')) {
      expect(exists(entry)).toBe(true);
    }
    expect(list.some((p) => p.startsWith('./js/views/'))).toBe(false);
  });

  it('ships no source modules, dev lab or tooling', () => {
    expect(exists('lab')).toBe(false);
    expect(exists('js/main.js')).toBe(false);
    expect(exists('css/tokens.css')).toBe(false);
    expect(exists('js/firebase/firebase-runtime-config.js')).toBe(true);
    expect(exists('manifest.json')).toBe(true);
  });
});
