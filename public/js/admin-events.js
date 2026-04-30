import { toggleUserMenu } from './common.js';

export function initAdminEventListeners({ logout }) {
    bindUserMenu(logout);
    bindMailboxSearch();
    bindHistoryList();
    bindDomainOptions();
    bindUserTable();
    bindMailboxTable();
    bindMailboxViewer();
}

function bindUserMenu(logout) {
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) userProfile.addEventListener('click', toggleUserMenu);
    const logoutBtn = document.getElementById('logoutMenuItem');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

function bindMailboxSearch() {
    const searchInput = document.getElementById('emailSearchInput');
    if (!searchInput) return;
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => window.filterAllEmails(searchInput.value), 300);
    });
}

function bindHistoryList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    container.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl || !container.contains(actionEl)) return;
        const id = parseInt(actionEl.dataset.id || '', 10);
        if (actionEl.dataset.action === 'restore-email') window.restoreEmail(actionEl.dataset.email);
        else if (actionEl.dataset.action === 'toggle-pin') window.togglePin(id);
        else if (actionEl.dataset.action === 'delete-history') window.confirmDeleteHistory(id);
    });
}

function bindDomainOptions() {
    const domainOptions = document.getElementById('domainOptions');
    if (!domainOptions) return;
    domainOptions.addEventListener('click', (event) => {
        const option = event.target.closest('[data-action="select-domain"]');
        if (option) window.selectDomain(option, option.dataset.domain);
    });
}

function bindUserTable() {
    const body = document.getElementById('userTableBody');
    if (!body) return;
    body.addEventListener('click', (event) => handleUserTableClick(event, body));
    body.addEventListener('change', (event) => {
        const actionEl = event.target.closest('[data-action="change-user-status"]');
        const userId = parseInt(actionEl?.dataset.userId || '', 10);
        if (Number.isFinite(userId)) window.changeUserStatus(userId, actionEl.value);
    });
}

function handleUserTableClick(event, body) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl || !body.contains(actionEl)) return;
    event.stopPropagation();
    const action = actionEl.dataset.action;
    const userId = parseInt(actionEl.dataset.userId || '', 10);
    const mailboxId = parseInt(actionEl.dataset.mailboxId || '', 10);
    const address = actionEl.dataset.address || '';
    if (action === 'toggle-select-user' && Number.isFinite(userId)) window.toggleSelectUser(userId);
    else if (action === 'toggle-send-permission' && Number.isFinite(userId)) window.toggleSendPermission(userId);
    else if (action === 'open-edit-user' && Number.isFinite(userId)) window.openEditUser(userId);
    else if (action === 'delete-user' && Number.isFinite(userId)) window.deleteUser(userId);
    else if (action === 'open-assign-modal' && Number.isFinite(userId)) window.openAssignModal(userId);
    else if (action === 'copy-mailbox' && address) window.copyMailboxAddress(address, event);
    else if (action === 'delete-sub-email' && Number.isFinite(userId) && Number.isFinite(mailboxId)) window.deleteSubEmail(userId, mailboxId);
    else if (action === 'toggle-expand' && Number.isFinite(userId)) window.toggleExpand(userId, event);
}

function bindMailboxTable() {
    const body = document.getElementById('emailListBody');
    if (!body) return;
    body.addEventListener('click', (event) => handleMailboxTableClick(event, body));
}

function handleMailboxTableClick(event, body) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl || !body.contains(actionEl)) return;
    const action = actionEl.dataset.action;
    const id = parseInt(actionEl.dataset.id || '', 10);
    const address = actionEl.dataset.address || '';
    if (action === 'toggle-select-email' && Number.isFinite(id)) window.toggleSelectEmail(id);
    else if (action === 'toggle-email-details' && Number.isFinite(id)) window.toggleEmailDetails(id);
    else if (action === 'open-remark-modal' && Number.isFinite(id)) window.openRemarkModal(id, address);
    else if (action === 'open-pwd-modal' && Number.isFinite(id)) window.openPwdModal(id, address);
    else if (action === 'toggle-login-allowed' && Number.isFinite(id)) window.toggleLoginAllowed(id);
    else if (action === 'open-mailbox-viewer' && address) window.openMailboxViewer(address);
    else if (action === 'copy-mailbox' && address) window.copyMailboxAddress(address, event);
    else if (action === 'delete-single-mailbox' && Number.isFinite(id)) window.deleteSingleMailbox(id);
}

function bindMailboxViewer() {
    const list = document.getElementById('mailboxViewerList');
    if (!list) return;
    list.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl || !list.contains(actionEl)) return;
        const id = parseInt(actionEl.dataset.id || '', 10);
        if (!Number.isFinite(id)) return;
        if (actionEl.dataset.action === 'open-viewer-mail-detail') window.openViewerMailDetail(id);
        else if (actionEl.dataset.action === 'copy-viewer-email-code') window.copyViewerEmailCode(event, id);
        else if (actionEl.dataset.action === 'delete-viewer-email-item') window.deleteViewerEmailItem(event, id);
    });
}
