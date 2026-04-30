import { getDatabaseWithValidation } from './dbConnectionHelper.js';

export async function verifyActiveUserStatus(env, payload) {
  if (payload.role !== 'user' || Number(payload.userId || 0) <= 0) return null;
  try {
    const db = await getDatabaseWithValidation(env);
    const { results } = await db.prepare('SELECT status FROM users WHERE id = ? LIMIT 1')
      .bind(Number(payload.userId)).all();
    const status = String(results?.[0]?.status || 'Active');
    if (status === 'Inactive') return new Response('账户已停用', { status: 403 });
    return null;
  } catch (error) {
    console.error('Auth status check failed:', error);
    return new Response('数据库连接失败', { status: 500 });
  }
}
