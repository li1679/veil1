const EML_CONTENT_TYPE = 'message/rfc822';

function getRandomKeyId() {
  return (globalThis.crypto?.randomUUID && crypto.randomUUID())
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeMailboxForPath(mailbox) {
  return String(mailbox || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '_');
}

export function buildEmlObjectKey(mailbox, now = new Date(), keyId = getRandomKeyId()) {
  const at = new Date(now);
  const y = at.getUTCFullYear();
  const m = pad2(at.getUTCMonth() + 1);
  const d = pad2(at.getUTCDate());
  const hh = pad2(at.getUTCHours());
  const mm = pad2(at.getUTCMinutes());
  const ss = pad2(at.getUTCSeconds());
  const safeMailbox = normalizeMailboxForPath(mailbox);
  return `${y}/${m}/${d}/${safeMailbox}/${hh}${mm}${ss}-${keyId}.eml`;
}

export async function putEmlObject(r2, { mailbox, body, now = new Date(), keyId = getRandomKeyId() } = {}) {
  if (!r2 || typeof r2.put !== 'function') {
    throw new Error('MAIL_EML binding is required');
  }
  if (body === undefined || body === null) {
    throw new Error('EML body is required');
  }
  const objectKey = buildEmlObjectKey(mailbox, now, keyId);
  await r2.put(objectKey, body, { httpMetadata: { contentType: EML_CONTENT_TYPE } });
  return objectKey;
}
