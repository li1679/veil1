import { HISTORY_FETCH_LIMIT, HISTORY_MAX_PAGES } from './admin-state.js';
import { getLastMailboxStorageKey, normalizeEmailAddress } from './admin-utils.js';
import { renderHistoryEmpty, renderHistoryItem } from './history-renderer.js';
import { showBulkResult } from './bulk-result-modal.js';

export function createAdminHomeController(args) {
    const ctx = { ...args };
    registerGlobals(ctx);
    return {
        loadHistory: () => loadHistory(ctx),
        renderHistory: () => renderHistory(ctx),
        applyMailboxDeletionsToHome: (addresses) => applyMailboxDeletionsToHome(ctx, addresses),
        setCurrentEmail: (email) => setCurrentEmail(ctx, email),
    };
}

function clearCurrentEmailState(ctx) {
    ctx.state.currentEmail = null;
    ctx.deps.removeStorage(getLastMailboxStorageKey(ctx.state));
    document.getElementById('fullEmailDisplay')?.classList.remove('visible');
    document.getElementById('actionButtons')?.classList.add('disabled');
    ctx.inbox.stopInboxPoll();
    try { ctx.inbox.renderInbox([]); } catch (_) { /* ignore stale inbox */ }
}

function applyMailboxDeletionsToHome(ctx, addresses = []) {
    const deleted = new Set((addresses || []).map(normalizeEmailAddress).filter(Boolean));
    if (deleted.size === 0) return;
    ctx.state.emailHistory = (ctx.state.emailHistory || []).filter((item) => !deleted.has(normalizeEmailAddress(item?.email)));
    const last = normalizeEmailAddress(ctx.deps.getStorage(getLastMailboxStorageKey(ctx.state), null));
    if (last && deleted.has(last)) ctx.deps.removeStorage(getLastMailboxStorageKey(ctx.state));
    if (ctx.state.currentEmail && deleted.has(normalizeEmailAddress(ctx.state.currentEmail))) clearCurrentEmailState(ctx);
    if (ctx.state.viewerMailbox && deleted.has(normalizeEmailAddress(ctx.state.viewerMailbox))) closeViewerAfterDeletion(ctx);
    renderHistory(ctx);
}

function closeViewerAfterDeletion(ctx) {
    try {
        window.closeMailboxViewer?.();
    } catch (_) {
        ctx.state.viewerMailbox = null;
        ctx.state.viewerEmails = [];
        try { ctx.deps.closeModal('mailboxViewerModal'); } catch (_) { /* ignore stale modal */ }
    }
}

async function generateEmail(ctx) {
    const { mailboxAPI, showToast } = ctx.deps;
    const count = ctx.domainSelector.getGenerateCount ? ctx.domainSelector.getGenerateCount() : 1;
    if (count > 1) return generateEmailsBulk(ctx, count);
    try {
        const response = await createMailboxFromCurrentForm(mailboxAPI, ctx.domainSelector, ctx.state.selectedExpiry, showToast);
        if (!response?.address) return;
        setCurrentEmail(ctx, response.address);
        addToHistory(ctx, response.address);
        showToast('邮箱已生成');
        ctx.inbox.startInboxPoll();
    } catch (error) {
        console.error('Generate failed:', error);
        showToast(error.message || '生成失败');
    }
}

async function generateEmailsBulk(ctx, count) {
    const { mailboxAPI, showToast } = ctx.deps;
    const prefixMode = ctx.domainSelector.getPrefixMode();
    if (prefixMode === 'custom') {
        showToast('自定义前缀不支持批量生成');
        return;
    }
    try {
        const result = await mailboxAPI.generateBulk({
            domain: ctx.domainSelector.getSelectedDomain(),
            prefixMode,
            length: ctx.domainSelector.getPrefixLength(),
            expiry: ctx.state.selectedExpiry,
            count,
            randomDomain: ctx.domainSelector.isRandomDomain ? ctx.domainSelector.isRandomDomain() : false,
        });
        const created = Array.isArray(result?.created) ? result.created : [];
        created.forEach((item) => { if (item?.address) addToHistory(ctx, item.address); });
        if (created.length > 0) {
            const firstAddress = created[0].address;
            setCurrentEmail(ctx, firstAddress);
            ctx.inbox.startInboxPoll();
        }
        showBulkResult(result);
        showToast(`已生成 ${created.length} 个，失败 ${result?.failedCount ?? 0} 个`);
    } catch (error) {
        console.error('Bulk generate failed:', error);
        showToast(error.message || '批量生成失败');
    }
}

