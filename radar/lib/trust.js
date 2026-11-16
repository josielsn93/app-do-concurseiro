function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Fonte oficial (por domínio) ou veículo da lista de confiáveis (por nome, em palavras inteiras). */
export function isTrusted({ source, sourceUrl }, trusted = {}) {
  const host = hostOf(sourceUrl);
  if (host) {
    for (const entry of trusted.domains ?? []) {
      const dom = String(entry).toLowerCase();
      const bare = dom.replace(/^\./, '');
      if (host === bare || host.endsWith(`.${bare}`)) return true;
    }
  }
  const name = norm(source);
  if (!name) return false;
  return (trusted.names ?? []).some((entry) => {
    const wanted = norm(entry);
    return wanted && new RegExp(`(^| )${wanted}( |$)`).test(name);
  });
}
