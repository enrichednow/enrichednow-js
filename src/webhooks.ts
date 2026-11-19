import { WebhookVerificationError } from './errors';
import type { WebhookEvent, WebhookEventName } from './types';

/** Every event an endpoint can ask for: how a run ended. `run.succeeded` is the status `ok`. */
export const WEBHOOK_EVENTS: readonly WebhookEventName[] = [
  'run.succeeded',
  'run.partial',
  'run.failed',
  'run.unsupported',
  'run.cancelled',
];

/** Seconds a request's timestamp may be from now. */
export const DEFAULT_WEBHOOK_TOLERANCE = 300;

/** The body of a webhook request: the raw bytes as they arrived. A string is encoded as UTF-8. */
export type WebhookBody = string | Uint8Array | ArrayBuffer;

export interface WebhookVerifyOptions {
  /** Seconds the request's timestamp may be from now, either way. Default 300. */
  toleranceSeconds?: number | undefined;
}

/**
 * Whether a webhook request is one this API signed with `secret`, recently. Needs no client and makes no request.
 *
 * ```ts
 * const ok = verifyWebhook(
 *   process.env.ENRICHEDNOW_WEBHOOK_SECRET,
 *   req.headers['x-webhook-timestamp'],
 *   rawBody, // a Buffer of the bytes that arrived, before any JSON parsing
 *   req.headers['x-webhook-signature'],
 * );
 * ```
 *
 * The signature is `v1=` and the HMAC-SHA256, in hex, of the timestamp, a dot, and the body exactly as it arrived.
 * `false` when it does not match (compared in constant time), when anything is missing or malformed, and when the
 * timestamp is more than `toleranceSeconds` from now, so a recorded request cannot be played back later.
 *
 * Synchronous. It computes the HMAC with the runtime's own `node:crypto` where there is one (Node, Bun, Deno), and
 * with a bundled SHA-256 on an edge runtime, where the only HMAC is Web Crypto's, which is asynchronous: there, or
 * anywhere, {@link verifyWebhookAsync} uses Web Crypto instead. It never throws for what a request can carry: a
 * request that is not right is `false`.
 *
 * @param secret - The endpoint's signing secret (`whsec_…`); for a run's own `webhook_url`, the account's run secret.
 * @param timestamp - The `X-Webhook-Timestamp` header.
 * @param body - The request body as raw bytes (`Buffer`, `Uint8Array`, `ArrayBuffer`). A string is encoded as UTF-8.
 * @param signature - The `X-Webhook-Signature` header.
 */
export function verifyWebhook(
  secret: string,
  timestamp: string | number | null | undefined,
  body: WebhookBody,
  signature: string | null | undefined,
  options: WebhookVerifyOptions = {},
): boolean {
  const message = signedMessage(secret, timestamp, body, signature, options);
  if (message === undefined) return false;
  const key = encoder.encode(secret);
  const node = nodeCrypto();
  const expected = encoder.encode(`v1=${node ? node.createHmac('sha256', key).update(message).digest('hex') : hmacSha256Hex(key, message)}`);
  const given = encoder.encode(signature as string);
  if (expected.length !== given.length) return false;
  return node ? node.timingSafeEqual(expected, given) : timingSafeEqual(expected, given);
}

/**
 * {@link verifyWebhook}, with the HMAC of the platform's Web Crypto (`crypto.subtle`), which every runtime has: Node,
 * Bun, Deno, browsers and edge runtimes. Its comparison is Web Crypto's own, in constant time.
 *
 * ```ts
 * // a Cloudflare Worker, or a Next.js route on the edge runtime
 * const body = await request.arrayBuffer();
 * const ok = await verifyWebhookAsync(env.ENRICHEDNOW_WEBHOOK_SECRET, request.headers.get('x-webhook-timestamp'),
 *   body, request.headers.get('x-webhook-signature'));
 * ```
 */
export async function verifyWebhookAsync(
  secret: string,
  timestamp: string | number | null | undefined,
  body: WebhookBody,
  signature: string | null | undefined,
  options: WebhookVerifyOptions = {},
): Promise<boolean> {
  const message = signedMessage(secret, timestamp, body, signature, options);
  if (message === undefined) return false;
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) return verifyWebhook(secret, timestamp, body, signature, options);
  const hex = /^v1=([0-9a-f]{64})$/.exec(signature as string)?.[1];
  if (hex === undefined) return false;
  const digest = new Uint8Array(32);
  for (let i = 0; i < 32; i++) digest[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  try {
    const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await subtle.verify('HMAC', key, digest, message);
  } catch {
    return false;
  }
}

/** {@link parseWebhook}, verified with Web Crypto as {@link verifyWebhookAsync} is. */
export async function parseWebhookAsync<TInput = Record<string, unknown>>(
  secret: string,
  timestamp: string | number | null | undefined,
  body: WebhookBody,
  signature: string | null | undefined,
  options: WebhookVerifyOptions = {},
): Promise<WebhookEvent<TInput>> {
  if (!(await verifyWebhookAsync(secret, timestamp, body, signature, options))) throw notVerified();
  return eventOf<TInput>(body);
}

/** What was signed — the timestamp, a dot and the body — or `undefined` when the request cannot verify. */
function signedMessage(
  secret: unknown,
  timestamp: unknown,
  body: unknown,
  signature: unknown,
  options: WebhookVerifyOptions,
): Uint8Array<ArrayBuffer> | undefined {
  const tolerance = options.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE;
  if (typeof secret !== 'string' || secret === '' || typeof signature !== 'string') return undefined;
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') return undefined;
  const sent = String(timestamp);
  if (!/^[0-9]{1,16}$/.test(sent)) return undefined;
  if (!(Math.abs(Date.now() / 1000 - Number(sent)) <= tolerance)) return undefined;
  const raw = toBytes(body);
  if (raw === undefined) return undefined;
  const prefix = encoder.encode(`${sent}.`);
  const message = new Uint8Array(prefix.length + raw.length);
  message.set(prefix);
  message.set(raw, prefix.length);
  return message;
}

