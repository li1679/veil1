import { escapeHtml, formatTime, extractCode } from './common.js';
import { htmlToPreviewText, looksLikeHtml } from './email-content.js';
import { renderUiState } from './ui-state.js';

export function getEmailPreviewText(email) {
    const preview = String(email?.text || email?.preview || '').trim();
    return looksLikeHtml(preview) ? htmlToPreviewText(preview) : preview.replace(/\s+/g, ' ');
}

export function getMailDetailHtml(email) {
    const html = String(email?.html || '').trim();
    if (html) return html;
    const text = String(email?.text || '').trim();
    return looksLikeHtml(text) ? text : '';
}

export function renderInboxList(container, emails, command = {}) {
    container.classList.toggle('inbox-empty', emails.length === 0);
    container.innerHTML = emails.length
        ? emails.map((email) => renderInboxItem(email, command)).join('')
        : renderUiState({ icon: 'ph ph-tray', title: '等待新邮件', description: '新邮件自动更新，验证码可直接复制', tone: 'empty' });
}

export function renderInboxError(container, message) {
    container.classList.add('inbox-empty');
    container.innerHTML = renderUiState({ icon: 'ph ph-warning-circle', title: message || '加载失败', description: '可点击刷新重试；连接恢复后继续收件', tone: 'error' });
}

function renderInboxItem(email, { open = 'open-mail-detail', copy = 'copy-email-code', remove = 'delete-email-item' } = {}) {
    const from = email.from_name || email.from_address || '未知发件人';
    const preview = getEmailPreviewText(email).slice(0, 120);
    const code = email.verification_code || extractCode(`${email.subject || ''} ${preview}`);
    const id = escapeHtml(email.id);
    return `<div class="mail-item ${code ? 'has-code' : ''}" role="button" tabindex="0" data-action="${open}" data-id="${id}">
        <div class="mail-avatar">${escapeHtml(String(from).trim().charAt(0).toUpperCase())}</div>
        <div class="mail-content"><div class="mail-from">${escapeHtml(from)}</div><div class="mail-subject">${escapeHtml(email.subject || '(无主题)')}</div><div class="mail-preview">${escapeHtml(preview)}</div></div>
        <div class="mail-meta"><div class="mail-time">${formatTime(email.received_at)}</div><div class="mail-actions">
            ${code ? `<button class="code-copy" type="button" data-action="${copy}" data-id="${id}" aria-label="复制验证码 ${escapeHtml(code)}"><span>${escapeHtml(code)}</span><i class="ph-bold ph-copy" aria-hidden="true"></i></button>` : ''}
            <button class="action-btn delete" type="button" data-action="${remove}" data-id="${id}" title="删除邮件" aria-label="删除邮件"><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
        </div></div>
    </div>`;
}
