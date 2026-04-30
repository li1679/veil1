import { extractCode } from '../public/js/verification-code.js';
import { decodeBodyWithCharset, decodeMimeHeader, decodeTransferEncodingToBytes } from './emailParserDecoding.js';
import { guessHtmlFromRaw, hasHtmlTagPair, stripHtml, textToHtml } from './emailParserHtml.js';
import {
  getBoundary,
  getDispositionType,
  getMimeType,
  normalizeContentId,
  normalizeRawEmailSource,
  splitHeadersAndBody,
  splitMultipart,
} from './emailParserSource.js';

export { decodeMimeHeader } from './emailParserDecoding.js';

const EMPTY_BODY = Object.freeze({ text: '', html: '' });
const EMPTY_MESSAGE = Object.freeze({
  headers: {},
  subject: '',
  from: '',
  to: '',
  text: '',
  html: '',
  inlineAttachments: [],
});

export function parseEmailBody(raw) {
  const source = normalizeRawEmailSource(raw);
  if (!source) return { ...EMPTY_BODY };
  const { headers, body } = splitHeadersAndBody(source);
  return parseEntity(headers, body);
}

export function parseEmailMessage(raw) {
  const source = normalizeRawEmailSource(raw);
  if (!source) return { ...EMPTY_MESSAGE, headers: {}, inlineAttachments: [] };
  const { headers, body } = splitHeadersAndBody(source);
  const inlineAttachments = [];
  const parsed = parseEntity(headers, body, inlineAttachments);
  return buildParsedMessage(headers, parsed, inlineAttachments);
}

function buildParsedMessage(headers, parsed, inlineAttachments) {
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

function parseEntity(headers, body, inlineAttachments = []) {
  const contentTypeRaw = headers['content-type'] || '';
  const contentType = contentTypeRaw.toLowerCase();
  if (!contentType.startsWith('multipart/')) {
    return parseSingleEntity({ headers, body, contentTypeRaw, contentType, inlineAttachments });
  }
  return parseMultipartEntity({ body, boundary: getBoundary(contentTypeRaw), inlineAttachments });
}

function parseSingleEntity({ headers, body, contentTypeRaw, contentType, inlineAttachments }) {
  const transferEncoding = (headers['content-transfer-encoding'] || '').toLowerCase();
  const rawBytes = decodeTransferEncodingToBytes(body, transferEncoding);
  const decoded = decodeBodyWithCharset(body, transferEncoding, contentType);
  const guessedHtml = guessHtmlFromRaw(decoded || body || '');
  const isHtml = contentType.includes('text/html');
  const isText = contentType.includes('text/plain') || !contentType;
  addInlineAttachment({ headers, contentTypeRaw, isHtml, isText, rawBytes, inlineAttachments });
  if (isHtml) return { text: isText ? decoded : '', html: guessedHtml || decoded };
  if (guessedHtml) return { text: isText ? decoded : '', html: guessedHtml };
  return { text: isText ? decoded : '', html: isHtml ? decoded : '' };
}

function addInlineAttachment({ headers, contentTypeRaw, isHtml, isText, rawBytes, inlineAttachments }) {
  const contentId = normalizeContentId(headers['content-id'] || '');
  if (!contentId || rawBytes.length === 0 || isHtml || isText) return;
  inlineAttachments.push({
    contentId,
    contentType: getMimeType(contentTypeRaw),
    disposition: getDispositionType(headers['content-disposition'] || ''),
    bytes: rawBytes,
  });
}

function parseMultipartEntity({ body, boundary, inlineAttachments }) {
  let result = { ...EMPTY_BODY };
  if (!boundary) return finalizeEntityResult(result, body);
  for (const part of splitMultipart(body, boundary)) {
    result = mergeEntityResult(result, parseMultipartPart(part, inlineAttachments));
    if (result.text && result.html) break;
  }
  return finalizeEntityResult(result, body);
}

function parseMultipartPart(part, inlineAttachments) {
  const { headers, body } = splitHeadersAndBody(part);
  const contentType = (headers['content-type'] || '').toLowerCase();
  if (contentType.includes('rfc822-headers')) return { ...EMPTY_BODY };
  if (contentType.startsWith('message/rfc822')) return parseEmailBody(body);
  return parseEntity(headers, body, inlineAttachments);
}

function mergeEntityResult(result, source) {
  return {
    text: result.text || source.text || '',
    html: result.html || source.html || '',
  };
}

function finalizeEntityResult(result, body) {
  const html = result.html || guessHtmlFromRaw(body) || (hasHtmlTagPair(body) ? body : '');
  return {
    text: result.text,
    html: html || (result.text ? textToHtml(result.text) : ''),
  };
}

export function extractVerificationCode({ subject = '', text = '', html = '' } = {}) {
  const content = `${String(subject || '')} ${String(text || '')} ${stripHtml(html)}`;
  return extractCode(content) || '';
}