interface NodeCrypto {
  createHmac(algorithm: string, key: Uint8Array): { update(data: Uint8Array): { digest(encoding: 'hex'): string } };
  timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}

let nodeCryptoModule: NodeCrypto | null | undefined;

/**
 * The runtime's `node:crypto`, reached without an import (`process.getBuiltinModule`, Node 20.16 and later, Bun and
 * Deno), so that the package still loads, unbundled and untouched, where there is none; `undefined` there.
 */
function nodeCrypto(): NodeCrypto | undefined {
  if (nodeCryptoModule === undefined) {
    nodeCryptoModule = null;
    try {
      const scope = globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } };
      const found = scope.process?.getBuiltinModule?.('node:crypto') as Partial<NodeCrypto> | undefined;
      if (typeof found?.createHmac === 'function' && typeof found.timingSafeEqual === 'function') nodeCryptoModule = found as NodeCrypto;
    } catch {
      nodeCryptoModule = null;
    }
  }
  return nodeCryptoModule ?? undefined;
}

/**
 * Verify a webhook request as {@link verifyWebhook} does, and return the event it carries.
 *
 * Throws {@link WebhookVerificationError} when the request does not verify, or when what was signed is not an
 * event: answer `400` and do nothing with it.
 *
 * ```ts
 * const event = parseWebhook(secret, req.headers['x-webhook-timestamp'], rawBody, req.headers['x-webhook-signature']);
 * if (event.type === 'run.succeeded') {
 *   for await (const record of client.runs.records(event.data.run.id)) { ... }
 * }
 * ```
 *
 * @typeParam TInput - The shape of the run's input.
 */
export function parseWebhook<TInput = Record<string, unknown>>(
  secret: string,
  timestamp: string | number | null | undefined,
  body: WebhookBody,
  signature: string | null | undefined,
  options: WebhookVerifyOptions = {},
): WebhookEvent<TInput> {
  if (!verifyWebhook(secret, timestamp, body, signature, options)) throw notVerified();
  return eventOf<TInput>(body);
}

function notVerified(): WebhookVerificationError {
  return new WebhookVerificationError(
    'The webhook request did not verify: the signature does not match this secret, timestamp and body, ' +
      'or the timestamp is too far from now.',
  );
}

function eventOf<TInput>(body: WebhookBody): WebhookEvent<TInput> {
  let event: unknown;
  try {
    event = JSON.parse(typeof body === 'string' ? body : new TextDecoder('utf-8', { fatal: true }).decode(toBytes(body)));
  } catch (cause) {
    throw new WebhookVerificationError('The webhook request verified, but its body is not JSON.', { cause });
  }
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    throw new WebhookVerificationError('The webhook request verified, but its body is not an event.');
  }
  return event as WebhookEvent<TInput>;
}

const encoder = new TextEncoder();

function toBytes(body: unknown): Uint8Array | undefined {
  if (typeof body === 'string') return encoder.encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return undefined;
}

/** Equal or not, in time that depends on the lengths only, never on where the first difference is. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

// --- HMAC-SHA256 -------------------------------------------------------------------------------------------------------
// For `verifyWebhook` on a runtime without `node:crypto` (an edge runtime), where Web Crypto's HMAC is asynchronous
// and a synchronous function cannot wait for it (FIPS 180-4, RFC 2104). Everywhere else the runtime's own is used.
// The tests check it against Node's own, length by length.

const BLOCK = 64;

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

function sha256(data: Uint8Array): Uint8Array {
  const state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  // The message, a 1 bit, zeros up to 8 bytes short of a whole block, then the length in bits as 64 bits.
  const padded = new Uint8Array(Math.ceil((data.length + 9) / BLOCK) * BLOCK);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(data.length / 0x20000000));
  view.setUint32(padded.length - 4, (data.length << 3) >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += BLOCK) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]!;
      const y = w[i - 2]!;
      w[i] = w[i - 16]! + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[i - 7]! + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10));
    }
    let a = state[0]!;
    let b = state[1]!;
    let c = state[2]!;
    let d = state[3]!;
    let e = state[4]!;
    let f = state[5]!;
    let g = state[6]!;
    let h = state[7]!;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    state[0] = state[0]! + a;
    state[1] = state[1]! + b;
    state[2] = state[2]! + c;
    state[3] = state[3]! + d;
    state[4] = state[4]! + e;
    state[5] = state[5]! + f;
    state[6] = state[6]! + g;
    state[7] = state[7]! + h;
  }

  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i++) out.setUint32(i * 4, state[i]!);
  return digest;
}

/** HMAC-SHA256 of `message` under `key`, in lowercase hex. Exported for the tests; not part of the package's surface. */
export function hmacSha256Hex(key: Uint8Array, message: Uint8Array): string {
  const block = new Uint8Array(BLOCK);
  block.set(key.length > BLOCK ? sha256(key) : key);
  const inner = new Uint8Array(BLOCK + message.length);
  const outer = new Uint8Array(BLOCK + 32);
  for (let i = 0; i < BLOCK; i++) {
    inner[i] = block[i]! ^ 0x36;
    outer[i] = block[i]! ^ 0x5c;
  }
  inner.set(message, BLOCK);
  outer.set(sha256(inner), BLOCK);
  let hex = '';
  for (const byte of sha256(outer)) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
