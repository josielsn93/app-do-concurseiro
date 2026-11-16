// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../../src/manifest.json', import.meta.url), 'utf8'));

describe('manifest.json em subcaminho (GitHub Pages)', () => {
  it('usa id e escopo relativos para funcionar fora da raiz do domínio', () => {
    expect(manifest.id).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('mantém start_url e ícones relativos', () => {
    expect(manifest.start_url.startsWith('/')).toBe(false);
    for (const icon of manifest.icons ?? []) expect(icon.src.startsWith('/')).toBe(false);
  });
});
