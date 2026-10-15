import { domainAPI, emailAPI, mailboxAPI, quotaAPI } from './api.js';
import { canSend, logout, requireUser } from './auth.js';
import {
    animateDelete, copyText, escapeHtml, formatTime, getStorage,
    initCommon, openIOSAlert, removeStorage, setStorage, showToast, reportPageError
} from './common.js';
import { createComposeController } from './compose.js';
import { createDomainSelector } from './domain-selector.js';
import { createInboxController } from './inbox.js';
import { createUserHomeController } from './user-home.js';
import { createUserPageState } from './user-state.js';
import { initUserEventListeners } from './user-events.js';

import { mountHomeTemplate } from './home-template.js';
import { mountSharedOverlays } from './shared-overlays.js';

mountHomeTemplate(document.querySelector('.user-content'), 'User');
mountSharedOverlays();

const state = createUserPageState();
const domainSelector = createDomainSelector({ domainAPI });

function updateUserInfo() {
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const quotaEl = document.getElementById('quotaDisplay');
    const sendBtn = document.getElementById('sendActionBtn');
    if (avatarEl && state.currentUser) avatarEl.textContent = (state.currentUser.name || state.currentUser.username || 'U').substring(0, 2).toUpperCase();
    if (nameEl && state.currentUser) nameEl.textContent = state.currentUser.name || state.currentUser.username;
    if (quotaEl && state.currentUser) quotaEl.textContent = `已生成 ${state.currentUser.quotaUsed ?? 0}/${state.currentUser.quota ?? 10} 个邮箱`;
    if (sendBtn) sendBtn.classList.toggle('is-allowed', canSend(state.currentUser));
    home.syncGenerateButton();
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
        showToast(error.message || '配额刷新失败，稍后重试');
    }
}


const inbox = createInboxController({ emailAPI, getActiveEmail: () => state.currentEmail, onEmails: (emails, address, total) => home.updateEmailCount(address, total) });

createComposeController({
    sendAPI: emailAPI,
    getFromAddress: () => state.currentEmail,
    canSend: () => canSend(state.currentUser),
});

const home = createUserHomeController({
    state,
    domainSelector,
    inbox,
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
    initUserEventListeners({ logout, inbox });
    await domainSelector.loadDomains();
    home.syncGenerateButton();
    await home.loadHistory();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshQuota(); });
}

init().catch(reportPageError);
