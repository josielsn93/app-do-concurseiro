/**
 * Build de produção publicado no GitHub Pages.
 *
 * Por que existe: em produção o navegador carregava ~150 módulos com
 * versões de cache diferentes (import specifiers congelados em ?v=8.37 e a
 * página em ?v=9.xx). Depois de cada deploy a página nova rodava com JS/CSS
 * antigos do cache, e alguns módulos eram instanciados duas vezes (com e sem
 * ?v). Aqui o app vira um pacote JS e um CSS com o hash do conteúdo no nome:
 * um arquivo em cache nunca fica velho, e uma página nova sempre aponta para
 * os arquivos novos.
 *
 * Uso: node scripts/build-site.mjs [--out dist]
 * O desenvolvimento local e os testes continuam servindo src/ direto.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Classic scripts and data the page loads outside the module graph.
const COPY = [
  'index.html',
  'manifest.json',
  'assets',
  'js/sw-register.js',
  'js/firebase/firebase-runtime-config.js',
  'vendor/chart.umd.min.js',
];

// Order matters: it is the cascade order the page had with separate <link>s.
const STYLESHEETS = [
  'vendor/fontawesome/css/all.min.css',
  'css/fonts.css',
  'css/tokens.css',
  'css/base.css',
  'css/components.css',
  'css/views.css',
  'css/styles.css',
];

const stripVersionQuery = {
  name: 'strip-version-query',
  setup(b) {
    // `./x.js?v=8.37` and `./x.js` are the same module: resolve both to one file.
    b.onResolve({ filter: /\?v=[\w.-]+$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?v=[\w.-]+$/, '')),
    }));
  },
};

function copyInto(srcDir, outDir, rel) {
  const from = path.join(srcDir, rel);
  const to = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

function replaceOnce(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`build-site: ${label} não encontrado`);
  return text.replace(pattern, replacement);
}

export async function buildSite({
  srcDir = path.join(ROOT, 'src'),
  outDir = path.join(ROOT, 'dist'),
  quiet = false,
} = {}) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const rel of COPY) copyInto(srcDir, outDir, rel);

  const assetsDir = path.join(outDir, 'assets');
  const cssEntry = path.join(srcDir, '.build-styles.css');
  fs.writeFileSync(
    cssEntry,
    STYLESHEETS.map((rel) => `@import "./${rel}";`).join('\n') + '\n'
  );
  let result;
  try {
    result = await build({
      entryPoints: { app: path.join(srcDir, 'js/main.js'), 'app-styles': cssEntry },
      bundle: true,
      splitting: true,
      format: 'esm',
      target: 'es2020',
      minify: true,
      sourcemap: 'linked',
      outdir: assetsDir,
      entryNames: '[name]-[hash]',
      chunkNames: 'chunk-[hash]',
      assetNames: '[name]-[hash]',
      loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file', '.svg': 'file', '.png': 'file' },
      plugins: [stripVersionQuery],
      metafile: true,
      logLevel: quiet ? 'silent' : 'warning',
    });
  } finally {
    fs.rmSync(cssEntry, { force: true });
  }

  const outputs = Object.keys(result.metafile.outputs).map((p) => path.resolve(ROOT, p));
  const jsEntry = outputs.find((p) => /[/\\]app-[A-Z0-9]{8}\.js$/.test(p));
  const cssOut = outputs.find((p) => /[/\\]app-styles-[A-Z0-9]{8}\.css$/.test(p));
  if (!jsEntry || !cssOut) throw new Error('build-site: saída do esbuild incompleta');
  // One stylesheet named like the script, so the page links app-XXXX.css.
  const cssHash = cssOut.match(/-([A-Z0-9]{8})\.css$/)[1];
  const cssFinal = path.join(assetsDir, `app-${cssHash}.css`);
  fs.renameSync(cssOut, cssFinal);
  if (fs.existsSync(`${cssOut}.map`)) {
    fs.renameSync(`${cssOut}.map`, `${cssFinal}.map`);
    fs.writeFileSync(
      cssFinal,
      fs.readFileSync(cssFinal, 'utf8').replace(path.basename(`${cssOut}.map`), path.basename(`${cssFinal}.map`))
    );
  }
  // The CSS entry also emits an empty JS stub; drop it.
  for (const p of outputs) {
    if (/[/\\]app-styles-[A-Z0-9]{8}\.js(\.map)?$/.test(p)) fs.rmSync(p, { force: true });
  }

  const assetFiles = listFiles(assetsDir).filter((f) => !f.endsWith('.map'));
  const version = createHash('sha256')
    .update(assetFiles.sort().map((f) => fs.readFileSync(path.join(assetsDir, f))).join('\0'))
    .update(fs.readFileSync(path.join(srcDir, 'index.html')))
    .digest('hex')
    .slice(0, 10);

  // index.html: one stylesheet, one module script, classic scripts versioned by build.
  let html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const jsName = `assets/${path.basename(jsEntry)}`;
  const cssName = `assets/${path.basename(cssFinal)}`;
  html = html.replace(/\s*<link rel="stylesheet" href="[^"]+" \/>/g, '');
  html = replaceOnce(
    html,
    /(\s*)<script src="vendor\/chart\.umd\.min\.js/,
    `$1<link rel="stylesheet" href="${cssName}" />$1<script src="vendor/chart.umd.min.js`,
    'script do Chart.js'
  );
  html = replaceOnce(
    html,
    /<script type="module" src="js\/main\.js\?v=[^"]+"><\/script>/,
    `<script type="module" src="${jsName}"></script>`,
    'script principal'
  );
  html = html.replace(/\?v=\d+\.\d+/g, `?v=${version}`);
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  // Service worker: same code as src/sw.js, with the build's version and file list.
  const precache = [
    './',
    './index.html',
    './manifest.json',
    './js/sw-register.js',
    './js/firebase/firebase-runtime-config.js',
    './vendor/chart.umd.min.js',
    ...listFiles(path.join(outDir, 'assets'))
      .filter((f) => !f.endsWith('.map'))
      .map((f) => `./assets/${f.split(path.sep).join('/')}`),
  ];
  let sw = fs.readFileSync(path.join(srcDir, 'sw.js'), 'utf8');
  sw = replaceOnce(sw, /const APP_VERSION = '[^']+';/, `const APP_VERSION = '${version}';`, 'APP_VERSION');
  sw = replaceOnce(
    sw,
    /const ASSET_PATHS = \[[\s\S]*?\];/,
    `const ASSET_PATHS = ${JSON.stringify(precache, null, 2)};`,
    'ASSET_PATHS'
  );
  fs.writeFileSync(path.join(outDir, 'sw.js'), sw);

  if (!quiet) {
    const kb = (p) => Math.round(fs.statSync(p).size / 1024);
    console.log(`build ${version}: ${jsName} (${kb(jsEntry)} KB), ${cssName} (${kb(cssFinal)} KB), ${assetFiles.length} arquivos em assets/`);
  }
  return { version, js: jsName, css: cssName, precache };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf('--out');
  const outDir = outIndex > -1 ? path.resolve(process.argv[outIndex + 1]) : undefined;
  buildSite({ outDir }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
