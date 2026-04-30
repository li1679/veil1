import { getMailboxViewerPreviewText } from './admin-utils.js';

export function createMailboxViewerController(args) {
    const ctx = { ...args };
    registerViewerGlobals(ctx);
    return {
        loadMailboxViewer: () => loadMailboxViewer(ctx),
        renderMailboxViewer: (emails) => renderMailboxViewer(ctx, emails),
    };
}

function getViewerEmailById(ctx, id) {
    return (ctx.state.viewerEmails || []).find((item) => String(item.id) == String(id));
}

function setMailboxViewerLoading() {
    const list = document.getElementById('mailboxViewerList');
    if (list) list.innerHTML = '<div class="inbox-empty"><i class="ph ph-tray"></i><span>加载中...</span></div>';
    const countEl = document.getElementById('mailboxViewerCount');
    if (countEl) countEl.textContent = '加载中...';
}

function renderMailboxViewer(ctx, emails) {
    const list = document.getElementById('mailboxViewerList');
    if (!list) return;
    ctx.state.viewerEmails = Array.isArray(emails) ? emails : [];
    list.innerHTML = ctx.state.viewerEmails.length === 0
        ? '<div class="inbox-empty"><i class="ph ph-tray"></i><span>暂无新邮件</span></div>'
        : ctx.state.viewerEmails.map((email) => renderViewerEmailItem(ctx, email)).join('');
    const countEl = document.getElementById('mailboxViewerCount');
    if (countEl) countEl.textContent = `共 ${ctx.state.viewerEmails.length} 封`;
}

function renderViewerEmailItem(ctx, email) {
    const fromRaw = email.from_name || email.from_address || 'U';
    const subjectRaw = email.subject || '(无主题)';
    const previewRaw = getMailboxViewerPreviewText(email).slice(0, 120);
    const avatarChar = String(fromRaw || 'U').trim().charAt(0).toUpperCase();
    return `
        <div class="mail-item" role="button" tabindex="0" data-action="open-viewer-mail-detail" data-id="${email.id}">
            <div class="mail-avatar">${ctx.deps.escapeHtml(avatarChar || 'U')}</div>
            <div class="mail-content">
                <div class="mail-from">${ctx.deps.escapeHtml(fromRaw)}</div>
                <div class="mail-subject">${ctx.deps.escapeHtml(subjectRaw)}</div>
                <div class="mail-preview">${ctx.deps.escapeHtml(previewRaw)}</div>
            </div>
            <div class="mail-meta">
                <div class="mail-time">${ctx.deps.formatTime(email.received_at)}</div>
                <div class="mail-actions">
                    <button class="action-btn" type="button" data-action="copy-viewer-email-code" data-id="${email.id}" title="复制验证码"><i class="ph-bold ph-copy"></i></button>
                    <button class="action-btn delete" type="button" data-action="delete-viewer-email-item" data-id="${email.id}" title="删除邮件"><i class="ph-bold ph-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

async function loadMailboxViewer(ctx) {
    if (!ctx.state.viewerMailbox) return;
    setMailboxViewerLoading();
    try {
        const response = await ctx.deps.emailAPI.getEmails(ctx.state.viewerMailbox);
        renderMailboxViewer(ctx, response.emails || []);
    } catch (error) {
        console.error('Failed to load mailbox viewer:', error);
        renderViewerError();
        ctx.deps.showToast('加载邮件失败');
    }
}

function renderViewerError() {
    const list = document.getElementById('mailboxViewerList');
    if (list) list.innerHTML = '<div class="inbox-empty"><i class="ph ph-warning-circle"></i><span>加载失败</span></div>';
}

async function openMailboxViewer(ctx, address) {
    ctx.state.viewerMailbox = address;
    const addressEl = document.getElementById('mailboxViewerAddress');
    if (addressEl) addressEl.textContent = address || '';
    ctx.deps.openModal('mailboxViewerModal');
    await loadMailboxViewer(ctx);
}

function closeMailboxViewer(ctx) {
    ctx.state.viewerMailbox = null;
    ctx.state.viewerEmails = [];
    ctx.deps.closeModal('mailboxViewerModal');
}

async function openViewerMailDetail(ctx, id) {
    closeMailboxViewer(ctx);
    await window.openMailDetail(id);
}

function refreshMailboxViewer(ctx) {
    if (ctx.state.viewerMailbox) loadMailboxViewer(ctx);
}

function copyViewerEmailCode(ctx, event, id) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const code = ctx.inbox.getEmailVerificationCode(getViewerEmailById(ctx, id));
    if (!code) return ctx.deps.showToast('无法复制');
    ctx.deps.copyText(code);
}

async function deleteViewerEmailItem(ctx, event, id) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    try {
        await ctx.deps.emailAPI.delete(id);
        ctx.deps.showToast('已删除');
        await loadMailboxViewer(ctx);
    } catch (error) {
        ctx.deps.showToast(error.message || '删除失败');
    }
}

function registerViewerGlobals(ctx) {
    window.openMailboxViewer = (address) => openMailboxViewer(ctx, address);
    window.closeMailboxViewer = () => closeMailboxViewer(ctx);
    window.openViewerMailDetail = (id) => openViewerMailDetail(ctx, id);
    window.refreshMailboxViewer = () => refreshMailboxViewer(ctx);
    window.copyViewerEmailCode = (event, id) => copyViewerEmailCode(ctx, event, id);
    window.deleteViewerEmailItem = (event, id) => deleteViewerEmailItem(ctx, event, id);
}
