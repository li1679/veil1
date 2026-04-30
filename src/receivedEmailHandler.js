import { getOrCreateMailboxId } from './database.js';
import { extractVerificationCode } from './emailParser.js';
import { buildEmailPreview } from './emailPreview.js';
import { putEmlObject } from './emailStorage.js';
import {
  buildReceivedEml,
  normalizeReceivedEmailData,
  ReceivedEmailValidationError
} from './receivedEmailMessage.js';

export async function handleEmailReceive(request, db, env) {
  try {
    const data = normalizeReceivedEmailData(await request.json());
    const mailboxId = await getOrCreateMailboxId(db, data.mailbox);
    const now = new Date();
    const objectKey = await putEmlObject(env?.MAIL_EML, {
      mailbox: data.mailbox,
      body: buildReceivedEml(data, now),
      now
    });
    await insertReceivedMessage(db, data, mailboxId, objectKey);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ReceivedEmailValidationError) {
      return new Response(error.message, { status: 400 });
    }
    console.error('处理邮件时出错:', error);
    return new Response('处理邮件失败', { status: 500 });
  }
}

async function insertReceivedMessage(db, data, mailboxId, objectKey) {
  await db.prepare(`
    INSERT INTO messages (mailbox_id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    mailboxId,
    data.sender,
    data.to,
    data.subject || '(无主题)',
    extractReceivedVerificationCode(data) || null,
    buildEmailPreview({ text: data.text, html: data.html }) || null,
    'mail-eml',
    objectKey || ''
  ).run();
}

function extractReceivedVerificationCode(data) {
  try {
    return extractVerificationCode({ subject: data.subject, text: data.text, html: data.html });
  } catch (error) {
    console.warn('Verification code extraction failed:', error);
    return '';
  }
}
