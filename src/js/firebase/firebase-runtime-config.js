// Hosts que servem /__/auth/* pelo proxy do Cloudflare Worker (worker/index.js).
// Neles o authDomain passa a ser o proprio origin do app, para que o
// signInWithRedirect nao dependa de storage de terceiros — ver issue #99.
// Lista explicita de proposito: um host novo so entra aqui depois de ser
// adicionado aos Authorized domains do Firebase Authentication.
const PROXIED_AUTH_HOSTS = ['estudo-organizado.matheussilva421.workers.dev'];
const FALLBACK_AUTH_DOMAIN = 'app-do-concurseiro.firebaseapp.com';

window.ESTUDO_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBRGA_4pou3dy7t77sDsxpxRJ1uGcZ1VvE',
  authDomain: PROXIED_AUTH_HOSTS.includes(window.location.hostname)
    ? window.location.hostname
    : FALLBACK_AUTH_DOMAIN,
  projectId: 'app-do-concurseiro',
  storageBucket: 'app-do-concurseiro.firebasestorage.app',
  messagingSenderId: '615981664873',
  appId: '1:615981664873:web:e3f183eacfd7ae3cdbb0f8',
};

window.ESTUDO_APP_CHECK_SITE_KEY = '';
