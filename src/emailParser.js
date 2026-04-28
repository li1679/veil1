import { extractCode } from '../public/js/verification-code.js';

/**
 * 解析邮件正文，提取文本和HTML内容
 * @param {string} raw - 原始邮件内容
 * @returns {object} 包含text和html属性的对象
 */
export function parseEmailBody(raw) {
  const source = normalizeRawEmailSource(raw);
  if (!source) return { text: '', html: '' };
  const { headers: topHeaders, body: topBody } = splitHeadersAndBody(source);
  return parseEntity(topHeaders, topBody);
}

export function parseEmailMessage(raw) {
  const source = normalizeRawEmailSource(raw);
  if (!source) {
    return { headers: {}, subject: '', from: '', to: '', text: '', html: '', inlineAttachments: [] };
  }
  const { headers, body } = splitHeadersAndBody(source);
  const inlineAttachments = [];
  const parsed = parseEntity(headers, body, inlineAttachments);
  return {
    headers,
    subject: decodeMimeHeader(headers.subject || ''),
    from: decodeMimeHeader(headers.from || ''),
    to: decodeMimeHeader(headers.to || ''),
    text: parsed.text || '',
    html: parsed.html || '',
    inlineAttachments,
  };
}

/**
 * 解析邮件实体内容，处理单体和多部分内容
 * @param {object} headers - 邮件头部对象
 * @param {string} body - 邮件正文内容
 * @returns {object} 包含text和html属性的对象
 */
function parseEntity(headers, body, inlineAttachments = []) {
  // 注意：boundary 区分大小写，不能对 content-type 整体小写后再提取
  const ctRaw = headers['content-type'] || '';
  const ct = ctRaw.toLowerCase();
  const transferEnc = (headers['content-transfer-encoding'] || '').toLowerCase();
  const boundary = getBoundary(ctRaw);

  // 单体：text/html 或 text/plain
  if (!ct.startsWith('multipart/')) {
    const rawBytes = decodeTransferEncodingToBytes(body, transferEnc);
    const decoded = decodeBodyWithCharset(body, transferEnc, ct);
    const guessedHtml = guessHtmlFromRaw(decoded || body || '');
    const isHtml = ct.includes('text/html');
    const isText = ct.includes('text/plain') || !ct;
    const contentId = normalizeContentId(headers['content-id'] || '');
    const disposition = getDispositionType(headers['content-disposition'] || '');
    if (contentId && rawBytes.length > 0 && !isHtml && !isText) {
      inlineAttachments.push({
        contentId,
        contentType: getMimeType(ctRaw),
        disposition,
        bytes: rawBytes,
      });
    }
    if (isHtml) {
      return { text: isText ? decoded : '', html: guessedHtml || decoded };
    }
    if (guessedHtml) {
      return { text: isText ? decoded : '', html: guessedHtml };
    }
    // 某些邮件不带 content-type 或是 message/rfc822 等，将其作为纯文本尝试
    if (!ct || ct === '') {
      if (guessedHtml) return { text: '', html: guessedHtml };
    }
    return { text: isText ? decoded : '', html: isHtml ? decoded : '' };
  }

  // 复合：递归解析，优先取 text/html，再退回 text/plain
  let text = '';
  let html = '';
  if (boundary) {
    const parts = splitMultipart(body, boundary);
    for (const part of parts) {
      const { headers: ph, body: pb } = splitHeadersAndBody(part);
      const pct = (ph['content-type'] || '').toLowerCase();
      // 对转发/嵌套邮件的更强兼容：
      // 1) message/rfc822（完整原始邮件作为 part）
      // 2) text/rfc822-headers（仅头部）后常跟随一个 text/html 或 text/plain 部分
      // 3) 某些服务会将原始邮件整体放在 text/plain/base64 中，里面再包含 HTML 片段
      if (pct.startsWith('multipart/')) {
        const nested = parseEntity(ph, pb, inlineAttachments);
        if (!html && nested.html) html = nested.html;
        if (!text && nested.text) text = nested.text;
      } else if (pct.startsWith('message/rfc822')) {
        const nested = parseEmailBody(pb);
        if (!html && nested.html) html = nested.html;
        if (!text && nested.text) text = nested.text;
      } else if (pct.includes('rfc822-headers')) {
        // 跳过纯头部，尝试在后续 part 中抓取正文
        continue;
      } else {
        const res = parseEntity(ph, pb, inlineAttachments);
        if (!html && res.html) html = res.html;
        if (!text && res.text) text = res.text;
      }
      if (text && html) break;
    }
  }

  // 如果仍无 html，尝试在原始体里直接抓取 HTML 片段（处理某些非标准邮件）
  if (!html) {
    // 尝试从各 part 的原始体里猜测 HTML（有些邮件未正确声明 content-type）
    html = guessHtmlFromRaw(body);
    // 如果仍为空，且 text 存在 HTML 痕迹（如标签密集），尝试容错解析
    if (!html && /<\w+[\s\S]*?>[\s\S]*<\/\w+>/.test(body || '')){
      html = body;
    }
  }
  // 如果还没有 html，但有 text，用简单换行转 <br> 的方式提供可读 html
  if (!html && text) {
    html = textToHtml(text);
  }
  return { text, html };
}