function setCurrentEmail(ctx, email) {
    ctx.state.currentEmail = email;
    ctx.deps.setStorage(getLastMailboxStorageKey(ctx.state), email);
    const [prefix, suffix] = email.split('@');
    document.getElementById('prefixText').textContent = prefix;
    document.getElementById('suffixText').textContent = '@' + suffix;
    document.getElementById('fullEmailDisplay').classList.add('visible');
    document.getElementById('actionButtons').classList.remove('disabled');
}

async function loadHistory(ctx) {
    try {
        const mailboxes = await fetchMailboxHistory(ctx.deps.mailboxAPI);
        ctx.state.emailHistory = mailboxes.map((mailbox) => mapHistoryMailbox(mailbox, ctx.deps.formatTime));
        restoreLastMailboxIfNeeded(ctx);
        renderHistory(ctx);
        restorePreferredEmail(ctx);
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

function restoreLastMailboxIfNeeded(ctx) {
    const lastEmail = readLastEmail(ctx);
    if (!lastEmail || ctx.state.emailHistory.some((item) => item.email === lastEmail)) return;
    ctx.state.emailHistory.unshift({ id: Date.now(), email: lastEmail, time: '上次使用', emailCount: 0, pinned: false });
}

function restorePreferredEmail(ctx) {
    if (ctx.state.emailHistory.length === 0) return;
    const lastEmail = readLastEmail(ctx);
    const preferred = lastEmail && ctx.state.emailHistory.some((item) => item.email === lastEmail)
        ? lastEmail
        : ctx.state.emailHistory[0].email;
    window.restoreEmail(preferred);
}

function readLastEmail(ctx) {
    const last = ctx.deps.getStorage(getLastMailboxStorageKey(ctx.state), null);
    const lastEmail = typeof last === 'string' ? last.trim() : '';
    return lastEmail.includes('@') ? lastEmail : '';
}

function addToHistory(ctx, email) {
    const existing = ctx.state.emailHistory.find((item) => item.email === email);
    ctx.state.emailHistory = ctx.state.emailHistory.filter((item) => item.email !== email);
    ctx.state.emailHistory.unshift(existing || { id: Date.now(), email, time: '刚刚', emailCount: 0, pinned: false });
    renderHistory(ctx);
}

function renderHistory(ctx) {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    if (ctx.state.emailHistory.length === 0) {
        container.innerHTML = renderHistoryEmpty();
        return;
    }
    container.innerHTML = ctx.state.emailHistory.map(renderHistoryItem).join('');
}

function registerGlobals(ctx) {
    window.setExpiry = (btn, value, index) => setExpiry(btn, value, index, ctx.state);
    window.generateEmail = () => generateEmail(ctx);
    window.restoreEmail = (email) => { setCurrentEmail(ctx, email); ctx.inbox.startInboxPoll(); ctx.loadInbox(); };
    window.togglePin = (id) => togglePin(id, ctx.state, () => renderHistory(ctx));
    window.confirmDeleteHistory = (id) => confirmDeleteHistory(ctx, id);
    window.confirmClearHistory = () => confirmClearHistory(ctx);
    window.copyEmail = () => { if (ctx.state.currentEmail) ctx.deps.copyText(ctx.state.currentEmail); };
    window.copyMailboxAddress = (address, event) => copyMailboxAddress(ctx, address, event);
    window.confirmClearInbox = () => confirmClearInbox(ctx);
    window.scrollToInbox = () => document.getElementById('inboxSection').scrollIntoView({ behavior: 'smooth' });
}

function copyMailboxAddress(ctx, address, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (address) ctx.deps.copyText(address);
}

function confirmDeleteHistory(ctx, id) {
    ctx.deps.openIOSAlert('删除记录', '确定删除此历史记录吗？', async () => deleteHistoryItem(ctx, id));
}

async function deleteHistoryItem(ctx, id) {
    const item = ctx.state.emailHistory.find((entry) => entry.id === id);
    if (!item) return;
    try {
        await ctx.deps.mailboxAPI.delete(item.email);
        ctx.deps.animateDelete(document.getElementById(`history-${id}`), () => removeHistoryItem(ctx, id, item.email));
        ctx.deps.showToast('已删除');
    } catch (error) {
        ctx.deps.showToast(error.message || '删除失败');
    }
}

function removeHistoryItem(ctx, id, email) {
    ctx.state.emailHistory = ctx.state.emailHistory.filter((item) => item.id !== id);
    renderHistory(ctx);
    if (ctx.state.currentEmail === email) clearCurrentEmailState(ctx);
}

function confirmClearHistory(ctx) {
    if (ctx.state.emailHistory.length === 0) return;
    ctx.deps.openIOSAlert('清空历史', '确定删除所有记录吗？', async () => clearHistory(ctx));
}

async function clearHistory(ctx) {
    try {
        await ctx.deps.mailboxAPI.clearAll({ scope: 'own' });
        ctx.state.emailHistory = [];
        clearCurrentEmailState(ctx);
        renderHistory(ctx);
        ctx.deps.showToast('已清空');
    } catch (error) {
        ctx.deps.showToast(error.message || '清空失败');
    }
}

function confirmClearInbox(ctx) {
    if (!ctx.state.currentEmail) return;
    ctx.deps.openIOSAlert('清空收件箱', '确定清空当前邮箱的所有邮件吗？', async () => clearInbox(ctx));
}

async function clearInbox(ctx) {
    try {
        await ctx.deps.emailAPI.clear(ctx.state.currentEmail);
        ctx.inbox.renderInbox([]);
        ctx.deps.showToast('已清空');
    } catch (error) {
        ctx.deps.showToast(error.message || '清空失败');
    }
}

async function createMailboxFromCurrentForm(mailboxAPI, domainSelector, selectedExpiry, showToast) {
    const domain = domainSelector.getDomainForGeneration();
    const prefixMode = domainSelector.getPrefixMode();
    const prefixLength = domainSelector.getPrefixLength();
    if (prefixMode !== 'custom') return mailboxAPI.generate(domain, prefixMode, prefixLength, selectedExpiry);
    const prefix = document.getElementById('customInputBox').value.trim();
    if (!prefix) {
        showToast('请输入前缀');
        return null;
    }
    return mailboxAPI.create(prefix, domain, selectedExpiry);
}

async function fetchMailboxHistory(mailboxAPI) {
    let mailboxes = [];
    for (let page = 0; page < HISTORY_MAX_PAGES; page += 1) {
        const offset = page * HISTORY_FETCH_LIMIT;
        const response = await mailboxAPI.getMailboxes({ scope: 'own', limit: HISTORY_FETCH_LIMIT, offset });
        const batch = response.mailboxes || [];
        if (batch.length === 0) break;
        mailboxes = mailboxes.concat(batch);
        if (batch.length < HISTORY_FETCH_LIMIT) break;
    }
    return mailboxes;
}

function mapHistoryMailbox(mailbox, formatTime) {
    return { id: mailbox.id, email: mailbox.address, time: formatTime(mailbox.created_at), emailCount: mailbox.email_count || 0, pinned: false };
}

function setExpiry(btn, value, index, state) {
    state.selectedExpiry = value;
    const container = btn.parentElement;
    container.querySelectorAll('.segment-btn').forEach((button) => button.classList.remove('active'));
    btn.classList.add('active');
    container.querySelector('.segment-bg').style.transform = `translateX(${index * 100}%)`;
}

function togglePin(id, state, renderHistory) {
    const item = state.emailHistory.find((entry) => entry.id === id);
    if (!item) return;
    item.pinned = !item.pinned;
    renderHistory();
}
