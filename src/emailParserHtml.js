const HTML_DOCUMENT_PREFIX = '<!doctype html><html><head><meta charset="utf-8"></head>';
const HTML_DOCUMENT_SUFFIX = '</html>';
const HTML_TAG_PAIR_PATTERN = /<\w+[\s\S]*?>[\s\S]*<\/\w+>/;
const HTML_ESCAPE = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

export function guessHtmlFromRaw(raw) {
  const source = String(raw || '');
  if (!source) return '';
  const fullDocument = findFullHtmlDocument(source);
  if (fullDocument) return fullDocument;
  const bodyMatch = source.match(/<body[\s\S]*?<\/body>/i);
  if (bodyMatch?.[0]) return `${HTML_DOCUMENT_PREFIX}${bodyMatch[0]}${HTML_DOCUMENT_SUFFIX}`;
  return looksLikeHtmlFragment(source) ? wrapHtmlBody(source) : '';
}

function findFullHtmlDocument(source) {
  const match = source.match(/(?:<!doctype\s+html[\s\S]*?<html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/i);
  return String(match?.[0] || '').trim();
}

function looksLikeHtmlFragment(source) {
  return /<[a-z][\s\S]*?>/i.test(source) && /<\/[a-z]+>/i.test(source);
}

function wrapHtmlBody(source) {
  return `${HTML_DOCUMENT_PREFIX}<body>${source}</body>${HTML_DOCUMENT_SUFFIX}`;
}

export function hasHtmlTagPair(value) {
  return HTML_TAG_PAIR_PATTERN.test(String(value || ''));
}

export function textToHtml(text) {
  return `<div style="white-space:pre-wrap">${escapeHtml(String(text || ''))}</div>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char] || char);
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, decodeNumericEntity)
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeNumericEntity(_, codePoint) {
  try {
    return String.fromCharCode(parseInt(codePoint, 10));
  } catch (_) {
    return ' ';
  }
}
