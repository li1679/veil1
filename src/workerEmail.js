import { extractEmail } from './commonUtils.js';
import { getMailboxIdForReceive, initDatabase } from './database.js';
import { getDatabaseWithValidation } from './dbConnectionHelper.js';
import { forwardByLocalPart } from './emailForwarder.js';
import { buildEmailPreview } from './emailPreview.js';
import { decodeMimeHeader, extractVerificationCode, parseEmailMessage } from './emailParser.js';
import { putEmlObject } from './emailStorage.js';

export async function handleEmailEvent(message, env, ctx) {
  const db = await openEmailDatabase(message, env);
  if (!db) return;

  try {
    const delivery = readDeliveryFields(message);
    forwardByLocalPart(message, delivery.localPart, ctx, env);

    const mailboxId = await getMailboxIdForReceive(db, delivery.mailbox);
    if (!mailboxId) {
      rejectEmail(message, 'Mailbox expired');
      return;
    }

    const parsedRaw = await readParsedRawEmail(message);
    if (!parsedRaw) return;
    const subject = parsedRaw.subject || delivery.subject;
    const objectKey = await storeRawEmail(env, delivery.mailbox, parsedRaw.rawBuffer);
    await insertEmailMessage(db, buildEmailRow(message, delivery, parsedRaw, subject, mailboxId, objectKey));
  } catch (error) {
    console.error('Email event handling error:', error);
    rejectEmail(message, 'Email processing failed');
  }
}

async function openEmailDatabase(message, env) {
  try {
    const db = await getDatabaseWithValidation(env);
    await initDatabase(db);
    return db;
  } catch (error) {
    console.error('邮件处理时数据库连接失败:', error.message);
    rejectEmail(message, 'Database unavailable');
    return null;
  }
}

function readDeliveryFields(message) {
  const headers = message.headers;
  const toHeader = headers.get('to') || headers.get('To') || '';
  const fromHeader = headers.get('from') || headers.get('From') || '';
  const resolvedRecipient = String(readEnvelopeRecipient(message) || toHeader || '');
  const resolvedAddress = extractEmail(resolvedRecipient);
  return {
    toHeader,
    resolvedRecipient,
    mailbox: extractEmail(resolvedRecipient || toHeader),
    sender: extractEmail(fromHeader),
    subject: decodeMimeHeader(headers.get('subject') || headers.get('Subject') || '(无主题)'),
    localPart: (resolvedAddress.split('@')[0] || '').toLowerCase(),
  };
}

function readEnvelopeRecipient(message) {
  try {
    const toValue = message.to;
    if (Array.isArray(toValue) && toValue.length > 0) return readAddressValue(toValue[0]);
    if (typeof toValue === 'string') return toValue;
    return '';
  } catch (error) {
    console.warn('Envelope recipient extraction failed:', error);
    return '';
  }
}

function readAddressValue(value) {
  if (typeof value === 'string') return value;
  return value?.address || '';
}

async function readParsedRawEmail(message) {
  try {
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    const parsed = parseEmailMessage(rawBuffer);
    return { rawBuffer, text: parsed.text || '', html: parsed.html || '', subject: parsed.subject || '' };
  } catch (error) {
    console.error('Email parse failed:', error);
    rejectEmail(message, 'Email parse failed');
    return null;
  }
}

async function storeRawEmail(env, mailbox, rawBuffer) {
  if (!rawBuffer) throw new Error('Email raw content is required');
  return putEmlObject(env.MAIL_EML, { mailbox, body: new Uint8Array(rawBuffer) });
}

function buildEmailRow(message, delivery, parsedRaw, subject, mailboxId, objectKey) {
  const preview = buildEmailPreview({ text: parsedRaw.text, html: parsedRaw.html });
  return {
    mailboxId,
    sender: delivery.sender,
    toAddrs: readRecipientList(message, delivery),
    subject: subject || '(无主题)',
    verificationCode: readVerificationCode(subject, parsedRaw),
    preview: preview || null,
    objectKey: objectKey || '',
  };
}

function readVerificationCode(subject, parsedRaw) {
  try {
    return extractVerificationCode({ subject, text: parsedRaw.text, html: parsedRaw.html }) || null;
  } catch (error) {
    console.warn('Verification code extraction failed:', error);
    return null;
  }
}

function readRecipientList(message, delivery) {
  try {
    const toValue = message.to;
    if (Array.isArray(toValue)) return toValue.map(readAddressValue).filter(Boolean).join(',');
    if (typeof toValue === 'string') return toValue;
    return delivery.resolvedRecipient || delivery.toHeader || '';
  } catch (error) {
    console.warn('Recipient list extraction failed:', error);
    return delivery.resolvedRecipient || delivery.toHeader || '';
  }
}

async function insertEmailMessage(db, row) {
  await db.prepare(`
    INSERT INTO messages (mailbox_id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.mailboxId,
    row.sender,
    String(row.toAddrs || ''),
    row.subject,
    row.verificationCode,
    row.preview,
    'mail-eml',
    row.objectKey,
  ).run();
}

function rejectEmail(message, reason) {
  try {
    if (typeof message?.setReject === 'function') message.setReject(reason);
  } catch (error) {
    console.error('Email reject failed:', error);
  }
}
