export function normalizeMailboxResponse(response) {
    if (Array.isArray(response)) return { mailboxes: response };
    if (response && Array.isArray(response.mailboxes)) return response;
    return { mailboxes: [] };
}

export function normalizeUserRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return normalized === 'admin' ? 'Admin' : 'User';
}

export function normalizeUserQuota(user) {
    if (user && typeof user.quota !== 'undefined') return user.quota;
    if (user && typeof user.mailbox_limit !== 'undefined') return user.mailbox_limit;
    if (user && typeof user.mailboxLimit !== 'undefined') return user.mailboxLimit;
    return 10;
}

export function mapAdminMailbox(item) {
    if (!item) return item;
    const passwordChanged = readPasswordChanged(item);
    const isLoginAllowed = typeof item.is_login_allowed !== 'undefined'
        ? Boolean(item.is_login_allowed)
        : Boolean(item.can_login);
    const remark = (typeof item.remark === 'string') ? item.remark : (item.remark == null ? '' : String(item.remark));
    return { ...item, remark, password_changed: passwordChanged, is_login_allowed: isLoginAllowed };
}

function readPasswordChanged(item) {
    if (typeof item.password_changed !== 'undefined') return Boolean(item.password_changed);
    if (typeof item.password_is_default !== 'undefined') return !Boolean(item.password_is_default);
    return false;
}

export function mapEmailItem(item) {
    if (!item) return item;
    const fromAddress = item.from_address || item.sender || '';
    const toAddress = item.to_address || item.to_addrs || '';
    const text = item.text || item.preview || '';
    return { ...item, from_address: fromAddress, to_address: toAddress, text };
}

export function mapEmailDetail(item) {
    if (!item) return item;
    const base = mapEmailItem(item);
    const html = base.html || item.html_content || '';
    const text = base.text || item.content || '';
    return { ...base, html, text };
}