/**
 * 分割邮件头部和正文
 * @param {string} input - 包含头部和正文的完整邮件内容
 * @returns {object} 包含headers对象和body字符串的对象
 */
function splitHeadersAndBody(input) {
  const idx = input.indexOf('\r\n\r\n');
  const idx2 = idx === -1 ? input.indexOf('\n\n') : idx;
  const sep = idx !== -1 ? 4 : (idx2 !== -1 ? 2 : -1);
  if (sep === -1) return { headers: {}, body: input };
  const rawHeaders = input.slice(0, (idx !== -1 ? idx : idx2));
  const body = input.slice((idx !== -1 ? idx : idx2) + sep);
  return { headers: parseHeaders(rawHeaders), body };
}

/**
 * 解析邮件头部字符串为对象
 * @param {string} rawHeaders - 原始头部字符串
 * @returns {object} 头部字段对象，键为小写的头部名称
 */
function parseHeaders(rawHeaders) {
  const headers = {};
  const lines = rawHeaders.split(/\r?\n/);
  let lastKey = '';
  for (const line of lines) {
    if (/^\s/.test(line) && lastKey) {
      headers[lastKey] += ' ' + line.trim();
      continue;
    }
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      lastKey = m[1].toLowerCase();
      headers[lastKey] = m[2];
    }
  }
  return headers;
}

function normalizeContentId(value) {
  return String(value || '')
    .trim()
    .replace(/^cid:/i, '')
    .replace(/^<|>$/g, '')
    .trim()
    .toLowerCase();
}

function getDispositionType(contentDisposition) {
  return String(contentDisposition || '').split(';')[0].trim().toLowerCase();
}

function getMimeType(contentType) {
  const raw = String(contentType || '').trim();
  if (!raw) return 'application/octet-stream';
  return raw.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

function normalizeRawEmailSource(raw) {
  if (!raw) return '';
  if (raw instanceof Uint8Array) return bytesToBinaryString(raw);
  if (raw instanceof ArrayBuffer) return bytesToBinaryString(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) return bytesToBinaryString(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  return String(raw);
}

function bytesToBinaryString(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return '';
  const chunkSize = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

/**
 * 从Content-Type头部中提取boundary分隔符
 * @param {string} contentType - Content-Type头部值
 * @returns {string} boundary分隔符，如果没有找到返回空字符串
 */
function getBoundary(contentType) {
  if (!contentType) return '';
  // 不改变大小写以保留 boundary 原值；用不区分大小写的匹配
  const m = contentType.match(/boundary\s*=\s*"?([^";\r\n]+)"?/i);
  return m ? m[1].trim() : '';
}

/**
 * 根据boundary分隔符分割多部分邮件正文
 * @param {string} body - 多部分邮件正文
 * @param {string} boundary - boundary分隔符
 * @returns {Array<string>} 分割后的部分数组
 */
function splitMultipart(body, boundary) {
  // 容错：RFC 规定分隔行形如 "--boundary" 与终止 "--boundary--"；
  // 这里允许前后空白、以及行中仅包含该标记
  const delim = '--' + boundary;
  const endDelim = delim + '--';
  const lines = body.split(/\r?\n/);
  const parts = [];
  let current = [];
  let inPart = false;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === delim) {
      if (inPart && current.length) parts.push(current.join('\n'));
      current = [];
      inPart = true;
      continue;
    }
    if (line.trim() === endDelim) {
      if (inPart && current.length) parts.push(current.join('\n'));
      break;
    }
    if (inPart) current.push(rawLine);
  }
  return parts;
}

