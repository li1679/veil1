import { LIST_FETCH_LIMIT, MAX_LIST_FETCH_PAGES, getLastMailboxStorageKey } from './user-state.js';
import { renderHistoryEmpty, renderHistoryItem } from './history-renderer.js';

export const createUserHomeController = ({ state, deps, domainSelector, inbox, loadInbox, refreshQuota }) => {
    const { mailboxAPI, emailAPI, showToast, copyText, openIOSAlert, animateDelete, formatTime, getStorage, setStorage, removeStorage, updateUserInfo } = deps;

    function setCurrentEmail(email) {
        state.currentEmail = email;
        setStorage(getLastMailboxStorageKey(state), email);
        const [prefix, suffix] = email.split('@');
        document.getElementById('prefixText').textContent = prefix;
        document.getElementById('suffixText').textContent = '@' + suffix;
        document.getElementById('fullEmailDisplay').classList.add('visible');
        document.getElementById('actionButtons').classList.remove('disabled');
    }

    async function generateEmail() {
        await refreshQuota();
        if (quotaExhausted(state.currentUser)) return showToast('邮箱配额已用完');
        try {
            const response = await createMailbox(mailboxAPI, domainSelector, state.selectedExpiry, showToast);
            if (!response?.address) return;
            setCurrentEmail(response.address);
            addToHistory(response.address);
            showToast('邮箱已生成');
            inbox.startInboxPoll();
            incrementQuota();
            refreshQuota();
        } catch (error) {
            console.error('Generate failed:', error);
            showToast(error.message || '生成失败');
        }
    }

    function incrementQuota() {
        if (!state.currentUser) return;
        state.currentUser.quotaUsed = (state.currentUser.quotaUsed || 0) + 1;
        updateUserInfo();
    }

    async function loadHistory() {
        try {
            const mailboxes = await fetchHistoryMailboxes(mailboxAPI);
            state.emailHistory = mailboxes.map((mailbox) => mapHistoryMailbox(mailbox, formatTime));
            restoreLastMailboxIfNeeded();
            renderHistory();
            restorePreferredEmail();
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    function restoreLastMailboxIfNeeded() {
        const lastEmail = readLastEmail();
        if (!lastEmail || state.emailHistory.some((item) => item.email === lastEmail)) return;
        state.emailHistory.unshift({ id: Date.now(), email: lastEmail, time: '上次使用', emailCount: 0, pinned: false });
    }

    function restorePreferredEmail() {
        if (state.emailHistory.length === 0) return;
        const lastEmail = readLastEmail();
        const preferred = lastEmail && state.emailHistory.some((item) => item.email === lastEmail)
            ? lastEmail
            : state.emailHistory[0].email;
        window.restoreEmail(preferred);
    }

    function readLastEmail() {
        const last = getStorage(getLastMailboxStorageKey(state), null);
        const lastEmail = typeof last === 'string' ? last.trim() : '';
        return lastEmail.includes('@') ? lastEmail : '';
    }

    function addToHistory(email) {
        const existing = state.emailHistory.find((item) => item.email === email);
        state.emailHistory = state.emailHistory.filter((item) => item.email !== email);
        state.emailHistory.unshift(existing || { id: Date.now(), email, time: '刚刚', emailCount: 0, pinned: false });
        renderHistory();
    }

    function renderHistory() {
        const container = document.getElementById('historyListContainer');
        if (!container) return;
        if (state.emailHistory.length === 0) {
            container.innerHTML = renderHistoryEmpty();
            return;
        }
        container.innerHTML = state.emailHistory.map(renderHistoryItem).join('');
    }

    function clearCurrentEmailState() {
        state.currentEmail = null;
        removeStorage(getLastMailboxStorageKey(state));
        document.getElementById('fullEmailDisplay').classList.remove('visible');
        document.getElementById('actionButtons').classList.add('disabled');
        inbox.stopInboxPoll();
    }

    function registerGlobals() {
        window.setExpiry = (btn, value, index) => setExpiry(btn, value, index, state);
        window.generateEmail = generateEmail;
        window.restoreEmail = (email) => { setCurrentEmail(email); inbox.startInboxPoll(); loadInbox(); };
        window.togglePin = (id) => togglePin(id, state, renderHistory);
        window.confirmDeleteHistory = (id) => confirmDeleteHistory(id);
        window.confirmClearHistory = () => confirmClearHistory();
        window.copyEmail = () => { if (state.currentEmail) copyText(state.currentEmail); };
        window.confirmClearInbox = confirmClearInbox;
        window.scrollToInbox = () => document.getElementById('inboxSection').scrollIntoView({ behavior: 'smooth' });
    }

    function confirmDeleteHistory(id) {
        openIOSAlert('删除记录', '确定删除此历史记录吗？', async () => deleteHistoryItem(id));
    }

    async function deleteHistoryItem(id) {
        const item = state.emailHistory.find((entry) => entry.id === id);
        if (!item) return;
        try {
            await mailboxAPI.delete(item.email);
            animateDelete(document.getElementById(`history-${id}`), () => removeHistoryItem(id, item.email));
            showToast('已删除');
            decrementQuota();
            refreshQuota();
        } catch (error) {
            showToast(error.message || '删除失败');
        }
    }

    function removeHistoryItem(id, email) {
        state.emailHistory = state.emailHistory.filter((item) => item.id !== id);
        renderHistory();
        if (state.currentEmail === email) clearCurrentEmailState();
    }

    function decrementQuota() {
        if (!state.currentUser) return;
        state.currentUser.quotaUsed = Math.max(0, (state.currentUser.quotaUsed || 0) - 1);
        updateUserInfo();
    }

    function confirmClearHistory() {
        if (state.emailHistory.length === 0) return;
        openIOSAlert('清空历史', '确定删除所有记录吗？', async () => clearHistory());
    }

    async function clearHistory() {
        try {
            await mailboxAPI.clearAll();
            state.emailHistory = [];
            clearCurrentEmailState();
            renderHistory();
            showToast('已清空');
            if (state.currentUser) state.currentUser.quotaUsed = 0;
            updateUserInfo();
            refreshQuota();
        } catch (error) {
            showToast(error.message || '清空失败');
        }
    }

    function confirmClearInbox() {
        if (!state.currentEmail) return;
        openIOSAlert('清空收件箱', '确定清空当前邮箱的所有邮件吗？', async () => clearInbox());
    }

    async function clearInbox() {
        try {
            await emailAPI.clear(state.currentEmail);
            inbox.renderInbox([]);
            showToast('已清空');
        } catch (error) {
            showToast(error.message || '清空失败');
        }
    }

    registerGlobals();
    return { loadHistory, renderHistory, setCurrentEmail };
};

function quotaExhausted(user) {
    return user && (user.quotaUsed || 0) >= (user.quota || 10);
}

async function createMailbox(mailboxAPI, domainSelector, selectedExpiry, showToast) {
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

async function fetchHistoryMailboxes(mailboxAPI) {
    let mailboxes = [];
    for (let page = 0; page < MAX_LIST_FETCH_PAGES; page += 1) {
        const offset = page * LIST_FETCH_LIMIT;
        const response = await mailboxAPI.getMailboxes({ limit: LIST_FETCH_LIMIT, offset });
        const batch = response.mailboxes || [];
        if (batch.length === 0) break;
        mailboxes = mailboxes.concat(batch);
        if (batch.length < LIST_FETCH_LIMIT) break;
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
