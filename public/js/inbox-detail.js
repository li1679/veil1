import { closeModal, escapeHtml, formatTime, openModal, sanitizeEmailHtml } from './common.js';
import { getMailDetailHtml } from './inbox-renderer.js';

export async function openMailDetailById(id, emailAPI) {
    try {
        const response = await emailAPI.getEmail(id);
        const email = response.email || response;
        fillMailDetailHeader(email);
        const detailBody = document.getElementById('mailDetailBody');
        if (detailBody) renderMailDetailBody(detailBody, email);
        openModal('mailDetailModal');
    } catch (error) {
        return error;
    }
    return null;
}

function fillMailDetailHeader(email) {
    document.getElementById('mailDetailSubject').textContent = email.subject || '(无主题)';
    document.getElementById('mailDetailAvatar').textContent = (email.from_name || email.from_address || 'U')[0].toUpperCase();
    document.getElementById('mailDetailFrom').textContent = email.from_name || email.from_address;
    document.getElementById('mailDetailTo').textContent = email.to_address;
    document.getElementById('mailDetailTime').textContent = formatTime(email.received_at);
}

function buildMailDetailDocument(rawHtml) {
    const html = String(rawHtml || '').trim();
    if (!html) return '';
    if (/<html[\s>]/i.test(html) || /<!doctype/i.test(html)) return html;
    return `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}

function resizeMailFrame(frame) {
    const doc = frame?.contentDocument;
    if (!doc) return;
    const root = doc.documentElement;
    const body = doc.body;
    const height = Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0, 320);
    frame.style.height = `${height}px`;
}

function renderMailDetailBody(detailBody, email) {
    const rawHtml = getMailDetailHtml(email);
    if (!rawHtml) {
        detailBody.innerHTML = `<pre>${escapeHtml(email?.text || '')}</pre>`;
        return;
    }
    const frame = createMailFrame(rawHtml);
    detailBody.replaceChildren(frame);
    requestAnimationFrame(() => resizeMailFrame(frame));
}

function createMailFrame(rawHtml) {
    const frame = document.createElement('iframe');
    frame.className = 'mail-detail-frame';
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox allow-same-origin');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.width = '100%';
    frame.style.minHeight = '320px';
    frame.style.border = '0';
    frame.style.background = 'transparent';
    frame.srcdoc = buildMailDetailDocument(sanitizeEmailHtml(rawHtml));
    frame.addEventListener('load', () => {
        resizeMailFrame(frame);
        setTimeout(() => resizeMailFrame(frame), 60);
    });
    return frame;
}

export function closeMailDetailModal() {
    closeModal('mailDetailModal');
}
