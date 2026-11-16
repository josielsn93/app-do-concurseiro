// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('nome do app', () => {
  it('index.html usa "App de estudos" no título e na marca lateral', () => {
    const html = read('src/index.html');
    expect(html).toContain('<title>App de estudos</title>');
    expect(html).toMatch(/logo-text">App de<br \/><span>estudos<\/span>/);
  });

  it('manifest usa "App de estudos"', () => {
    const manifest = JSON.parse(read('src/manifest.json'));
    expect(manifest.name).toBe('App de estudos');
    expect(manifest.short_name).toBe('App de estudos');
  });

  it.each(['src/index.html', 'src/manifest.json', 'src/js/components.js', 'src/js/ui/actions/config.js', 'src/js/views/config/data-management.js'])(
    '%s não tem mais "Estudo Organizado"',
    (file) => {
      expect(read(file)).not.toContain('Estudo Organizado');
    }
  );
});
