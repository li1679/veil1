import { actions } from './page-actions.js';
/**
 * Veil - 邮箱用户页面逻辑
 * 只能查看分配的邮箱收件箱
 */

import { mailboxUserAPI } from './api.js';
import { requireMailboxUser, logout, canSend } from './auth.js';
import { copyText, initCommon, reportPageError } from './common.js';
import { createInboxController } from './inbox.js';
import { createComposeController } from './compose.js';
import { mountSharedOverlays } from './shared-overlays.js';
mountSharedOverlays();

// ============================================
// 全局状态
// ============================================
let currentUser = null;
let mailboxAddress = null;

// ============================================
// 初始化共享控制器
// ============================================
const inbox = createInboxController({
    emailAPI: {
        getEmail: (id, options) => mailboxUserAPI.getEmail(id, options),
        delete: (id) => mailboxUserAPI.deleteEmail(id),
        getEmails: (_address, options) => mailboxUserAPI.getMyEmails(options),
    },
    getActiveEmail: () => mailboxAddress,
});

createComposeController({
    sendAPI: mailboxUserAPI,
    getFromAddress: () => mailboxAddress,
    canSend: () => canSend(currentUser),
});

// ============================================
// 初始化
// ============================================
async function init() {
    currentUser = await requireMailboxUser();
    if (!currentUser) return;

    initCommon();
    inbox.bindInboxActions();

    mailboxAddress = currentUser.mailboxAddress;
    updateUI();
    inbox.startInboxPoll();
}

// ============================================
// 更新界面
// ============================================
function updateUI() {
    const addressEl = document.getElementById('mailboxAddress');
    if (addressEl) {
        addressEl.textContent = mailboxAddress || '未知邮箱';
    }

    const sendBtn = document.getElementById('sendMailBtn');
    if (sendBtn) {
        sendBtn.classList.toggle('is-allowed', canSend(currentUser));
    }
}

// ============================================
// 页面专有函数
// ============================================
actions.copyMailbox = function() {
    if (mailboxAddress) {
        copyText(mailboxAddress);
    }
};

actions.handleLogout = function() {
    logout();
};

// ============================================
// 启动
// ============================================
init().catch(reportPageError);
