import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

let syncEngine;
let signInWithGoogle;
let dispatchEvent;

function statusEvents() {
  return dispatchEvent.mock.calls
    .map(([evt]) => evt)
    .filter((evt) => evt?.type === 'app:firestoreSyncStatus')
    .map((evt) => evt.detail.status);
}

beforeEach(async () => {
  vi.resetModules();

  dispatchEvent = vi.fn();
  global.document = {
    dispatchEvent,
    addEventListener: vi.fn(),
  };

  signInWithGoogle = vi.fn();

  const store = await import('../../src/js/store.js?v=8.37');
  store.setState(createBaseState());

  vi.doMock('../../src/js/store.js?v=8.37', async () => {
    const actual = await vi.importActual('../../src/js/store.js?v=8.37');
    return { ...actual, saveStateToDB: vi.fn(() => Promise.resolve()) };
  });

  vi.doMock('../../src/js/firebase/firebase-client.js?v=8.37', () => ({
    completeGoogleRedirectSignIn: vi.fn(() => Promise.resolve(null)),
    getFirebaseConfigStatus: vi.fn(() => ({ projectId: null, authDomain: null })),
    initFirebaseServices: vi.fn(() => ({ configured: false, db: null })),
    observeFirebaseAuth: vi.fn(() => {}),
    signInWithGoogle: (...args) => signInWithGoogle(...args),
    signOutFirebase: vi.fn(() => Promise.resolve()),
  }));

  syncEngine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.37');
});

afterEach(() => {
  vi.resetModules();
});

describe('firestoreSignIn cancellation handling', () => {
  it('emits "redirecting" when a full-page redirect was actually started', async () => {
    signInWithGoogle.mockResolvedValue(null);

    await expect(syncEngine.firestoreSignIn()).resolves.toBeNull();
    expect(statusEvents()).toContain('redirecting');
  });

  it('does not emit "redirecting" when the user cancelled the popup', async () => {
    signInWithGoogle.mockResolvedValue({ cancelled: true });

    await expect(syncEngine.firestoreSignIn()).resolves.toBeNull();
    expect(statusEvents()).not.toContain('redirecting');
  });
});

describe('firestoreSignIn activates sync on the device', () => {
  async function currentSync() {
    const store = await import('../../src/js/store.js?v=8.37');
    return store.state.config.firestoreSync;
  }

  it('turns primary sync on after a successful explicit sign-in', async () => {
    signInWithGoogle.mockResolvedValue({ user: { uid: 'u1' } });

    await syncEngine.firestoreSignIn();

    const sync = await currentSync();
    expect(sync.enabled).toBe(true);
    expect(sync.mode).toBe('primary');
  });

  it('keeps a mode the user already chose', async () => {
    signInWithGoogle.mockResolvedValue({ user: { uid: 'u1' } });
    await syncEngine.enableFirestoreSync('shadow');

    await syncEngine.firestoreSignIn();

    const sync = await currentSync();
    expect(sync.enabled).toBe(true);
    expect(sync.mode).toBe('shadow');
  });

  it('does not enable sync when the popup was cancelled', async () => {
    signInWithGoogle.mockResolvedValue({ cancelled: true });

    await syncEngine.firestoreSignIn();

    expect((await currentSync()).enabled).not.toBe(true);
  });
});
