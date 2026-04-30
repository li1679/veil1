import { authAPI } from './api-auth-domain.js';
import { request } from './api-core.js';
import { mapEmailDetail, mapEmailItem } from './api-mappers.js';

export const mailboxUserAPI = {
    async getMyMailbox() {
        const session = await authAPI.getSession();
        const address = session.mailbox_address || session.username || '';
        return { address };
    },

    async getMyEmails() {
        const response = await request('/api/emails');
        const list = Array.isArray(response) ? response : (response.emails || []);
        return { emails: list.map(mapEmailItem) };
    },

    async getEmail(id) {
        const response = await request(`/api/email/${id}`);
        const email = response && response.email ? response.email : response;
        return { email: mapEmailDetail(email) };
    },

    async deleteEmail(id) {
        return request(`/api/email/${id}`, { method: 'DELETE' });
    },

    async send(to, subject, content) {
        const session = await authAPI.getSession();
        const from = session.mailbox_address || session.username || '';
        return request('/api/send', {
            method: 'POST',
            body: JSON.stringify({ from, to, subject, text: content }),
        });
    },
};
