import { extractEmail } from '../commonUtils.js';
import { getMailboxIdByAddress } from '../database.js';

export async function handlePublicExtractCodes(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const list = readAddressList(payload);
    if (list instanceof Response) return list;
    return Response.json(await extractCodesForAddresses(ctx, list));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
}

function readAddressList(payload) {
  const addresses = Array.isArray(payload?.addresses) ? payload.addresses : [];
  const list = addresses.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  if (!list.length) return Response.json([]);
  if (list.length > 50) return Response.json({ error: 'too many addresses' }, { status: 400 });
  return list;
}

async function extractCodesForAddresses(ctx, addresses) {
  const output = [];
  for (const rawAddress of addresses) {
    output.push(await extractCodeForAddress(ctx, rawAddress));
  }
  return output;
}

async function extractCodeForAddress(ctx, rawAddress) {
  const address = extractEmail(rawAddress).trim().toLowerCase();
  if (!address) return emptyCodeResult(rawAddress);

  const mailboxId = await getMailboxIdByAddress(ctx.db, address);
  if (!mailboxId) return emptyCodeResult(address);
  const rows = await loadRecentMessageRows(ctx, mailboxId);
  return findCodeInRows(address, rows);
}

function emptyCodeResult(address) {
  return { address, code: null, messageId: null, receivedAt: null };
}

async function loadRecentMessageRows(ctx, mailboxId) {
  const { results } = await ctx.db.prepare(
    `SELECT id, verification_code, received_at
     FROM messages WHERE mailbox_id = ? ORDER BY received_at DESC LIMIT 20`
  ).bind(mailboxId).all();
  return results || [];
}

function findCodeInRows(address, rows) {
  for (const row of rows) {
    const code = String(row?.verification_code || '').trim();
    if (!code) continue;
    return { address, code, messageId: row?.id ?? null, receivedAt: row?.received_at ?? null };
  }
  return emptyCodeResult(address);
}
