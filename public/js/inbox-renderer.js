import { escapeHtml, formatTime } from './common.js';
import { htmlToPreviewText, looksLikeHtml } from './email-content.js';
import { renderUiState } from './ui-state.js';

export function getEmailPreviewText(email) {
    const preview = String(email?.text || email?.preview || '').trim();
    return looksLikeHtml(preview) ? htmlToPreviewText(preview) : preview.replace(/\s+/g, ' ');
}

export function getMailDetailHtml(email) {
    const rawHtml = String(email?.html || '').trim();
    if (rawHtml) return rawHtml;
    const rawText = String(email?.text || '').trim();
    return looksLikeHtml(rawText) ? rawText : '';
}

export function renderInboxList(container, emails) {
    if (emails.length === 0) {
        container.classList.add('inbox-empty');
        container.innerHTML = renderUiState({
            icon: 'ph ph-tray',
            title: '暂无新邮件',
            description: '每 5 秒自动刷新',
            tone: 'empty'
        });
        return;
    }
    container.classList.remove('inbox-empty');
    container.innerHTML = emails.map(renderInboxItem).join('');
}

export function renderInboxError(container, message) {
    container.classList.add('inbox-empty');
    container.innerHTML = renderUiState({
        icon: 'ph ph-warning-circle',
        title: message || '加载失败',
        description: '请稍后重试',
        tone: 'error'
    });
}

function renderInboxItem(email) {
    const fromRaw = email.from_name || email.from_address || 'U';
    const subjectRaw = email.subject || '(无主题)';
    const previewRaw = getEmailPreviewText(email).slice(0, 120);
    const avatarChar = String(fromRaw || 'U').trim().charAt(0).toUpperCase();
    return `
        <div class="mail-item" role="button" tabindex="0" data-action="open-mail-detail" data-id="${email.id}">
            <div class="mail-avatar">${escapeHtml(avatarChar || 'U')}</div>
            <div class="mail-content">
                <div class="mail-from">${escapeHtml(fromRaw)}</div>
                <div class="mail-subject">${escapeHtml(subjectRaw)}</div>
                <div class="mail-preview">${escapeHtml(previewRaw)}</div>
            </div>
            <div class="mail-meta">
                <div class="mail-time">${formatTime(email.received_at)}</div>
                <div class="mail-actions">
                    ${renderInboxActionButton('copy-email-code', email.id, '复制验证码', 'ph-bold ph-copy')}
                    ${renderInboxActionButton('delete-email-item', email.id, '删除邮件', 'ph-bold ph-trash', ' delete')}
                </div>
            </div>
        </div>
    `;
}

function renderInboxActionButton(action, id, title, iconClass, extraClass = '') {
    return `
        <button class="action-btn${extraClass}" type="button" data-action="${action}" data-id="${id}" title="${title}">
            <i class="${iconClass}"></i>
        </button>
    `;
}
