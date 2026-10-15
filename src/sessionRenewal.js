import { buildSessionCookie, createJwt } from './authentication.js';

const RENEW_BEFORE_SECONDS = 6 * 60 * 60;

export async function renewSessionResponse(response, context) {
  const payload = context.authPayload;
  const now = Math.floor(Date.now() / 1000);
  if (response.status >= 400 || !Number.isSafeInteger(payload?.exp) || payload.exp <= now ||
      payload.exp - now > RENEW_BEFORE_SECONDS || response.headers.has('Set-Cookie')) return response;

  const secret = context.env.JWT_TOKEN || context.env.JWT_SECRET;
  const token = await createJwt(secret, {
    role: payload.role,
    username: payload.username,
    ...(payload.userId !== undefined ? { userId: payload.userId } : {}),
    ...(payload.role === 'mailbox' ? { mailboxId: payload.mailboxId, mailboxAddress: payload.mailboxAddress } : {}),
  });
  const renewed = new Response(response.body, response);
  renewed.headers.set('Set-Cookie', buildSessionCookie(token, context.request.url));
  renewed.headers.set('Cache-Control', 'no-store');
  return renewed;
}