/**
 * 将传输编码的正文解码为原始字节
 * @param {string} body - 编码的正文内容
 * @param {string} transferEncoding - 传输编码类型（base64、quoted-printable等）
 * @returns {Uint8Array} 解码后的原始字节
 */
function decodeTransferEncodingToBytes(body, transferEncoding) {
  if (!body) return new Uint8Array(0);
  const enc = transferEncoding.trim();
  if (enc === 'base64') {
    const cleaned = body.replace(/\s+/g, '');
    try {
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (_) {
      return new TextEncoder().encode(body);
    }
  }
  if (enc === 'quoted-printable') {
    return decodeQuotedPrintableToBytes(body);
  }
  // 7bit/8bit/binary: 按 latin1 映射每个字符到一个字节
  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xFF;
  return bytes;
}

/**
 * 根据Content-Type中的charset和传输编码解码正文
 * 先将传输编码解码为原始字节，再按正确的charset解码为字符串
 * @param {string} body - 编码的正文内容
 * @param {string} transferEncoding - 传输编码类型
 * @param {string} contentType - Content-Type头部值，包含charset信息
 * @returns {string} 解码后的正文内容
 */
function decodeBodyWithCharset(body, transferEncoding, contentType) {
  if (!body) return '';
  const m = /charset\s*=\s*"?([^";]+)/i.exec(contentType || '');
  const charset = (m && m[1] ? m[1].trim() : '') || 'utf-8';

  const rawBytes = decodeTransferEncodingToBytes(body, transferEncoding);
  if (rawBytes.length === 0) return '';
  return decodeBytesWithCharset(rawBytes, charset);
}

/**
 * 解码Quoted-Printable编码的内容为原始字节
 * @param {string} input - Quoted-Printable编码的字符串
 * @returns {Uint8Array} 解码后的原始字节
 */
function decodeQuotedPrintableToBytes(input) {
  let s = input.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '=' && i + 2 < s.length) {
      const hex = s.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0) & 0xFF);
  }
  return new Uint8Array(bytes);
}

function decodeHeaderQToBytes(input) {
  const s = String(input || '').replace(/_/g, ' ');
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '=' && i + 2 < s.length) {
      const hex = s.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0) & 0xFF);
  }
  return new Uint8Array(bytes);
}

function normalizeCharset(charset) {
  const normalized = String(charset || '').trim().toLowerCase();
  if (!normalized) return 'utf-8';
  const aliases = {
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
  };
  return aliases[normalized] || normalized;
}

function buildCharsetCandidates(preferredCharset) {
  const preferred = normalizeCharset(preferredCharset);
  const candidates = [preferred];
  if (preferred !== 'utf-8') candidates.push('utf-8');
  if (preferred !== 'gb18030') candidates.push('gb18030');
  if (preferred !== 'big5') candidates.push('big5');
  if (preferred !== 'windows-1252') candidates.push('windows-1252');
  return Array.from(new Set(candidates));
}

