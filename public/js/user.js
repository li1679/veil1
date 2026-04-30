import { domainAPI, emailAPI, mailboxAPI, quotaAPI } from './api.js';
import { canSend, logout, requireUser } from './auth.js';
import {
    animateDelete, copyText, escapeHtml, formatTime, getStorage,
    initCommon, openIOSAlert, removeStorage, setStorage, showToast
} from './common.js';
import { createComposeController } from './compose.js';
import { createDomainSelector } from './domain-selector.js';
import { createInboxController } from './inbox.js';
import { createUserHomeController } from './user-home.js';
import { createUserPageState } from './user-state.js';
import { initUserEventListeners } from './user-events.js';

const state = createUserPageState();
const domainSelector = createDomainSelector({ domainAPI });

function updateUserInfo() {
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const quotaEl = document.getElementById('quotaDisplay');
    const sendBtn = document.getElementById('sendActionBtn');
    if (avatarEl && state.currentUser) avatarEl.textContent = (state.currentUser.name || state.currentUser.username || 'U').substring(0, 2).toUpperCase();
    if (nameEl && state.currentUser) nameEl.textContent = state.currentUser.name || state.currentUser.username;
    if (quotaEl && state.currentUser) quotaEl.textContent = `已生成 ${state.currentUser.quotaUsed || 0}/${state.currentUser.quota || 10} 个邮箱`;
    if (sendBtn) sendBtn.classList.toggle('is-allowed', canSend(state.currentUser));
}

async function refreshQuota() {
    if (!state.currentUser) return;
    try {
        const quota = await quotaAPI.get();
        if (quota && typeof quota.used !== 'undefined') {
            state.currentUser.quotaUsed = quota.used;
            state.currentUser.quota = quota.limit;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Failed to refresh quota:', error);
    }
}

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

createComposeController({
    sendAPI: emailAPI,
    getFromAddress: () => state.currentEmail,
    canSend: () => canSend(state.currentUser),
    hasSenderName: true,
});

const home = createUserHomeController({
    state,
    domainSelector,
    inbox,
    loadInbox,
    refreshQuota,
    deps: {
        mailboxAPI, emailAPI, showToast, copyText, openIOSAlert, animateDelete,
        formatTime, escapeHtml, getStorage, setStorage, removeStorage, updateUserInfo,
    },
});

async function init() {
    state.currentUser = await requireUser();
    if (!state.currentUser) return;
    initCommon();
    updateUserInfo();
    await refreshQuota();
    await domainSelector.loadDomains();
    await home.loadHistory();
    initUserEventListeners({ logout, inbox });
}

init();
