import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const src = (rel) => path.join(root, 'src', rel);
const html = fs.readFileSync(src('index.html'), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];

describe('icons and fonts are served by the app itself', () => {
  it('does not load icons or fonts from third-party CDNs', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toContain('cdnjs.cloudflare.com');
    expect(csp).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdnjs/);
  });

  it('links local Font Awesome and font files that exist', () => {
    expect(html).toContain('href="vendor/fontawesome/css/all.min.css');
    expect(html).toContain('href="css/fonts.css');
    const fa = fs.readFileSync(src('vendor/fontawesome/css/all.min.css'), 'utf8');
    for (const [, ref] of fa.matchAll(/url\(([^)]+)\)/g)) {
      expect(fs.existsSync(path.join(src('vendor/fontawesome/css'), ref.replace(/["']/g, '')))).toBe(true);
    }
    const fonts = fs.readFileSync(src('css/fonts.css'), 'utf8');
    expect(fonts).toContain("font-family: 'Plus Jakarta Sans'");
    expect(fonts).toContain("font-family: 'DM Mono'");
    for (const [, ref] of fonts.matchAll(/url\(([^)]+)\)/g)) {
      expect(fs.existsSync(path.join(src('css'), ref.replace(/["']/g, '')))).toBe(true);
    }
  });
});
