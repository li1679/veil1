import { adminMailboxAPI, domainAPI, emailAPI, mailboxAPI, userAPI } from './api.js';
import { logout, requireAdmin } from './auth.js';
import {
    animateBatchDelete, animateDelete, closeModal, copyText, escapeHtml,
    formatDate, formatTime, getStorage, initCommon, openIOSAlert,
    openModal, removeStorage, setStorage, showToast
} from './common.js';
import { createComposeController } from './compose.js';
import { createDomainSelector } from './domain-selector.js';
import { createInboxController } from './inbox.js';
import { createAdminHomeController } from './admin-home.js';
import { createAdminMailboxController } from './admin-mailboxes.js';
import { createAdminState } from './admin-state.js';
import { createAdminUsersController } from './admin-users.js';
import {
    applyUserManagementAccessUI,
    closeMobileSidebarIfOpen,
    initEmailPageSizeSelect,
    updateUserInfo,
} from './admin-utils.js';
import { initAdminEventListeners } from './admin-events.js';
import { initThemeSwitch } from './admin-theme.js';

const state = createAdminState();
const domainSelector = createDomainSelector({ domainAPI });
const deps = {
    adminMailboxAPI, mailboxAPI, emailAPI, userAPI,
    showToast, copyText, openModal, closeModal, openIOSAlert,
    animateDelete, animateBatchDelete, escapeHtml, formatTime, formatDate,
    getStorage, setStorage, removeStorage,
};

async function loadInbox() {
    if (!state.currentEmail) return;
    try {
        const response = await emailAPI.getEmails(state.currentEmail);
        const emails = response.emails || [];
        inbox.renderInbox(emails);
        updateHistoryEmailCount(emails.length);
    } catch (error) {
        console.error('Failed to load inbox:', error);
        inbox.renderError(error.message || '加载邮件失败');
    }
}

function updateHistoryEmailCount(emailCount) {
    const historyItem = state.emailHistory.find((item) => item.email === state.currentEmail);
    if (!historyItem || historyItem.emailCount === emailCount) return;
    historyItem.emailCount = emailCount;
    home.renderHistory();
}

const inbox = createInboxController({ emailAPI, loadInbox, getActiveEmail: () => state.currentEmail });
createComposeController({ sendAPI: emailAPI, getFromAddress: () => state.currentEmail, hasSenderName: true });

const home = createAdminHomeController({ state, deps, domainSelector, inbox, loadInbox });
const users = createAdminUsersController({ state, deps, domainSelector });
const mailboxes = createAdminMailboxController({ state, deps, domainSelector, inbox, home });

window.switchView = function(viewName) {
    document.querySelectorAll('.nav-item, .tab-item').forEach((el) => {
        el.classList.toggle('active', el.dataset.view === viewName);
    });
    document.querySelectorAll('.view-section').forEach((el) => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`)?.classList.add('active');
    if (viewName === 'users') users.loadUsers();
    else if (viewName === 'all-emails') mailboxes.loadAllMailboxes();
    closeMobileSidebarIfOpen();
};

async function init() {
    state.currentUser = await requireAdmin();
    if (!state.currentUser) return;
    initCommon();
    updateUserInfo(state);
    applyUserManagementAccessUI(state);
    await domainSelector.loadDomains();
    await home.loadHistory();
    initAdminEventListeners({ logout });
    initThemeSwitch();
    initEmailPageSizeSelect(state);
    users.loadUsers();
}

init();
