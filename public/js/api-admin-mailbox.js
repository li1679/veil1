import { deleteMailboxByAddress, normalizeId, request } from './api-core.js';
import { mapAdminMailbox, normalizeMailboxResponse } from './api-mappers.js';
import { adminMailboxCache } from './api-state.js';

export const adminMailboxAPI = {
    async getAllMailboxes(params = {}, requestOptions = {}) {
        const queryString = buildMailboxQuery(params);
        const response = await request(`/api/mailboxes${queryString ? '?' + queryString : ''}`, requestOptions);
        const mailboxes = normalizeMailboxResponse(response).mailboxes.map(mapAdminMailbox);
        refreshAdminMailboxCache(mailboxes);
        return { mailboxes, pagination: response && !Array.isArray(response) ? response.pagination || null : null };
    },

    async getPassword(address) {
        const normalized = String(address || '').trim().toLowerCase();
        if (!normalized) throw new Error('邮箱不存在');
        return request(`/api/mailboxes/password?address=${encodeURIComponent(normalized)}`);
    },

    async update(id, data) {
        const address = data?.address ? data.address : adminMailboxCache.get(normalizeId(id));
        if (!address) throw new Error('邮箱不存在');
        if (Object.prototype.hasOwnProperty.call(data || {}, 'remark')) return updateRemark(address, data.remark);
        if (Object.prototype.hasOwnProperty.call(data || {}, 'is_login_allowed')) return updateLogin(address, data.is_login_allowed);
        if (hasPasswordUpdate(data)) return updatePassword(address, data);
        return { success: false };
    },

    async delete(id) {
        const address = adminMailboxCache.get(normalizeId(id));
        if (!address) throw new Error('邮箱不存在');
        return deleteMailboxByAddress(address);
    },

    async batchUpdateLogin(ids, isLoginAllowed) {
        const addresses = mapIdsToAddresses(ids);
        if (addresses.length === 0) return { success: false };
        return request('/api/mailboxes/batch-toggle-login', {
            method: 'POST',
            body: JSON.stringify({ addresses, can_login: isLoginAllowed }),
        });
    },

    async batchDelete(ids) {
        const addresses = mapIdsToAddresses(ids);
        const results = await Promise.allSettled(addresses.map((address) => deleteMailboxByAddress(address)));
        const deleted = results.filter((result) => result.status === 'fulfilled').length;
        return { success: true, deleted };
    },
};

function buildMailboxQuery(params) {
    const queryParams = new URLSearchParams();
    if (params.domain) queryParams.set('domain', params.domain);
    if (params.search) queryParams.set('q', params.search);
    if (params.created_by) queryParams.set('created_by', params.created_by);
    const limit = params.limit ? Number(params.limit) : null;
    const page = params.page ? Number(params.page) : null;
    const rawOffset = Number(params.offset);
    const hasOffset = Number.isFinite(rawOffset) && rawOffset >= 0;
    if (limit) queryParams.set('limit', String(limit));
    if (hasOffset) queryParams.set('offset', String(rawOffset));
    else if (page && limit) queryParams.set('offset', String((page - 1) * limit));
    return queryParams.toString();
}

function refreshAdminMailboxCache(mailboxes) {
    adminMailboxCache.clear();
    mailboxes.forEach((item) => {
        if (item && typeof item.id !== 'undefined') adminMailboxCache.set(normalizeId(item.id), item.address);
    });
}

function updateRemark(address, remark) {
    return request('/api/mailboxes/remark', {
        method: 'POST',
        body: JSON.stringify({ address, remark }),
    });
}

function updateLogin(address, isLoginAllowed) {
    return request('/api/mailboxes/toggle-login', {
        method: 'POST',
        body: JSON.stringify({ address, can_login: isLoginAllowed }),
    });
}

function hasPasswordUpdate(data) {
    return data && (
        Object.prototype.hasOwnProperty.call(data, 'password')
        || Object.prototype.hasOwnProperty.call(data, 'password_changed')
    );
}

function updatePassword(address, data) {
    if (!data.password || data.password_changed === false) {
        return request(`/api/mailboxes/reset-password?address=${encodeURIComponent(address)}`, { method: 'POST' });
    }
    return request('/api/mailboxes/change-password', {
        method: 'POST',
        body: JSON.stringify({ address, new_password: data.password }),
    });
}

function mapIdsToAddresses(ids) {
    return (ids || []).map((id) => adminMailboxCache.get(normalizeId(id))).filter(Boolean);
}
