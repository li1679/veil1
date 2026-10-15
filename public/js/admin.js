import { actions } from './page-actions.js';
import { adminMailboxAPI, domainAPI, emailAPI, mailboxAPI, userAPI } from './api.js';
import { logout, requireAdmin } from './auth.js';
import {
    animateBatchDelete, animateDelete, closeModal, copyText, escapeHtml,
    formatDate, formatTime, getStorage, initCommon, openIOSAlert,
    openModal, removeStorage, setStorage, showToast, reportPageError
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
    initEmailPageSizeSelect,
    updateUserInfo,
} from './admin-utils.js';
import { initAdminEventListeners } from './admin-events.js';
import { initThemeSwitch } from './admin-theme.js';
import { mountHomeTemplate } from './home-template.js';
import { toggleTheme } from './theme.js';
import { mountSharedOverlays } from './shared-overlays.js';

mountHomeTemplate(document.querySelector('#view-home .content-body'), 'StrictAdmin');
mountSharedOverlays();
actions.logout = logout;
actions.toggleTheme = toggleTheme;
actions.toggleSendSwitch = (element) => {
    element.classList.toggle('on');
    element.setAttribute('aria-checked', String(element.classList.contains('on')));
};

const state = createAdminState();
const domainSelector = createDomainSelector({ domainAPI, role: 'StrictAdmin' });
const deps = {
    adminMailboxAPI, mailboxAPI, emailAPI, userAPI,
    showToast, copyText, openModal, closeModal, openIOSAlert,
    animateDelete, animateBatchDelete, escapeHtml, formatTime, formatDate,
    getStorage, setStorage, removeStorage,
};


const inbox = createInboxController({ emailAPI, getActiveEmail: () => state.currentEmail, onEmails: (emails, address, total) => home.updateEmailCount(address, total) });
createComposeController({ sendAPI: emailAPI, getFromAddress: () => state.currentEmail });

const home = createAdminHomeController({ state, deps, domainSelector, inbox });
const users = createAdminUsersController({ state, deps, domainSelector });
const mailboxes = createAdminMailboxController({ state, deps, domainSelector, inbox, home });

actions.switchView = function(viewName) {
    document.querySelectorAll('.nav-item, .tab-item').forEach((el) => {
        el.classList.toggle('active', el.dataset.view === viewName);
        if (el.dataset.view === viewName) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view-section').forEach((el) => el.classList.remove('active'));
    if (viewName === 'home' && state.currentEmail) inbox.startInboxPoll();
    else inbox.stopInboxPoll();
    document.getElementById(`view-${viewName}`)?.classList.add('active');
    if (viewName === 'users') users.loadUsers();
    else if (viewName === 'all-emails') mailboxes.loadAllMailboxes();
};

async function init() {
    state.currentUser = await requireAdmin();
    if (!state.currentUser) return;
    initCommon();
    updateUserInfo(state);
    applyUserManagementAccessUI(state);
    initAdminEventListeners({ logout, inbox });
    initThemeSwitch();
    initEmailPageSizeSelect(state);
    void users.loadUserFilter();
    await domainSelector.loadDomains();
    home.syncGenerateButton();
    await home.loadHistory();
}

init().catch(reportPageError);
