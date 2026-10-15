import { deleteMailboxByAddress, request } from './api-core.js';
import { mapEmailDetail, mapEmailItem, normalizeMailboxResponse } from './api-mappers.js';
import { runBatch } from './async-actions.js';

const MAILBOX_CLEAR_BATCH_LIMIT = 50;

export const mailboxAPI = {
    async getMailboxes(params = {}, options = {}) {
        const queryParams = new URLSearchParams();
        if (params.limit) queryParams.set('limit', String(params.limit));
        if (params.offset) queryParams.set('offset', String(params.offset));
        if (params.scope) queryParams.set('scope', String(params.scope));
        if (params.search) queryParams.set('q', params.search);
        const queryString = queryParams.toString();
        const response = await request(`/api/mailboxes${queryString ? '?' + queryString : ''}`, options);
        return normalizeMailboxResponse(response);
    },

    async generate(domain, prefixMode = 'random', length = 12, expiry = '24h') {
        return request('/api/generate', {
            method: 'POST',
            body: JSON.stringify({ domain, prefix_mode: prefixMode, length, expiry }),
        });
    },

    async generateBulk({ domain, prefixMode = 'random', length = 12, expiry = '24h', count = 1, randomDomain = false } = {}) {
        return request('/api/generate-bulk', {
            method: 'POST',
            body: JSON.stringify({
                domain,
                prefix_mode: prefixMode,
                length,
                expiry,
                count,
                random_domain: randomDomain,
            }),
        });
    },

    async create(prefix, domain, expiry = '24h') {
        return request('/api/create', {
            method: 'POST',
            body: JSON.stringify({ prefix, domain, expiry }),
        });
    },

    async pin(address) {
        return request(`/api/mailboxes/pin?address=${encodeURIComponent(address)}`, { method: 'POST' });
    },

    async delete(address) {
        return deleteMailboxByAddress(address);
    },

    async clearAll(params = {}, options = {}) {
        const allMailboxes = await fetchAllMailboxes(params);
        const result = await runBatch(allMailboxes.map((item) => item.address), deleteMailboxByAddress, options);
        if (!result.success) throw new Error(`已删除 ${result.success_count} 个邮箱，${result.fail_count} 个失败：${result.results.find((item) => !item.success).error}`);
        return { success: true, deleted: result.success_count };
    },
};

async function fetchAllMailboxes(params) {
    let offset = 0;
    let allMailboxes = [];
    while (true) {
        const response = await mailboxAPI.getMailboxes({ limit: MAILBOX_CLEAR_BATCH_LIMIT, offset, scope: params.scope });
        const batch = response.mailboxes || [];
        if (batch.length === 0) break;
        allMailboxes = allMailboxes.concat(batch);
        if (batch.length < MAILBOX_CLEAR_BATCH_LIMIT) break;
        offset += MAILBOX_CLEAR_BATCH_LIMIT;
    }
    return allMailboxes;
}

export const emailAPI = {
    async getEmails(mailboxAddress, options = {}) {
        const response = await request(`/api/emails?mailbox=${encodeURIComponent(mailboxAddress)}`, options);
        const list = Array.isArray(response) ? response : (response.emails || []);
        return { emails: list.map(mapEmailItem) };
    },

    async getEmail(id, options = {}) {
        const response = await request(`/api/email/${id}`, options);
        const email = response && response.email ? response.email : response;
        return { email: mapEmailDetail(email) };
    },

    async delete(id) {
        return request(`/api/email/${id}`, { method: 'DELETE' });
    },

    async send(from, fromName, to, subject, content) {
        return request('/api/send', {
            method: 'POST',
            body: JSON.stringify({ from, fromName, to, subject, text: content }),
        });
    },

    async clear(mailboxAddress) {
        return request(`/api/emails?mailbox=${encodeURIComponent(mailboxAddress)}`, { method: 'DELETE' });
    },
};
