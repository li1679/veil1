import { DEFAULT_ALL_MAILBOX_PAGE_SIZE, ALL_MAILBOX_PAGE_SIZE_OPTIONS } from './admin-state.js';

export function getLastMailboxStorageKey(state) {
    const username = state.currentUser?.username ? String(state.currentUser.username) : 'unknown';
    return `veil_last_mailbox_admin_${username}`;
}

export function normalizeEmailAddress(address) {
    return String(address || '').trim().toLowerCase();
}

export function getMailboxViewerPreviewText(email) {
    return String(email?.text || email?.preview || '').trim();
}

export function getAvailableDomains(domainSelector) {
    return domainSelector.getDomains().map((domain) => String(domain || '').trim()).filter(Boolean);
}

export function renderDomainOptions(selectEl, preferredValue, domainSelector, escapeHtml) {
    if (!selectEl) return;
    const availableDomains = getAvailableDomains(domainSelector);
    if (availableDomains.length === 0) {
        selectEl.innerHTML = '';
        return;
    }
    const currentValue = String(preferredValue || selectEl.value || '').trim();
    const selectedValue = availableDomains.includes(currentValue) ? currentValue : availableDomains[0];
    selectEl.innerHTML = availableDomains.map((domain) => {
        const safeDomain = escapeHtml(domain);
        const selectedAttr = domain === selectedValue ? ' selected' : '';
        return `<option value="${safeDomain}"${selectedAttr}>${safeDomain}</option>`;
    }).join('');
}

export function canManageUsers(state) {
    return state.currentUser && state.currentUser.role === 'StrictAdmin';
}

export function isLockedUser(user) {
    return !!user?.is_super_admin;
}

export function updateUserInfo(state) {
    const avatarEl = document.querySelector('.user-profile .avatar');
    const nameEl = document.querySelector('.user-profile .name-text');
    const badgeEl = document.querySelector('.user-profile .badge-admin');
    if (avatarEl && state.currentUser) {
        avatarEl.textContent = (state.currentUser.name || state.currentUser.username || 'A').substring(0, 2).toUpperCase();
    }
    if (nameEl && state.currentUser) nameEl.textContent = state.currentUser.name || state.currentUser.username;
    if (badgeEl && state.currentUser) badgeEl.textContent = 'Super Admin';
}

export function applyUserManagementAccessUI(state) {
    const canManage = canManageUsers(state);
    const actionBar = document.querySelector('#view-users .actions');
    if (actionBar) actionBar.style.display = canManage ? '' : 'none';
    const selectAll = document.getElementById('selectAllUsersCheckbox');
    if (!selectAll) return;
    if (canManage) selectAll.classList.remove('disabled');
    else {
        selectAll.classList.add('disabled');
        selectAll.classList.remove('checked');
    }
}

export function closeMobileSidebarIfOpen() {
    try {
        if (window.matchMedia && !window.matchMedia('(max-width: 768px)').matches) return;
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    } catch (_) {
        // ignore viewport helper failures
    }
}

export function initEmailPageSizeSelect(state) {
    const pageSizeSelect = document.getElementById('emailPageSize');
    if (!pageSizeSelect) return;
    pageSizeSelect.innerHTML = ALL_MAILBOX_PAGE_SIZE_OPTIONS.map((value) => (
        `<option value="${value}" ${value === state.allMailboxesPageState.limit ? 'selected' : ''}>每页 ${value}</option>`
    )).join('');
}

export function resetEmailPage(state) {
    state.allMailboxesPageState.page = 1;
    state.selectedEmailIds.clear();
    state.expandedEmailDetails.clear();
}

export function restoreDefaultEmailPageSize(state) {
    state.allMailboxesPageState.limit = DEFAULT_ALL_MAILBOX_PAGE_SIZE;
}
