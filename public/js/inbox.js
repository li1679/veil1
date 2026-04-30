import { showToast, copyText, extractCode } from './common.js';
import { closeMailDetailModal, openMailDetailById } from './inbox-detail.js';
import { getEmailPreviewText, renderInboxError, renderInboxList } from './inbox-renderer.js';

const POLL_INTERVAL = 5000;

export function createInboxController(opts) {
    const state = { currentInboxEmails: [], inboxPollInterval: null, inboxActionsBound: false };
    const ctx = { ...opts, state };
    registerGlobals(ctx);
    return {
        renderInbox: (emails) => renderInbox(ctx, emails),
        renderError: (message) => renderError(message),
        bindInboxActions: () => bindInboxActions(ctx),
        startInboxPoll: () => startInboxPoll(ctx),
        stopInboxPoll: () => stopInboxPoll(ctx),
        getInboxEmailById: (id) => getInboxEmailById(ctx, id),
        getEmailVerificationCode,
        getCurrentEmails: () => state.currentInboxEmails,
    };
}

function getInboxEmailById(ctx, id) {
    return (ctx.state.currentInboxEmails || []).find((item) => String(item.id) == String(id));
}

function getEmailVerificationCode(email) {
    return email?.verification_code || extractCode(`${email?.subject || ''} ${getEmailPreviewText(email)}`);
}

function renderInbox(ctx, emails) {
    const container = document.getElementById('inboxContainer');
    if (!container) return;
    ctx.state.currentInboxEmails = Array.isArray(emails) ? emails : [];
    renderInboxList(container, ctx.state.currentInboxEmails);
}

function renderError(message) {
    const container = document.getElementById('inboxContainer');
    if (!container) return;
    renderInboxError(container, message);
}

function copyEmailCode(ctx, event, id) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const code = getEmailVerificationCode(getInboxEmailById(ctx, id));
    if (!code) return showToast('未找到验证码');
    copyText(`${code}`);
    showToast(`已复制验证码: ${code}`);
}

async function deleteEmailItem(ctx, event, id) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    try {
        await ctx.emailAPI.delete(id);
        showToast('已删除');
        await ctx.loadInbox();
    } catch (error) {
        showToast(error.message || '删除失败');
    }
}

async function openMailDetail(ctx, id) {
    const error = await openMailDetailById(id, ctx.emailAPI);
    if (error) showToast(error.message || '加载失败');
}

function handleInboxClick(ctx, event) {
    const container = document.getElementById('inboxContainer');
    const actionEl = event.target.closest('[data-action]');
    if (!container || !actionEl || !container.contains(actionEl)) return;
    const id = parseInt(actionEl.dataset.id || '', 10);
    if (!Number.isFinite(id)) return;
    if (actionEl.dataset.action === 'open-mail-detail') openMailDetail(ctx, id);
    else if (actionEl.dataset.action === 'copy-email-code') copyEmailCode(ctx, event, id);
    else if (actionEl.dataset.action === 'delete-email-item') deleteEmailItem(ctx, event, id);
}

function bindInboxActions(ctx) {
    const container = document.getElementById('inboxContainer');
    if (!container || ctx.state.inboxActionsBound) return;
    container.addEventListener('click', (event) => handleInboxClick(ctx, event));
    ctx.state.inboxActionsBound = true;
}

function handleVisibilityChange(ctx) {
    if (document.hidden) {
        stopPollTimer(ctx);
        return;
    }
    if (!ctx.state.inboxPollInterval && ctx.getActiveEmail()) {
        ctx.loadInbox();
        ctx.state.inboxPollInterval = setInterval(ctx.loadInbox, POLL_INTERVAL);
    }
}

function startInboxPoll(ctx) {
    stopInboxPoll(ctx);
    document.addEventListener('visibilitychange', ctx.visibilityHandler ||= () => handleVisibilityChange(ctx));
    handleVisibilityChange(ctx);
}

function stopInboxPoll(ctx) {
    stopPollTimer(ctx);
    if (ctx.visibilityHandler) document.removeEventListener('visibilitychange', ctx.visibilityHandler);
}

function stopPollTimer(ctx) {
    if (!ctx.state.inboxPollInterval) return;
    clearInterval(ctx.state.inboxPollInterval);
    ctx.state.inboxPollInterval = null;
}

async function refreshInbox(ctx) {
    await ctx.loadInbox();
    showToast('已刷新');
}

function registerGlobals(ctx) {
    window.openMailDetail = (id) => openMailDetail(ctx, id);
    window.closeMailDetail = closeMailDetailModal;
    window.copyEmailCode = (event, id) => copyEmailCode(ctx, event, id);
    window.deleteEmailItem = (event, id) => deleteEmailItem(ctx, event, id);
    window.refreshInbox = () => refreshInbox(ctx);
}
