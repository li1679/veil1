import { bytesToBinaryString } from './emailParserSource.js';

export function decodeTransferEncodingToBytes(body, transferEncoding) {
  if (!body) return new Uint8Array(0);
  const enc = transferEncoding.trim();
  if (enc === 'base64') return decodeBase64ToBytes(body);
  if (enc === 'quoted-printable') return decodeQuotedPrintableToBytes(body);
  return latin1StringToBytes(body);
}

function decodeBase64ToBytes(body) {
  try {
    const bin = atob(body.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (_) {
    return new TextEncoder().encode(body);
  }
}

function latin1StringToBytes(body) {
  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xFF;
  return bytes;
}

export function decodeBodyWithCharset(body, transferEncoding, contentType) {
  if (!body) return '';
  const match = /charset\s*=\s*"?([^";]+)/i.exec(contentType || '');
  const charset = (match?.[1] || '').trim() || 'utf-8';
  const rawBytes = decodeTransferEncodingToBytes(body, transferEncoding);
  return rawBytes.length ? decodeBytesWithCharset(rawBytes, charset) : '';
}

export function decodeQuotedPrintableToBytes(input) {
  return decodeQEncodingToBytes(String(input || '').replace(/=\r?\n/g, ''));
}

function decodeHeaderQToBytes(input) {
  return decodeQEncodingToBytes(String(input || '').replace(/_/g, ' '));
}

function decodeQEncodingToBytes(input) {
  const bytes = [];
  for (let i = 0; i < input.length; i++) {
    const decoded = tryReadHexByte(input, i);
    if (decoded) {
      bytes.push(decoded.value);
      i += 2;
    } else {
      bytes.push(input.charCodeAt(i) & 0xFF);
    }
  }
  return new Uint8Array(bytes);
}

function tryReadHexByte(input, index) {
  if (input[index] !== '=' || index + 2 >= input.length) return null;
  const hex = input.substring(index + 1, index + 3);
  return /^[0-9A-Fa-f]{2}$/.test(hex) ? { value: parseInt(hex, 16) } : null;
}

function normalizeCharset(charset) {
  const normalized = String(charset || '').trim().toLowerCase();
  if (!normalized) return 'utf-8';
  return CHARSET_ALIASES[normalized] || normalized;
}

const CHARSET_ALIASES = Object.freeze({
  utf8: 'utf-8',
  gbk: 'gb18030',
  gb2312: 'gb18030',
  'gb_2312': 'gb18030',
  gb18030: 'gb18030',
  'x-gbk': 'gb18030',
  'x-gb2312': 'gb18030',
  big5: 'big5',
  'big-5': 'big5',
  latin1: 'windows-1252',
  'iso-8859-1': 'windows-1252',
  'iso8859-1': 'windows-1252',
});

function buildCharsetCandidates(preferredCharset) {
  const preferred = normalizeCharset(preferredCharset);
  return Array.from(new Set([preferred, 'utf-8', 'gb18030', 'big5', 'windows-1252']));
}

function scoreDecodedText(text) {
  const value = String(text || '');
  return (value.match(/\uFFFD/g) || []).length * 100 + (value.match(/\u0000/g) || []).length * 10;
}

export function decodeBytesWithCharset(rawBytes, charset) {
  let best = { text: '', score: Number.POSITIVE_INFINITY };
  const preferred = normalizeCharset(charset);
  for (const candidate of buildCharsetCandidates(preferred)) {
    const decoded = tryDecodeBytes(rawBytes, candidate);
    if (!decoded) continue;
    const score = scoreDecodedText(decoded);
    if (score < best.score) best = { text: decoded, score };
    if (score === 0 && candidate === preferred) return decoded;
  }
  return best.text || bytesToBinaryString(rawBytes);
}

function tryDecodeBytes(rawBytes, charset) {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(rawBytes);
  } catch (_) {
    return '';
  }
}

export function decodeMimeHeader(value) {
  const input = String(value || '');
  if (!input.includes('=?')) return input;
  const compact = input.replace(/(\?=)\s+(=\?)/g, '$1$2');
  return compact.replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, decodeMimeHeaderToken);
}

function decodeMimeHeaderToken(_, charset, encoding, encodedText) {
  try {
    const rawBytes = String(encoding).toUpperCase() === 'B'
      ? decodeTransferEncodingToBytes(encodedText, 'base64')
      : decodeHeaderQToBytes(encodedText);
    return decodeBytesWithCharset(rawBytes, charset);
  } catch (_) {
    return encodedText;
  }
}
