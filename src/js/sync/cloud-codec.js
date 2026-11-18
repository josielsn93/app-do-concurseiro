/* global Response, TextEncoder, TextDecoder, CompressionStream, DecompressionStream */
/**
 * Formato do documento da nuvem (users/{uid}/estado/atual).
 *
 * O estado vai inteiro num só documento, compactado com gzip e em base64:
 * ~730 KB de JSON viram ~100 KB, longe do limite de 1 MiB do Firestore.
 * Sem CompressionStream (navegadores antigos), grava o JSON puro.
 */
import { DEVICE_CONFIG_KEYS, DEVICE_STATE_KEYS } from './cloud-merge.js';

export const CLOUD_DOC_VERSION = 1;
// Margem para os outros campos do documento dentro de 1 MiB.
export const CLOUD_DOC_MAX_CHARS = 1_000_000;

/** Cópia do estado sem o que pertence só a este aparelho. */
export function buildCloudPayload(state) {
  const payload = structuredClone(state || {});
  for (const key of DEVICE_STATE_KEYS) delete payload[key];
  if (payload.config && typeof payload.config === 'object') {
    for (const key of DEVICE_CONFIG_KEYS) delete payload.config[key];
  }
  return payload;
}

function hasCompression() {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

async function pipeBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * @param {object} payload resultado de buildCloudPayload
 * @param {{ deviceId: string, updatedAt: string, compression?: boolean }} meta
 */
export async function encodeCloudDoc(payload, { deviceId, updatedAt, compression = true } = {}) {
  const json = JSON.stringify(payload);
  let format = 'json';
  let data = json;
  if (compression && hasCompression()) {
    const gz = await pipeBytes(new TextEncoder().encode(json), new CompressionStream('gzip'));
    format = 'gzip-base64';
    data = toBase64(gz);
  }
  if (data.length > CLOUD_DOC_MAX_CHARS) {
    throw new Error(
      `O estado ficou grande demais para a nuvem (${Math.round(data.length / 1024)} KB). Exporte um backup e apague dados antigos.`
    );
  }
  return { v: CLOUD_DOC_VERSION, format, deviceId, updatedAt, rawBytes: json.length, data };
}

export async function decodeCloudDoc(doc) {
  if (!doc || typeof doc.data !== 'string') return null;
  if (doc.format === 'json') return JSON.parse(doc.data);
  if (doc.format === 'gzip-base64') {
    const bytes = await pipeBytes(fromBase64(doc.data), new DecompressionStream('gzip'));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  throw new Error(`Formato de documento desconhecido: ${doc.format}`);
}
