import { actions } from './page-actions.js';
import { HISTORY_FETCH_LIMIT } from './mailbox-config.js';
import { renderHistoryEmpty, renderHistoryItem } from './history-renderer.js';
import { renderUiState } from './ui-state.js';
import { showBulkResult } from './bulk-result-modal.js';
import { runExclusive, updateBatchProgress } from './async-actions.js';

export function createHomeController({ state, deps, domainSelector, inbox, getStorageKey, scope, refreshQuota, updateUserInfo }) {
    const { mailboxAPI, emailAPI, showToast, copyText, openIOSAlert, animateDelete, formatTime, getStorage, setStorage, removeStorage } = deps;
    let generating = false;
    let historyController = null;
    let historyOffset = 0;
    let historyHasMore = false;
    let historyVersion = 0;
    let selectionVersion = 0;

    function syncGenerateButton() {
        const button = document.querySelector('.generate-btn');
        if (!button) return;
        const unavailable = !domainSelector.getDomains().length;
        const exhausted = Boolean(refreshQuota && state.currentUser && (state.currentUser.quotaUsed ?? 0) >= (state.currentUser.quota ?? 10));
        button.disabled = generating || unavailable || exhausted;
        button.textContent = generating ? '生成中…' : '立即生成';
        button.setAttribute('aria-busy', String(generating));
        document.getElementById('generateHint')?.replaceChildren(document.createTextNode(unavailable ? '暂无可用域名，重新加载后再生成' : exhausted ? '邮箱配额已用完，删除邮箱或联系管理员调整配额' : '生成后即可复制地址并接收邮件'));
        document.getElementById('retryDomainsBtn')?.classList.toggle('is-hidden', !unavailable);
    }
    domainSelector.onChange(syncGenerateButton);

    function setCurrentEmail(email) {
        state.currentEmail = email;
        selectionVersion += 1;
        setStorage(getStorageKey(state), email);
        const [prefix, suffix] = String(email).split('@');
        document.getElementById('prefixText').textContent = prefix;
        document.getElementById('suffixText').textContent = suffix ? `@${suffix}` : '';
        document.getElementById('fullEmailDisplay').classList.add('visible');
        document.getElementById('actionButtons').classList.remove('disabled');
        document.querySelector('.email-display-container')?.setAttribute('aria-disabled', 'false');
        renderHistory();
    }

    function restoreEmail(email) { setCurrentEmail(email); inbox.startInboxPoll(); }

    function clearCurrentEmailState() {
        state.currentEmail = null;
        selectionVersion += 1;
        removeStorage(getStorageKey(state));
        document.getElementById('fullEmailDisplay').classList.remove('visible');
        document.getElementById('actionButtons').classList.add('disabled');
        document.getElementById('prefixText').textContent = '先生成一个邮箱';
        document.getElementById('suffixText').textContent = '';
        document.querySelector('.email-display-container')?.setAttribute('aria-disabled', 'true');
        inbox.stopInboxPoll();
        inbox.renderInbox([]);
        renderHistory();
    }

    function updateQuota(delta) {
        if (!refreshQuota || !state.currentUser) return;
        state.currentUser.quotaUsed = Math.max(0, (state.currentUser.quotaUsed ?? 0) + delta);
        updateUserInfo();
    }

    async function generateEmail() {
        if (generating) return;
        generating = true;
        syncGenerateButton();
        try {
            if (refreshQuota) {
                await refreshQuota();
                if ((state.currentUser.quotaUsed ?? 0) >= (state.currentUser.quota ?? 10)) {
                    showToast('邮箱配额已用完');
                    return;
                }
            }
            if (!domainSelector.getDomains().length) return showToast('请先加载可用域名');
            const count = domainSelector.getGenerateCount();
            const prefixMode = domainSelector.getPrefixMode();
            if (count > 1 && prefixMode === 'custom') return showToast('自定义前缀不支持批量生成');
            if (count > 1) {
                const result = await mailboxAPI.generateBulk({ domain: domainSelector.getSelectedDomain(), prefixMode, length: domainSelector.getPrefixLength(), expiry: state.selectedExpiry, count, randomDomain: domainSelector.isRandomDomain() });
                const created = result.created || [];
                addToHistory(created.map((item) => item.address));
                if (created.length) restoreEmail(created[0].address);
                updateQuota(created.length);
                showBulkResult(result);
                showToast(`已生成 ${created.length} 个，失败 ${result.failedCount ?? result.failed_count ?? 0} 个`);
            } else {
                const domain = domainSelector.getDomainForGeneration();
                const prefix = document.getElementById('customInputBox').value.trim();
                if (prefixMode === 'custom' && !prefix) return showToast('请输入前缀');
                const response = prefixMode === 'custom' ? await mailboxAPI.create(prefix, domain, state.selectedExpiry) : await mailboxAPI.generate(domain, prefixMode, domainSelector.getPrefixLength(), state.selectedExpiry);
                addToHistory([response.address]);
                restoreEmail(response.address);
                updateQuota(1);
                showToast('邮箱已生成');
            }
            if (refreshQuota) await refreshQuota();
        } catch (error) { showToast(error.message || '生成失败'); }
        finally { generating = false; syncGenerateButton(); }
    }

    async function loadHistory({ append = false } = {}) {
        if (append && !historyHasMore) return;
        historyController?.abort();
        const controller = new AbortController();
        historyController = controller;
        const offset = append ? historyOffset : 0;
        const more = document.getElementById('historyLoadMore');
        if (more) more.disabled = true;
        const startingHistoryVersion = historyVersion;
        const startingSelectionVersion = selectionVersion;
        try {
            const response = await mailboxAPI.getMailboxes({ scope, limit: HISTORY_FETCH_LIMIT, offset }, { signal: controller.signal });
            if (controller !== historyController || startingHistoryVersion !== historyVersion) return;
            const batch = response.mailboxes || [];
            const incoming = batch.map((mailbox) => ({ id: mailbox.id, email: mailbox.address, time: formatTime(mailbox.created_at), emailCount: mailbox.email_count ?? 0, pinned: Boolean(mailbox.is_pinned) }));
            state.emailHistory = append ? [...new Map([...state.emailHistory, ...incoming].map((item) => [item.email, item])).values()] : incoming;
            historyOffset = offset + batch.length;
            historyHasMore = batch.length === HISTORY_FETCH_LIMIT;
            more?.classList.toggle('is-hidden', !historyHasMore);
            renderHistory();
            if (!append && startingSelectionVersion === selectionVersion) {
                const last = getStorage(getStorageKey(state), null);
                let preferred = state.emailHistory.find((item) => item.email === last);
                if (last && !preferred) {
                    const saved = await mailboxAPI.getMailboxes({ scope, search: last, limit: 1 }, { signal: controller.signal });
                    if (controller !== historyController || startingSelectionVersion !== selectionVersion) return;
                    const match = (saved.mailboxes || []).find((item) => item.address === last);
                    if (match) preferred = { email: match.address };
                }
                preferred ||= state.emailHistory[0];
                if (preferred) restoreEmail(preferred.email); else clearCurrentEmailState();
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            showToast(error.message || '加载历史失败');
            if (!state.emailHistory.length) document.getElementById('historyListContainer').innerHTML = renderUiState({ title: '加载历史失败', description: '请刷新页面重试', tone: 'error', compact: true });
        } finally { if (controller === historyController && more) more.disabled = false; }
    }

    function addToHistory(addresses) {
        const existing = new Map(state.emailHistory.map((item) => [item.email, item]));
        const additions = [...new Set(addresses)].map((email) => existing.get(email) || { id: email, email, time: '刚刚', emailCount: 0, pinned: false });
        const added = new Set(addresses);
        state.emailHistory = [...additions, ...state.emailHistory.filter((item) => !added.has(item.email))];
        historyVersion += 1;
        renderHistory();
    }

    function renderHistory() {
        const container = document.getElementById('historyListContainer');
        if (!container) return;
        const ordered = [...state.emailHistory].sort((a, b) => Number(b.pinned) - Number(a.pinned));
        container.innerHTML = ordered.length ? ordered.map((item) => renderHistoryItem(item, state.currentEmail)).join('') : renderHistoryEmpty();
    }

    function applyMailboxDeletionsToHome(addresses) {
        const deleted = new Set(addresses.map((address) => address.toLowerCase()));
        historyVersion += 1;
        state.emailHistory = state.emailHistory.filter((item) => !deleted.has(item.email.toLowerCase()));
        if (deleted.has(String(state.currentEmail || '').toLowerCase())) clearCurrentEmailState();
        if (deleted.has(String(getStorage(getStorageKey(state), '')).toLowerCase())) removeStorage(getStorageKey(state));
        renderHistory();
    }

    async function deleteHistoryItem(id) {
        const item = state.emailHistory.find((entry) => String(entry.id) === String(id));
        if (!item) return;
        try { await mailboxAPI.delete(item.email); animateDelete(document.getElementById(`history-${id}`), () => applyMailboxDeletionsToHome([item.email])); updateQuota(-1); showToast('已删除'); if (refreshQuota) await refreshQuota(); }
        catch (error) { showToast(error.message || '删除失败'); }
    }

    async function clearHistory() {
        try { await mailboxAPI.clearAll({ scope }, { onProgress: updateBatchProgress }); state.emailHistory = []; historyVersion += 1; historyHasMore = false; document.getElementById('historyLoadMore')?.classList.add('is-hidden'); clearCurrentEmailState(); showToast('已清空'); if (refreshQuota) await refreshQuota(); }
        catch (error) { showToast(error.message || '清空失败'); await loadHistory(); }
    }

    async function clearInbox() {
        const email = state.currentEmail;
        if (!email) return;
        try { await emailAPI.clear(email); inbox.stopInboxPoll(); inbox.renderInbox([]); inbox.startInboxPoll(); showToast('已清空'); }
        catch (error) { showToast(error.message || '清空失败'); }
    }

    function updateEmailCount(address, count) {
        const item = state.emailHistory.find((entry) => entry.email === address);
        if (item && item.emailCount !== count) renderHistory();
    }

    Object.assign(actions, {
        generateEmail, restoreEmail,
        loadMoreHistory: () => loadHistory({ append: true }),
        retryDomains: () => domainSelector.loadDomains(),
        setExpiry(btn, value, index) { state.selectedExpiry = value; btn.parentElement.querySelectorAll('.segment-btn').forEach((button) => { button.classList.toggle('active', button === btn); button.setAttribute('aria-pressed', String(button === btn)); }); btn.parentElement.querySelector('.segment-bg').style.transform = `translateX(${index * 100}%)`; },
        togglePin(id) { return runExclusive(`pin-${id}`, async () => { const item = state.emailHistory.find((entry) => String(entry.id) === String(id)); if (!item) return; try { const result = await mailboxAPI.pin(item.email); item.pinned = Boolean(result.is_pinned); renderHistory(); } catch (error) { showToast(error.message || '置顶失败'); } }); },
        confirmDeleteHistory: (id) => openIOSAlert('删除邮箱', '确定删除此邮箱及其邮件吗？', () => deleteHistoryItem(id)),
        confirmClearHistory: () => { if (state.emailHistory.length || historyHasMore) openIOSAlert('清空全部邮箱', '删除所有邮箱及其邮件，包括尚未加载的记录。此操作不可撤销。', clearHistory); },
        copyEmail: () => { if (state.currentEmail) copyText(state.currentEmail); },
        copyMailboxAddress(address, event) { event?.preventDefault(); event?.stopPropagation(); if (address) copyText(address); },
        confirmClearInbox: () => { if (state.currentEmail) openIOSAlert('清空收件箱', '确定清空当前邮箱的所有邮件吗？', clearInbox); },
        scrollToInbox: () => document.getElementById('inboxSection')?.scrollIntoView({ behavior: 'smooth' }),
    });
    bindHistoryActions();
    return { loadHistory, renderHistory, setCurrentEmail, applyMailboxDeletionsToHome, syncGenerateButton, updateEmailCount };
}

function bindHistoryActions() {
    const container = document.getElementById('historyListContainer');
    container.addEventListener('click', (event) => {
        const element = event.target.closest('[data-action]');
        if (!element || !container.contains(element)) return;
        if (element.dataset.action === 'restore-email') actions.restoreEmail(element.dataset.email);
        else if (element.dataset.action === 'toggle-pin') actions.togglePin(element.dataset.id);
        else if (element.dataset.action === 'delete-history') actions.confirmDeleteHistory(element.dataset.id);
    });
}
