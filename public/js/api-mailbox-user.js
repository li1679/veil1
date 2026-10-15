import { authAPI } from './api-auth-domain.js';
import { request } from './api-core.js';
import { mapEmailDetail, mapEmailItem } from './api-mappers.js';

export const mailboxUserAPI = {
    async getMyMailbox() {
        const session = await authAPI.getSession();
        const address = session.mailbox_address || session.username || '';
        return { address };
    },

    async getMyEmails(options = {}) {
        const response = await request('/api/emails', options);
        const list = Array.isArray(response) ? response : (response.emails || []);
        return { emails: list.map(mapEmailItem) };
    },

    async getEmail(id, options = {}) {
        const response = await request(`/api/email/${id}`, options);
        const email = response && response.email ? response.email : response;
        return { email: mapEmailDetail(email) };
    },

    async deleteEmail(id) {
        return request(`/api/email/${id}`, { method: 'DELETE' });
    },

    async send(from, fromName, to, subject, content) {
        return request('/api/send', {
            method: 'POST',
            body: JSON.stringify({ from, fromName, to, subject, text: content }),
        });
    },
};
