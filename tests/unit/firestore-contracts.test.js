import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Firestore integration contracts', () => {
  it('keeps Firebase config explicit and runtime-overridable', () => {
    const configSource = read('src/js/firebase/firebase-config-default.js');

    expect(configSource).toContain('FIREBASE_CONFIG');
    expect(configSource).toContain("apiKey: ''");
    expect(configSource).toContain("projectId: ''");
    expect(configSource).toContain('window.ESTUDO_FIREBASE_CONFIG');
    expect(configSource).toContain('window.ESTUDO_APP_CHECK_SITE_KEY');
  });

  it('keeps local Firebase credentials out of tracked files', () => {
    const tracked = execFileSync('git', ['ls-files', 'src/js/firebase/firebase-config.js'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(tracked.trim()).toBe('');
  });

  it('falls back to Firebase Auth redirect when popup login is blocked', () => {
    const clientSource = read('src/js/firebase/firebase-client.js');
    const bundleEntry = read('scripts/firebase-bundle-entry.js');

    expect(bundleEntry).toContain('getRedirectResult');
    expect(bundleEntry).toContain('signInWithRedirect');
    expect(clientSource).toContain('POPUP_FALLBACK_CODES');
    expect(clientSource).toContain("'auth/popup-blocked'");
    expect(clientSource).toContain('signInWithRedirect(auth, provider)');
    expect(clientSource).toContain('completeGoogleRedirectSignIn');
  });

  it('never redirects the whole page when the user closes the popup', () => {
    const clientSource = read('src/js/firebase/firebase-client.js');
    const fallbackBlock = clientSource.slice(
      clientSource.indexOf('POPUP_FALLBACK_CODES'),
      clientSource.indexOf(']', clientSource.indexOf('POPUP_FALLBACK_CODES'))
    );

    expect(fallbackBlock).not.toContain('auth/popup-closed-by-user');
    expect(clientSource).toContain('POPUP_CANCEL_CODES');
  });

  it('serves the Firebase auth handler from the app origin and keeps it out of the SW', () => {
    const workerSource = read('worker/index.js');
    const swSource = read('src/sw.js');
    const runtimeConfigSource = read('src/js/firebase/firebase-runtime-config.js');

    expect(workerSource).toContain('app-do-concurseiro.firebaseapp.com');
    expect(workerSource).toContain("RESERVED_PREFIX = '/__/'");
    expect(workerSource).toContain('startsWith(RESERVED_PREFIX)');
    expect(workerSource).toContain("redirect: 'manual'");
    expect(swSource).toContain("startsWith('/__/')");
    expect(runtimeConfigSource).toContain('PROXIED_AUTH_HOSTS');
  });

  it('caches all runtime Firestore modules in the service worker shell', () => {
    const swSource = read('src/sw.js');

    expect(swSource).toContain('./js/firebase/firebase-client.js');
    expect(swSource).toContain('./js/firebase/firebase-config-default.js');
    expect(swSource).toContain('./js/sync/nuvem.js');
    expect(swSource).toContain('./js/sync/nuvem-sync.js');
    expect(swSource).toContain('./js/sync/cloud-merge.js');
    expect(swSource).toContain('./js/sync/cloud-codec.js');
    expect(swSource).toContain('./js/sync/nuvem-status-ui.js');
    expect(swSource).toContain('./js/views/config/conta-sync.js');
    expect(swSource).toContain('./vendor/firebase-client.bundle.js');
    expect(swSource).toMatch(/APP_VERSION = '\d+\.\d{2}'/);
  });

  it('precaches only files that exist in the source tree', () => {
    const swSource = read('src/sw.js');
    const list = swSource.match(/const ASSET_PATHS = \[([\s\S]*?)\];/)[1];
    const missing = [...list.matchAll(/'\.\/([^']+)'/g)]
      .map((m) => m[1])
      .filter((rel) => rel && !fs.existsSync(path.join(root, 'src', rel)));
    expect(missing).toEqual([]);
  });

  it('pre-caches modules that are imported by the modular app shell', () => {
    const swSource = read('src/sw.js');

    [
      './js/ui/search.js',
      './js/ui/event-modals.js',
      './js/ui/actions/config.js',
      './js/views/config-view.js',
      './js/views/revisao-view.js',
      './js/state/chart-state.js',
    ].forEach((asset) => expect(swSource).toContain(asset));
  });

  it('allows the Firebase Auth and Firestore network surfaces in CSP', () => {
    const html = read('src/index.html');
    const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] || '';
    const scriptSrc = csp.match(/script-src\s+([^;]+)/i)?.[1] || '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/i)?.[1] || '';
    const frameSrc = csp.match(/frame-src\s+([^;]+)/i)?.[1] || '';

    expect(scriptSrc).toContain('https://www.google.com');
    expect(scriptSrc).toContain('https://www.gstatic.com');
    expect(connectSrc).toContain('https://identitytoolkit.googleapis.com');
    expect(connectSrc).toContain('https://securetoken.googleapis.com');
    expect(connectSrc).toContain('https://firestore.googleapis.com');
    expect(connectSrc).toContain('https://content-firebaseappcheck.googleapis.com');
    expect(frameSrc).toContain('https://accounts.google.com');
    expect(frameSrc).toContain('https://app-do-concurseiro.firebaseapp.com');
  });

  it('keeps Firestore rules owner-scoped and denies physical deletes', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('request.auth.uid == uid');
    expect(rules).toContain('allow delete: if false;');
    expect(rules).not.toMatch(/retaFinalSync|syncMeta|entities/);
  });

  it('keeps the synced study state in one validated, size-capped document', () => {
    const rules = read('firestore.rules');
    const block = rules.slice(rules.indexOf('match /users/{uid}/estado/{docId}'), rules.indexOf('match /users/{uid}/snapshots'));

    expect(block).toContain("allow read: if owns(uid) && docId == 'atual'");
    expect(block).toContain("hasOnly(['v', 'format', 'deviceId', 'updatedAt', 'rawBytes', 'data'])");
    expect(block).toContain("format in ['gzip-base64', 'json']");
    expect(block).toMatch(/data\.data\.size\(\) <= 1000000/);
    expect(block).toContain('allow delete: if false;');
  });

  it('keeps the old snapshot readable only, for the one-time migration', () => {
    const rules = read('firestore.rules');
    const block = rules.slice(rules.indexOf('match /users/{uid}/snapshots/{snapshotId}'), rules.indexOf('match /users/{uid}/aulas'));

    expect(block).toContain('allow read: if owns(uid);');
    expect(block).toContain('allow write: if false;');
  });

  it('only lets the app owner account read or write anything', () => {
    const rules = read('firestore.rules');
    const owns = rules.match(/function owns\(uid\) \{([\s\S]*?)\}/)?.[1] || '';

    expect(rules).toMatch(/function isAppOwner\(\) \{\s*return signedIn\(\) && request\.auth\.uid == 'tSPFagkJtBRaMm332MY5KujyKZw1';/);
    expect(owns).toContain('isAppOwner()');
    expect(owns).toContain('request.auth.uid == uid');
  });

});

describe('Regras para as aulas (users/{uid}/aulas)', () => {
  const rules = () => read('firestore.rules');
  const bloco = () => {
    const text = rules();
    const start = text.indexOf('match /users/{uid}/aulas/{aulaId}');
    expect(start, 'bloco de aulas existe').toBeGreaterThan(-1);
    return text.slice(start, text.indexOf('match /{document=**}', start));
  };

  it('só o dono lê e grava as próprias aulas', () => {
    const b = bloco();
    expect(b).toMatch(/allow read: if owns\(uid\)/);
    expect(b).toMatch(/allow create, update: if owns\(uid\)/);
  });

  it('valida formato do id, campos e tamanho do texto', () => {
    const b = bloco();
    expect(b).toContain("aulaId.matches('a_[0-9a-f]+_[0-9]+')");
    expect(b).toContain("hasOnly(['version', 'text', 'updatedAt'])");
    expect(b).toMatch(/text\.size\(\) <= \d+/);
  });

  it('não permite apagar e mantém a negação padrão ao final', () => {
    const b = bloco();
    expect(b).toMatch(/allow delete: if false/);
    const text = rules();
    expect(text.indexOf('users/{uid}/aulas')).toBeLessThan(text.indexOf('match /{document=**}'));
  });
});