function scoreDecodedText(text) {
  const value = String(text || '');
  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  const nullCount = (value.match(/\u0000/g) || []).length;
  return replacementCount * 100 + nullCount * 10;
}

function decodeBytesWithCharset(rawBytes, charset) {
  let bestText = '';
  let bestScore = Number.POSITIVE_INFINITY;
  const preferred = normalizeCharset(charset);
  for (const candidate of buildCharsetCandidates(preferred)) {
    try {
      const decoded = new TextDecoder(candidate, { fatal: false }).decode(rawBytes);
      const score = scoreDecodedText(decoded);
      if (score < bestScore) {
        bestScore = score;
        bestText = decoded;
      }
      if (score === 0 && candidate === preferred) {
        return decoded;
      }
    } catch (_) {
      // ignore unsupported charset candidates
    }
  }
  return bestText || bytesToBinaryString(rawBytes);
}

export function decodeMimeHeader(value) {
  const input = String(value || '');
  if (!input.includes('=?')) return input;
  const compact = input.replace(/(\?=)\s+(=\?)/g, '$1$2');
  return compact.replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_, charset, encoding, encodedText) => {
    try {
      const rawBytes = String(encoding).toUpperCase() === 'B'
        ? decodeTransferEncodingToBytes(encodedText, 'base64')
        : decodeHeaderQToBytes(encodedText);
      return decodeBytesWithCharset(rawBytes, charset);
    } catch (_) {
      return encodedText;
    }
  });
}

/**
 * 从原始内容中猜测并提取HTML片段
 * @param {string} raw - 原始内容
 * @returns {string} 提取的HTML内容，如果没有找到返回空字符串
 */
function guessHtmlFromRaw(raw) {
  if (!raw) return '';

  const fullDocMatches = Array.from(
    String(raw).matchAll(/(?:<!doctype\s+html[\s\S]*?<html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/ig)
  );
  if (fullDocMatches.length > 0) {
    return String(fullDocMatches[0][0] || '').trim();
  }

  const bodyMatch = String(raw).match(/<body[\s\S]*?<\/body>/i);
  if (bodyMatch && bodyMatch[0]) {
    return `<!doctype html><html><head><meta charset="utf-8"></head>${bodyMatch[0]}</html>`;
  }

  if (/<[a-z][\s\S]*?>/i.test(String(raw)) && /<\/[a-z]+>/i.test(String(raw))) {
    return `<!doctype html><html><head><meta charset="utf-8"></head><body>${String(raw)}</body></html>`;
  }

  return '';
}

/**
 * 转义HTML特殊字符
 * @param {string} s - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'': '&#39;'}[c] || c));
}

/**
 * 将纯文本转换为HTML格式，保持空白格式
 * @param {string} text - 纯文本内容
 * @returns {string} HTML格式的内容
 */
function textToHtml(text){
  return `<div style="white-space:pre-wrap">${escapeHtml(text)}</div>`;
}

/**
 * 将HTML内容转换为纯文本，去除标签、脚本、样式等
 * @param {string} html - HTML内容
 * @returns {string} 转换后的纯文本内容
 */
function stripHtml(html){
  const s = String(html || '');
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      try{ return String.fromCharCode(parseInt(n, 10)); }catch(_){ return ' '; }
    })
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从邮件主题、文本和HTML中智能提取验证码
 * 支持数字、字母数字、内部连字符，并识别多语言关键词
 * @param {object} params - 提取参数对象
 * @param {string} params.subject - 邮件主题，默认为空字符串
 * @param {string} params.text - 纯文本内容，默认为空字符串
 * @param {string} params.html - HTML内容，默认为空字符串
 * @returns {string} 提取的验证码，如果未找到返回空字符串
 */
export function extractVerificationCode({ subject = '', text = '', html = '' } = {}){
  const subjectText = String(subject || '');
  const textBody = String(text || '');
  const htmlBody = stripHtml(html);
  return extractCode(`${subjectText} ${textBody} ${htmlBody}`) || '';
}
