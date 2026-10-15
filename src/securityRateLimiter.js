import { buildRateLimitResponse } from './securityRateLimit.js';

// One globally unique object per IP and bucket; transactions serialize counters.
export class SecurityRateLimiter {
  constructor(ctx) {
    this.storage = ctx.storage;
  }

  async fetch(request) {
    const { limit, windowMs } = await request.json();
    if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1000) {
      return new Response('Invalid rate limit configuration', { status: 400 });
    }
    const now = Date.now();
    return this.storage.transaction(async (txn) => {
      let entry = await txn.get('window');
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        await this.storage.setAlarm(entry.resetAt);
      }
      if (entry.count >= limit) return buildRateLimitResponse(entry.resetAt, now);
      entry.count += 1;
      await txn.put('window', entry);
      return new Response(null, { status: 204 });
    });
  }

  async alarm() {
    await this.storage.transaction(async (txn) => {
      const entry = await txn.get('window');
      if (!entry) return;
      if (entry.resetAt <= Date.now()) await txn.delete('window');
      else await this.storage.setAlarm(entry.resetAt);
    });
  }
}
