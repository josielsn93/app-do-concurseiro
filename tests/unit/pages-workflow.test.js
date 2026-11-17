import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const wf = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../.github/workflows/pages.yml'),
  'utf8'
);

describe('GitHub Pages workflow', () => {
  it('only publishes after the unit tests and the production build succeed', () => {
    const tests = wf.indexOf('vitest run');
    const build = wf.indexOf('npm run build');
    const upload = wf.indexOf('upload-pages-artifact');
    expect(tests).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(tests);
    expect(upload).toBeGreaterThan(build);
    expect(wf).toMatch(/needs: test-and-build/);
  });

  it('publishes the built dist/ folder, not the raw sources', () => {
    expect(wf).toMatch(/upload-pages-artifact@v3\s+with:\s+path: dist/);
    expect(wf).not.toMatch(/path: src\b/);
  });
});
