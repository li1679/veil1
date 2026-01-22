/**
 * Veil - 邮箱用户页面逻辑
 * 只能查看分配的邮箱收件箱
 */

import { mailboxUserAPI } from './api.js';
import { requireMailboxUser, logout, getCurrentUser, canSend } from './auth.js';
import {
    showToast, copyText, openModal, closeModal, initCommon,
    formatTime, extractCode
} from './common.js';

// ============================================
// 全局状态
// ============================================
let currentUser = null;
let mailboxAddress = null;

// 轮询
let inboxPollInterval = null;
const POLL_INTERVAL = 10000;

// ============================================
// 初始化
// ============================================
async function init() {
    // 权限检查
    currentUser = await requireMailboxUser();
    if (!currentUser) return;

    // 初始化公共功能
    initCommon();

    // 获取邮箱地址
    mailboxAddress = currentUser.mailboxAddress;

    // 更新界面
    updateUI();

    // 加载邮件
    startInboxPoll();
}

// ============================================
// 更新界面
// ============================================
function updateUI() {
    // 显示邮箱地址
    const addressEl = document.getElementById('mailboxAddress');
    if (addressEl) {
        addressEl.textContent = mailboxAddress || '未知邮箱';
    }

    // 发送按钮权限
    const sendBtn = document.getElementById('sendMailBtn');
    if (sendBtn) {
        if (canSend(currentUser)) {
            sendBtn.style.display = 'flex';
        } else {
            sendBtn.style.display = 'none';
        }
    }
}

// ============================================
// 邮件操作
// ============================================
window.copyMailbox = function() {
    if (mailboxAddress) {
        copyText(mailboxAddress);
    }
};

window.refreshInbox = async function() {
    await loadInbox();
    showToast('已刷新');
};

// ============================================
// 收件箱
// ============================================
async function loadInbox() {
    if (!mailboxAddress) return;

    try {
        const response = await mailboxUserAPI.getMyEmails();
        const emails = response.emails || [];
        renderInbox(emails);

        // 更新邮件数量
        const countEl = document.getElementById('emailCount');
        if (countEl) {
            countEl.textContent = `共 ${emails.length} 封`;
        }
    } catch (error) {
        console.error('Failed to load inbox:', error);
        showToast('加载邮件失败');
    }
}

function renderInbox(emails) {
    const container = document.getElementById('inboxContainer');
    if (!container) return;

    if (emails.length === 0) {
        container.innerHTML = `
            <div class="inbox-empty">
                <i class="ph ph-tray"></i>
                <span>暂无新邮件</span>
            </div>
        `;
        return;
    }

    container.innerHTML = emails.map(email => {
        const code = extractCode(email.subject + ' ' + (email.text || ''));
        return `
            <div class="mail-item" onclick="openMailDetail(${email.id})">
                <div class="mail-avatar">${(email.from_name || email.from_address || 'U')[0].toUpperCase()}</div>
                <div class="mail-content">
                    <div class="mail-header">
                        <span class="mail-from">${email.from_name || email.from_address}</span>
                        <span class="mail-time">${formatTime(email.received_at)}</span>
                    </div>
                    <div class="mail-subject">${email.subject || '(无主题)'}</div>
                    <div class="mail-preview">${email.text ? email.text.substring(0, 100) : ''}</div>
                    ${code ? `
                        <div class="code-box" onclick="event.stopPropagation(); copyText('${code}')">
                            <i class="ph-bold ph-copy"></i>
                            <span>${code}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 邮件详情
window.openMailDetail = async function(id) {
    try {
        const response = await mailboxUserAPI.getEmail(id);
        const email = response.email || response;

        document.getElementById('mailDetailSubject').textContent = email.subject || '(无主题)';
        document.getElementById('mailDetailAvatar').textContent = (email.from_name || email.from_address || 'U')[0].toUpperCase();
        document.getElementById('mailDetailFrom').textContent = email.from_name || email.from_address;
        document.getElementById('mailDetailTo').textContent = email.to_address;
        document.getElementById('mailDetailTime').textContent = formatTime(email.received_at);
        document.getElementById('mailDetailBody').innerHTML = email.html || `<pre>${email.text || ''}</pre>`;

        openModal('mailDetailModal');
    } catch (error) {
        showToast(error.message || '加载失败');
    }
};

window.closeMailDetail = function() {
    closeModal('mailDetailModal');
};

// 收件箱轮询
function startInboxPoll() {
    stopInboxPoll();
    loadInbox();
    inboxPollInterval = setInterval(loadInbox, POLL_INTERVAL);
}

function stopInboxPoll() {
    if (inboxPollInterval) {
        clearInterval(inboxPollInterval);
        inboxPollInterval = null;
    }
}

// ============================================
// 发送邮件
// ============================================
window.openSendModal = function() {
    if (!canSend(currentUser)) {
        showToast('您没有发送邮件的权限');
        return;
    }

    document.getElementById('toInput').value = '';
    document.getElementById('subjectInput').value = '';
    document.getElementById('contentInput').value = '';
    checkComposeInput();
    openModal('sendModalOverlay');
};

window.closeSendModal = function() {
    closeModal('sendModalOverlay');
};

window.checkComposeInput = function() {
    const to = document.getElementById('toInput').value.trim();
    const subject = document.getElementById('subjectInput').value.trim();
    const btn = document.getElementById('sendBtn');

    if (to && subject) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
};

window.doSendEmail = async function() {
    const to = document.getElementById('toInput').value.trim();
    const subject = document.getElementById('subjectInput').value.trim();
    const content = document.getElementById('contentInput').value.trim();

    if (!to || !subject) {
        showToast('请填写收件人和主题');
        return;
    }

    try {
        await mailboxUserAPI.send(to, subject, content);
        closeSendModal();
        showToast('邮件已发送');
    } catch (error) {
        showToast(error.message || '发送失败');
    }
};

// ============================================
// 登出
// ============================================
window.handleLogout = function() {
    logout();
};

// ============================================
// 启动
// ============================================
init();
