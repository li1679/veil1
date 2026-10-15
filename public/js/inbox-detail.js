import { closeModal, escapeHtml, formatTime, openModal, sanitizeEmailHtml } from './common.js';
import { getMailDetailHtml } from './inbox-renderer.js';
import { renderUiState } from './ui-state.js';

let controller = null;
let observer = null;
let bound = false;

function cancelDetailLoad() {
    controller?.abort(); controller = null;
    observer?.disconnect(); observer = null;
    document.getElementById('mailDetailBody').replaceChildren();
}

export async function openMailDetailById(id, emailAPI) {
    const modal = document.getElementById('mailDetailModal');
    if (!bound) { modal.addEventListener('modal:closed', cancelDetailLoad); bound = true; }
    cancelDetailLoad();
    const request = new AbortController();
    controller = request;
    const body = document.getElementById('mailDetailBody');
    document.getElementById('mailDetailSubject').textContent = '加载邮件中…';
    for (const name of ['Avatar', 'From', 'To', 'Time']) document.getElementById(`mailDetail${name}`).textContent = '';
    body.innerHTML = renderUiState({ title: '正在读取邮件…', tone: 'loading' });
    body.setAttribute('aria-busy', 'true');
    openModal('mailDetailModal');
    try {
        const response = await emailAPI.getEmail(id, { signal: request.signal });
        if (controller !== request) return null;
        const email = response.email || response;
        const from = email.from_name || email.from_address || '未知发件人';
        document.getElementById('mailDetailSubject').textContent = email.subject || '(无主题)';
        document.getElementById('mailDetailAvatar').textContent = String(from).charAt(0).toUpperCase();
        document.getElementById('mailDetailFrom').textContent = from;
        document.getElementById('mailDetailTo').textContent = email.to_address || '';
        document.getElementById('mailDetailTime').textContent = formatTime(email.received_at);
        renderMailDetailBody(body, email);
    } catch (error) {
        if (error.name === 'AbortError' || controller !== request) return null;
        body.innerHTML = renderUiState({ title: error.message || '加载失败', description: '关闭后重新打开邮件即可重试', tone: 'error' });
        document.getElementById('mailDetailSubject').textContent = '无法读取邮件';
        return error;
    } finally { if (controller === request) body.setAttribute('aria-busy', 'false'); }
    return null;
}

function renderMailDetailBody(body, email) {
    const html = getMailDetailHtml(email);
    if (!html) { body.innerHTML = `<pre>${escapeHtml(email.text || '')}</pre>`; return; }
    const frame = document.createElement('iframe');
    frame.className = 'mail-detail-frame';
    frame.title = '邮件正文';
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox allow-same-origin');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    const sanitized = sanitizeEmailHtml(html);
    frame.srcdoc = /<html[\s>]|<!doctype/i.test(sanitized) ? sanitized : `<!doctype html><html><head><meta charset="utf-8"></head><body>${sanitized}</body></html>`;
    frame.addEventListener('load', () => {
        if (!frame.isConnected) return;
        const doc = frame.contentDocument;
        const resize = () => {
            const height = `${Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0, 320)}px`;
            if (frame.style.height !== height) frame.style.height = height;
        };
        resize();
        doc.addEventListener('load', resize, true);
        observer = new ResizeObserver(resize);
        if (doc.body) observer.observe(doc.body);
    });
    body.replaceChildren(frame);
}

export function closeMailDetailModal() { closeModal('mailDetailModal'); }
