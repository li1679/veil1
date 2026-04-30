import { normalizeId, request } from './api-core.js';
import { normalizeUserQuota, normalizeUserRole } from './api-mappers.js';
import { userCache, userMailboxCache } from './api-state.js';

async function fetchUserMailboxes(userId) {
    try {
        const response = await request(`/api/users/${userId}/mailboxes`);
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.mailboxes)) return response.mailboxes;
    } catch (_) {
        // ignore cache miss helper failures
    }
    return [];
}

function cacheUserMailboxes(userId, mailboxes) {
    const map = new Map();
    (mailboxes || []).forEach((box) => {
        if (box && typeof box.id !== 'undefined') map.set(normalizeId(box.id), box.address);
    });
    userMailboxCache.set(normalizeId(userId), map);
}

async function resolveUsername(userId) {
    const key = normalizeId(userId);
    if (userCache.has(key)) return userCache.get(key);
    try {
        const response = await request('/api/users');
        const list = Array.isArray(response) ? response : (response.users || []);
        list.forEach((user) => {
            if (user && typeof user.id !== 'undefined') userCache.set(normalizeId(user.id), user.username);
        });
    } catch (_) {
        // ignore cache warmup failures
    }
    return userCache.get(key);
}

async function resolveUserMailboxAddress(userId, mailboxId) {
    const userKey = normalizeId(userId);
    const mailboxKey = normalizeId(mailboxId);
    const cached = userMailboxCache.get(userKey);
    if (cached && cached.has(mailboxKey)) return cached.get(mailboxKey);
    const mailboxes = await fetchUserMailboxes(userKey);
    cacheUserMailboxes(userKey, mailboxes);
    const refreshed = userMailboxCache.get(userKey);
    return refreshed ? refreshed.get(mailboxKey) : undefined;
}

async function normalizeUser(user) {
    if (!user || typeof user.id === 'undefined') return user;
    let mailboxes = Array.isArray(user.mailboxes) ? user.mailboxes : null;
    if (!mailboxes) mailboxes = await fetchUserMailboxes(user.id);
    userCache.set(normalizeId(user.id), user.username);
    cacheUserMailboxes(normalizeId(user.id), mailboxes);
    return {
        ...user,
        quota: normalizeUserQuota(user),
        role: normalizeUserRole(user.role),
        name: (typeof user.name === 'string') ? user.name : '',
        can_send: Boolean(user.can_send),
        status: user.status || 'Active',
        mailboxes,
    };
}

function buildUserPayload(userData) {
    const payload = {};
    if (typeof userData.quota !== 'undefined') payload.mailboxLimit = userData.quota;
    if (typeof userData.mailbox_limit !== 'undefined') payload.mailboxLimit = userData.mailbox_limit;
    if (typeof userData.can_send !== 'undefined') payload.can_send = userData.can_send ? 1 : 0;
    if (typeof userData.status !== 'undefined') payload.status = userData.status;
    if (typeof userData.password !== 'undefined' && userData.password !== '') payload.password = userData.password;
    if (typeof userData.username !== 'undefined' && userData.username !== '') payload.username = userData.username;
    if (typeof userData.name !== 'undefined') payload.name = String(userData.name || '').trim();
    return payload;
}

export const userAPI = {
    async getUsers() {
        const response = await request('/api/users');
        const list = Array.isArray(response) ? response : (response.users || []);
        const normalized = await Promise.all(list.map(normalizeUser));
        return { users: normalized.filter(Boolean) };
    },

    async getUser(id) {
        const response = await userAPI.getUsers();
        const key = normalizeId(id);
        return (response.users || []).find((user) => normalizeId(user.id) === key) || null;
    },

    async create(userData) {
        const payload = {
            name: (typeof userData.name === 'string') ? userData.name.trim() : '',
            username: userData.username,
            password: userData.password,
            mailboxLimit: normalizeUserQuota(userData),
            can_send: userData.can_send ? 1 : 0,
            status: userData.status || 'Active',
        };
        const created = await request('/api/users', { method: 'POST', body: JSON.stringify(payload) });
        await assignInitialMailboxIfNeeded(userData, payload.username);
        return created;
    },

    async update(id, userData) {
        return request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(buildUserPayload(userData)) });
    },

    async delete(id) {
        return request(`/api/users/${id}`, { method: 'DELETE' });
    },

    async batchDelete(ids) {
        const results = await Promise.allSettled((ids || []).map((id) => request(`/api/users/${id}`, { method: 'DELETE' })));
        const deleted = results.filter((result) => result.status === 'fulfilled').length;
        return { success: true, deleted };
    },

    async assignMailbox(userId, prefix, domain) {
        const username = await resolveUsername(userId);
        if (!username) throw new Error('用户不存在');
        return request('/api/users/assign', {
            method: 'POST',
            body: JSON.stringify({ username, address: `${prefix}@${domain}` }),
        });
    },

    async removeMailbox(userId, mailboxId) {
        const username = await resolveUsername(userId);
        if (!username) throw new Error('用户不存在');
        const address = await resolveUserMailboxAddress(userId, mailboxId);
        if (!address) throw new Error('邮箱不存在');
        return request('/api/users/unassign', {
            method: 'POST',
            body: JSON.stringify({ username, address }),
        });
    },
};

async function assignInitialMailboxIfNeeded(userData, username) {
    if (!userData.initial_mailbox?.prefix || !userData.initial_mailbox?.domain) return;
    const address = `${userData.initial_mailbox.prefix}@${userData.initial_mailbox.domain}`;
    await request('/api/users/assign', { method: 'POST', body: JSON.stringify({ username, address }) });
}
