const API_BASE = '';

export class ApiError extends Error {
    constructor(message, status, retryAfter = 0) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

/** @param {string} url @param {RequestInit & {timeoutMs?: number}} options */
export async function request(url, options = {}) {
    const { timeoutMs = options.method && options.method !== 'GET' ? 60000 : 20000, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);
    if (fetchOptions.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
        const response = await fetch(`${API_BASE}${url}`, { credentials: 'include', ...fetchOptions, headers, signal: controller.signal });
        const isJson = response.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await response.json() : await response.text();
        if (!response.ok) {
            const retryAfter = Number(response.headers.get('Retry-After')) || 0;
            throw new ApiError((isJson ? data?.error || data?.message : data) || `HTTP ${response.status}`, response.status, retryAfter);
        }
        return data;
    } catch (error) {
        if (timedOut && !options.signal?.aborted) throw new ApiError('请求超时，请重试；写操作请先确认是否已完成', 0);
        throw error;
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
    }
}

export function normalizeId(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : value;
}

export async function deleteMailboxByAddress(address) {
    if (!address) throw new Error('Missing address');
    try { return await request(`/api/mailboxes?address=${encodeURIComponent(address)}`, { method: 'DELETE' }); }
    catch (error) { if (error.status === 404) return { success: true, deleted: false }; throw error; }
}
