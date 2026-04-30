export function normalizeRawEmailSource(raw) {
  if (!raw) return '';
  if (raw instanceof Uint8Array) return bytesToBinaryString(raw);
  if (raw instanceof ArrayBuffer) return bytesToBinaryString(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) return bytesToBinaryString(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  return String(raw);
}

export function bytesToBinaryString(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return '';
  const chunkSize = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

export function splitHeadersAndBody(input) {
  const idx = input.indexOf('\r\n\r\n');
  const idx2 = idx === -1 ? input.indexOf('\n\n') : idx;
  const sep = idx !== -1 ? 4 : (idx2 !== -1 ? 2 : -1);
  if (sep === -1) return { headers: {}, body: input };
  const rawHeaders = input.slice(0, (idx !== -1 ? idx : idx2));
  const body = input.slice((idx !== -1 ? idx : idx2) + sep);
  return { headers: parseHeaders(rawHeaders), body };
}

function parseHeaders(rawHeaders) {
  const headers = {};
  const lines = rawHeaders.split(/\r?\n/);
  let lastKey = '';
  for (const line of lines) {
    if (/^\s/.test(line) && lastKey) {
      headers[lastKey] += ' ' + line.trim();
      continue;
    }
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      lastKey = match[1].toLowerCase();
      headers[lastKey] = match[2];
    }
  }
  return headers;
}

export function getBoundary(contentType) {
  if (!contentType) return '';
  const match = contentType.match(/boundary\s*=\s*"?([^";\r\n]+)"?/i);
  return match ? match[1].trim() : '';
}

export function splitMultipart(body, boundary) {
  const delim = '--' + boundary;
  const endDelim = delim + '--';
  const state = { parts: [], current: [], inPart: false };
  for (const rawLine of body.split(/\r?\n/)) processMultipartLine(state, rawLine, delim, endDelim);
  return state.parts;
}

function processMultipartLine(state, rawLine, delim, endDelim) {
  const line = rawLine.trimEnd();
  if (line.trim() === delim) {
    if (state.inPart && state.current.length) state.parts.push(state.current.join('\n'));
    state.current = [];
    state.inPart = true;
    return;
  }
  if (line.trim() === endDelim) {
    if (state.inPart && state.current.length) state.parts.push(state.current.join('\n'));
    state.inPart = false;
    return;
  }
  if (state.inPart) state.current.push(rawLine);
}

export function normalizeContentId(value) {
  return String(value || '').trim().replace(/^cid:/i, '').replace(/^<|>$/g, '').trim().toLowerCase();
}

export function getDispositionType(contentDisposition) {
  return String(contentDisposition || '').split(';')[0].trim().toLowerCase();
}

export function getMimeType(contentType) {
  const raw = String(contentType || '').trim();
  if (!raw) return 'application/octet-stream';
  return raw.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}
