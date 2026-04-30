import { ENGLISH_FIRST_NAMES, ENGLISH_LAST_NAMES } from './nameData.js';

const FIRST_NAMES = ENGLISH_FIRST_NAMES.map(toAlpha).filter(Boolean);
const LAST_NAMES = ENGLISH_LAST_NAMES.map(toAlpha).filter(Boolean);
const FIRST_BY_LEN = buildLengthMap(FIRST_NAMES);
const LAST_BY_LEN = buildLengthMap(LAST_NAMES);
const FIRST_LENS = Array.from(FIRST_BY_LEN.keys());
const LAST_LENS = Array.from(LAST_BY_LEN.keys());

export function generateHumanNamePrefix(targetLength = 12) {
  const length = Math.max(4, Math.min(32, Math.floor(Number(targetLength) || 12)));
  const digitsCount = chooseDigitsCount(length);
  return buildAlpha(length - digitsCount) + randomDigits(digitsCount);
}

function toAlpha(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function buildLengthMap(list = []) {
  const map = new Map();
  for (const name of list) {
    const len = name.length;
    if (!map.has(len)) map.set(len, []);
    map.get(len).push(name);
  }
  return map;
}

function chooseDigitsCount(totalLen) {
  const maxDigits = Math.max(0, Math.min(4, totalLen - 4));
  if (maxDigits <= 0) return 0;
  const r = Math.random();
  if (r < 0.62) return 0;
  if (r < 0.9) return Math.min(2, maxDigits);
  return Math.min(3, maxDigits);
}

function randomDigits(count) {
  if (count <= 0) return '';
  const min = count === 1 ? 0 : Math.pow(10, count - 1);
  const max = Math.pow(10, count) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1))).padStart(count, '0');
}

function buildAlpha(exactLen) {
  if (exactLen <= 6) {
    const hit = pickByLen(FIRST_BY_LEN, exactLen) || pickByLen(LAST_BY_LEN, exactLen);
    if (hit) return hit;
  }
  return tryBuildAlphaFromNames(exactLen) || buildFallbackAlpha(exactLen);
}

function tryBuildAlphaFromNames(exactLen) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const mode = Math.random();
    const candidate = buildAlphaCandidate(exactLen, mode);
    if (candidate) return candidate;
  }
  return '';
}

function buildAlphaCandidate(exactLen, mode) {
  if (mode < 0.58) return buildFirstLastCandidate(exactLen);
  if (mode < 0.78) return buildFirstInitialLastCandidate(exactLen);
  if (mode < 0.9) return buildInitialLastCandidate(exactLen);
  return buildTripleNameCandidate(exactLen);
}

function buildFirstLastCandidate(exactLen) {
  const firstLength = pick(FIRST_LENS);
  const lastLength = exactLen - firstLength;
  if (lastLength < 3) return '';
  return joinIfComplete(pickByLen(FIRST_BY_LEN, firstLength), pickByLen(LAST_BY_LEN, lastLength));
}

function buildFirstInitialLastCandidate(exactLen) {
  const firstLength = pick(FIRST_LENS);
  const lastLength = exactLen - firstLength - 1;
  if (lastLength < 3) return '';
  const first = pickByLen(FIRST_BY_LEN, firstLength);
  const last = pickByLen(LAST_BY_LEN, lastLength);
  return first && last ? first + (pick(FIRST_NAMES) || 'a').slice(0, 1) + last : '';
}

function buildInitialLastCandidate(exactLen) {
  const last = pickByLen(LAST_BY_LEN, exactLen - 1);
  return last ? (pick(FIRST_NAMES) || 'a').slice(0, 1) + last : '';
}

function buildTripleNameCandidate(exactLen) {
  const firstLength = pick(FIRST_LENS);
  const remain = exactLen - firstLength;
  if (remain < 6) return '';
  const lastLength1 = pick(LAST_LENS.filter((len) => len >= 3 && len <= remain - 3));
  const lastLength2 = remain - lastLength1;
  return joinIfComplete(
    pickByLen(FIRST_BY_LEN, firstLength),
    pickByLen(LAST_BY_LEN, lastLength1),
    pickByLen(LAST_BY_LEN, lastLength2)
  );
}

function buildFallbackAlpha(exactLen) {
  let base = (pick(FIRST_NAMES) || 'alex') + (pick(LAST_NAMES) || 'smith');
  while (base.length < exactLen) base += (pick(LAST_NAMES) || 'lee');
  const sliced = base.slice(0, exactLen);
  return /^[a-z]+$/.test(sliced) ? sliced : randomLetters(exactLen);
}

function randomLetters(length) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) out += letters.charAt(Math.floor(Math.random() * letters.length));
  return out;
}

function pick(list = []) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickByLen(map, len) {
  const arr = map.get(len);
  return arr?.length ? pick(arr) : null;
}

function joinIfComplete(...parts) {
  return parts.every(Boolean) ? parts.join('') : '';
}
