import { deleteMailboxByAddress, request } from './api-core.js';
import { mapEmailDetail, mapEmailItem, normalizeMailboxResponse } from './api-mappers.js';

const MAILBOX_CLEAR_BATCH_LIMIT = 50;

export const mailboxAPI = {
    async getMailboxes(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.limit) queryParams.set('limit', String(params.limit));
        if (params.offset) queryParams.set('offset', String(params.offset));
        if (params.scope) queryParams.set('scope', String(params.scope));
        const queryString = queryParams.toString();
        const response = await request(`/api/mailboxes${queryString ? '?' + queryString : ''}`);
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

    async delete(address) {
        return deleteMailboxByAddress(address);
    },

    async clearAll(params = {}) {
        const allMailboxes = await fetchAllMailboxes(params);
        if (allMailboxes.length === 0) return { success: true, deleted: 0 };
        const results = await Promise.allSettled(allMailboxes.map((item) => deleteMailboxByAddress(item.address)));
        const deleted = results.filter((result) => result.status === 'fulfilled').length;
        return { success: true, deleted };
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
    async getEmails(mailboxAddress) {
        const response = await request(`/api/emails?mailbox=${encodeURIComponent(mailboxAddress)}`);
        const list = Array.isArray(response) ? response : (response.emails || []);
        return { emails: list.map(mapEmailItem) };
    },

    async getEmail(id) {
        const response = await request(`/api/email/${id}`);
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
