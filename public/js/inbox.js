import { actions } from './page-actions.js';
import { showToast, copyText, extractCode } from './common.js';
import { closeMailDetailModal, openMailDetailById } from './inbox-detail.js';
import { getEmailPreviewText, renderInboxError, renderInboxList } from './inbox-renderer.js';

const POLL_INTERVAL = 5000;
const MAX_IDLE_INTERVAL = 30000;

export function createInboxController({ emailAPI, getActiveEmail, onEmails }) {
    let emails = [];
    let signature = null;
    let displayedAddress = null;
    let timer = null;
    let pending = null;
    let generation = 0;
    let running = false;
    let delay = POLL_INTERVAL;
    const deleting = new Set();

    function setStatus(message, tone = '') {
        const status = document.getElementById('inboxStatus');
        if (status) { status.textContent = message; status.dataset.tone = tone; }
        document.getElementById('inboxContainer')?.setAttribute('aria-busy', String(tone === 'loading'));
        document.querySelectorAll('[data-command-click="refreshInbox"]').forEach((button) => { button.disabled = tone === 'loading'; });
    }
    function renderInbox(next) {
        const normalized = Array.isArray(next) ? next : [];
        const nextSignature = JSON.stringify(normalized);
        if (signature === nextSignature) return false;
        emails = normalized; signature = nextSignature;
        const container = document.getElementById('inboxContainer');
        if (container) renderInboxList(container, emails);
        return true;
    }
    function clearTimer() { clearTimeout(timer); timer = null; }
    function schedule() { clearTimer(); if (running && !document.hidden && getActiveEmail()) timer = setTimeout(() => void loadInbox(), delay); }
    function loadInbox() {
        const address = getActiveEmail();
        if (!address || document.hidden) return Promise.resolve(false);
        if (pending?.address === address) return pending.promise;
        pending?.controller.abort(); clearTimer();
        const epoch = generation;
        const controller = new AbortController();
        setStatus('刷新中…', 'loading');
        const promise = (async () => {
            try {
                const response = await emailAPI.getEmails(address, { signal: controller.signal });
                if (epoch !== generation || address !== getActiveEmail()) return false;
                const changed = renderInbox(response.emails || []);
                displayedAddress = address;
                delay = changed ? POLL_INTERVAL : Math.min(delay + POLL_INTERVAL, MAX_IDLE_INTERVAL);
                onEmails?.(emails, address, emails.length);
                const count = document.getElementById('emailCount');
                if (count) count.textContent = `最近 ${emails.length} 封`;
                setStatus(`已更新 · ${delay / 1000} 秒后刷新`);
                return true;
            } catch (error) {
                if (error.name === 'AbortError' || epoch !== generation || address !== getActiveEmail()) return false;
                delay = Math.max(Math.min(delay * 2, 60000), (error.retryAfter || 0) * 1000);
                if (error.status === 401 || error.status === 403) running = false;
                setStatus(error.message || '连接失败，稍后重试', 'error');
                if (!emails.length) renderInboxError(document.getElementById('inboxContainer'), error.message || '加载失败');
                return false;
            } finally {
                if (pending?.controller === controller) { pending = null; if (epoch === generation) schedule(); }
            }
        })();
        pending = { address, controller, promise };
        return promise;
    }
    function stopInboxPoll() { running = false; generation += 1; clearTimer(); pending?.controller.abort(); pending = null; setStatus(getActiveEmail() ? '已暂停' : '选择邮箱后开始收件'); }
    function startInboxPoll() { stopInboxPoll(); running = true; delay = POLL_INTERVAL; if (displayedAddress !== getActiveEmail()) { signature = null; renderInbox([]); } if (!document.hidden) void loadInbox(); }
    function getInboxEmailById(id) { return emails.find((item) => String(item.id) === String(id)); }
    function getEmailVerificationCode(email) { return email?.verification_code || extractCode(`${email?.subject || ''} ${getEmailPreviewText(email)}`); }
    async function copyEmailCode(event, id) { event?.preventDefault(); event?.stopPropagation(); const code = getEmailVerificationCode(getInboxEmailById(id)); if (!code) return showToast('未找到验证码'); await copyText(String(code)); }
    async function deleteEmailItem(event, id) {
        event?.preventDefault(); event?.stopPropagation(); if (deleting.has(id)) return; deleting.add(id);
        try { await emailAPI.delete(id); generation += 1; pending?.controller.abort(); pending = null; signature = null; renderInbox(emails.filter((email) => String(email.id) !== String(id))); showToast('已删除'); await loadInbox(); }
        catch (error) { showToast(error.message || '删除失败'); }
        finally { deleting.delete(id); }
    }
    async function openMailDetail(id) { const error = await openMailDetailById(id, emailAPI); if (error) showToast(error.message || '加载失败'); }
    function bindInboxActions() {
        const container = document.getElementById('inboxContainer');
        if (!container || container.dataset.actionsBound) return;
        container.dataset.actionsBound = 'true';
        container.addEventListener('click', (event) => {
            const element = event.target.closest('[data-action]');
            if (!element || !container.contains(element)) return;
            const id = Number(element.dataset.id);
            if (!Number.isSafeInteger(id)) return;
            if (element.dataset.action === 'open-mail-detail') void openMailDetail(id);
            else if (element.dataset.action === 'copy-email-code') void copyEmailCode(event, id);
            else if (element.dataset.action === 'delete-email-item') void deleteEmailItem(event, id);
        });
    }
    async function refreshInbox() { delay = POLL_INTERVAL; if (await loadInbox()) showToast('已刷新'); }
    document.addEventListener('visibilitychange', () => { if (!running) return; if (document.hidden) { generation += 1; clearTimer(); pending?.controller.abort(); pending = null; setStatus('页面隐藏，已暂停刷新'); } else { delay = POLL_INTERVAL; void loadInbox(); } });
    window.addEventListener('pagehide', stopInboxPoll);
    window.addEventListener('pageshow', (event) => { if (event.persisted && getActiveEmail()) startInboxPoll(); });
    Object.assign(actions, { openMailDetail, closeMailDetail: closeMailDetailModal, copyEmailCode, deleteEmailItem, refreshInbox });
    return { renderInbox, loadInbox, bindInboxActions, startInboxPoll, stopInboxPoll, getInboxEmailById, getEmailVerificationCode, getCurrentEmails: () => emails };
}
