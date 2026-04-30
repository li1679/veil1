import { extractEmail } from './commonUtils.js';

const MAX_EMAIL_ADDRESS_LENGTH = 254;
const MAX_RECEIVED_SUBJECT_LENGTH = 500;
const MAX_RECEIVED_TEXT_LENGTH = 1_000_000;
const MAX_RECEIVED_HTML_LENGTH = 1_000_000;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ReceivedEmailValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReceivedEmailValidationError';
  }
}

export function normalizeReceivedEmailData(emailData) {
  const to = String(emailData?.to || '');
  const from = String(emailData?.from || '');
  const mailbox = extractEmail(to).trim().toLowerCase();
  const sender = extractEmail(from).trim().toLowerCase();
  const data = {
    to: mailbox,
    from: sender,
    subject: String(emailData?.subject || '(无主题)'),
    text: String(emailData?.text || ''),
    html: String(emailData?.html || ''),
    mailbox,
    sender
  };
  validateReceivedEmailData(data);
  return data;
}

export function validateReceivedEmailData(data) {
  if (!isValidEmailAddress(data.mailbox)) throw new ReceivedEmailValidationError('无效的收件邮箱地址');
  if (data.sender && !isValidEmailAddress(data.sender)) throw new ReceivedEmailValidationError('无效的发件邮箱地址');
  if (String(data.subject || '').length > MAX_RECEIVED_SUBJECT_LENGTH) {
    throw new ReceivedEmailValidationError('邮件主题过长');
  }
  if (String(data.text || '').length > MAX_RECEIVED_TEXT_LENGTH || String(data.html || '').length > MAX_RECEIVED_HTML_LENGTH) {
    throw new ReceivedEmailValidationError('邮件内容过大');
  }
}

function isValidEmailAddress(value) {
  const address = String(value || '').trim();
  return address.length > 0 && address.length <= MAX_EMAIL_ADDRESS_LENGTH && EMAIL_ADDRESS_PATTERN.test(address);
}

export function buildReceivedEml(data, now = new Date()) {
  if (data.html) return buildMultipartEml(data, now);
  return buildTextEml(data, now);
}

function buildMultipartEml(data, now) {
  const boundary = createBoundary();
  return [
    ...buildCommonHeaders(data, now),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    data.text || '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    data.html,
    `--${boundary}--`,
    ''
  ].join('\r\n');
}

function buildTextEml(data, now) {
  return [
    ...buildCommonHeaders(data, now),
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    data.text || '',
    ''
  ].join('\r\n');
}

function buildCommonHeaders(data, now) {
  return [
    `From: <${data.sender}>`,
    `To: <${data.mailbox}>`,
    `Subject: ${data.subject}`,
    `Date: ${now.toUTCString()}`,
    'MIME-Version: 1.0'
  ];
}

function createBoundary() {
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `mf-${id}`;
}
