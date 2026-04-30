import { request } from './api-core.js';

export const authAPI = {
    async getSession() {
        return request('/api/session');
    },

    async login(username, password) {
        return request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    },

    async logout() {
        return request('/api/logout', { method: 'POST' });
    },
};

export const domainAPI = {
    async getDomains() {
        return request('/api/domains');
    },
};

export const quotaAPI = {
    async get() {
        return request('/api/user/quota');
    },
};
