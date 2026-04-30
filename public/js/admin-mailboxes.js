import { ALL_MAILBOX_PAGE_SIZE_OPTIONS } from './admin-state.js';
import { renderAllMailboxesView, renderEmailPagination } from './admin-mailbox-table.js';
import { createMailboxViewerController } from './admin-mailbox-viewer.js';
import { registerMailboxEditors } from './admin-mailbox-editors.js';
import { getAvailableDomains, resetEmailPage } from './admin-utils.js';

export const createAdminMailboxController = ({ state, deps, domainSelector, inbox, home }) => {
    const { adminMailboxAPI, showToast, openIOSAlert, animateDelete, animateBatchDelete } = deps;
    createMailboxViewerController({ state, deps, inbox });

    async function loadAllMailboxes() {
        const requestSeq = ++state.allMailboxesLoadSeq;
        abortPreviousLoad();
        state.allMailboxesLoadController = new AbortController();
        try {
            const response = await adminMailboxAPI.getAllMailboxes(readMailboxFilters(), { signal: state.allMailboxesLoadController.signal });
            if (requestSeq !== state.allMailboxesLoadSeq) return;
            state.allMailboxes = response.mailboxes || [];
            syncEmailPageState(response.pagination || null);
            if (shouldReloadPreviousPage()) return loadAllMailboxes();
            syncSelectionStateWithCurrentPage();
            renderAllMailboxes();
            renderEmailPagination(state);
            renderDomainFilter();
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error('Failed to load mailboxes:', error);
            showToast('加载邮箱失败');
        }
    }

    function abortPreviousLoad() {
        if (!state.allMailboxesLoadController) return;
        try { state.allMailboxesLoadController.abort(); } catch (_) { /* ignore stale request */ }
    }

    function readMailboxFilters() {
        return {
            domain: document.getElementById('domainFilter')?.value || '',
            created_by: document.getElementById('userFilter')?.value || '',
            search: document.getElementById('emailSearchInput')?.value || '',
            limit: state.allMailboxesPageState.limit,
            page: state.allMailboxesPageState.page,
        };
    }

    function shouldReloadPreviousPage() {
        const pageState = state.allMailboxesPageState;
        if (state.allMailboxes.length > 0 || pageState.total <= 0 || pageState.page <= pageState.totalPages) return false;
        pageState.page = pageState.totalPages;
        return true;
    }

    function renderDomainFilter() {
        const filter = document.getElementById('domainFilter');
        if (!filter) return;
        const currentValue = filter.value;
        filter.innerHTML = '<option value="">全部域名</option>' + getAvailableDomains(domainSelector).map((domain) => {
            const safeDomain = deps.escapeHtml(domain);
            return `<option value="${safeDomain}" ${domain === currentValue ? 'selected' : ''}>${safeDomain}</option>`;
        }).join('');
    }

    function renderAllMailboxes() {
        renderAllMailboxesView({ state, deps, updateEmailBatchBar });
    }

    function syncEmailPageState(pagination = null) {
        if (pagination) return applyServerPagination(pagination);
        const pageState = state.allMailboxesPageState;
        pageState.hasMore = state.allMailboxes.length >= pageState.limit;
        pageState.totalPages = Math.max(1, pageState.page + (pageState.hasMore ? 1 : 0));
        pageState.total = (pageState.page - 1) * pageState.limit + state.allMailboxes.length;
    }

    function applyServerPagination(pagination) {
        const pageState = state.allMailboxesPageState;
        const limit = Number(pagination.limit);
        const page = Number(pagination.page);
        const total = Number(pagination.total);
        const totalPages = Number(pagination.totalPages);
        if (Number.isFinite(limit) && limit > 0) pageState.limit = limit;
        if (Number.isFinite(page) && page > 0) pageState.page = page;
        if (Number.isFinite(total) && total >= 0) pageState.total = total;
        pageState.hasMore = Boolean(pagination.hasMore);
        pageState.totalPages = Number.isFinite(totalPages) && totalPages > 0
            ? totalPages
            : Math.max(1, Math.ceil((Number.isFinite(total) ? total : 0) / pageState.limit));
    }

    function syncSelectionStateWithCurrentPage() {
        const pageIds = new Set((state.allMailboxes || []).map((item) => item.id));
        state.selectedEmailIds.forEach((id) => { if (!pageIds.has(id)) state.selectedEmailIds.delete(id); });
        state.expandedEmailDetails.forEach((id) => { if (!pageIds.has(id)) state.expandedEmailDetails.delete(id); });
    }

    function updateEmailBatchBar() {
        const count = state.selectedEmailIds.size;
        document.getElementById('selectedEmailsCount').textContent = count;
        const bar = document.getElementById('emailBatchBar');
        if (count > 0) bar.classList.add('show');
        else bar.classList.remove('show');
    }

    function registerGlobals() {
        window.gotoEmailPage = gotoEmailPage;
        window.changeEmailPageSize = changeEmailPageSize;
        window.toggleSelectEmail = toggleSelectEmail;
        window.toggleEmailDetails = toggleEmailDetails;
        window.toggleSelectAllEmails = toggleSelectAllEmails;
        window.cancelEmailSelection = cancelEmailSelection;
        window.toggleLoginAllowed = toggleLoginAllowed;
        window.deleteSingleMailbox = deleteSingleMailbox;
        window.batchDeleteEmails = batchDeleteEmails;
        window.batchToggleLoginEmails = batchToggleLoginEmails;
        window.filterAllEmails = () => { resetEmailPage(state); loadAllMailboxes(); };
        window.filterByDomain = window.filterAllEmails;
        window.filterByUser = window.filterAllEmails;
    }

    function gotoEmailPage(direction) {
        const pageState = state.allMailboxesPageState;
        const totalPages = Math.max(1, Number(pageState.totalPages) || 1);
        if (direction === 'prev' && pageState.page > 1) pageState.page -= 1;
        else if (direction === 'next' && (pageState.page < totalPages || pageState.hasMore)) pageState.page += 1;
        else if (!['prev', 'next'].includes(direction) && Number(direction) >= 1) pageState.page = Number(direction);
        state.selectedEmailIds.clear();
        state.expandedEmailDetails.clear();
        loadAllMailboxes();
    }

    function changeEmailPageSize(limitValue) {
        const limit = Number(limitValue);
        if (!Number.isFinite(limit) || !ALL_MAILBOX_PAGE_SIZE_OPTIONS.includes(limit)) return;
        if (limit === state.allMailboxesPageState.limit) return;
        state.allMailboxesPageState.limit = limit;
        resetEmailPage(state);
        loadAllMailboxes();
    }

    function toggleSelectEmail(id) {
        if (state.selectedEmailIds.has(id)) state.selectedEmailIds.delete(id);
        else state.selectedEmailIds.add(id);
        renderAllMailboxes();
    }

    function toggleEmailDetails(id) {
        if (state.expandedEmailDetails.has(id)) state.expandedEmailDetails.delete(id);
        else state.expandedEmailDetails.add(id);
        renderAllMailboxes();
    }

    function toggleSelectAllEmails() {
        const checkbox = document.getElementById('selectAllEmailsCheckbox');
        if (state.selectedEmailIds.size === state.allMailboxes.length && state.allMailboxes.length > 0) {
            state.selectedEmailIds.clear();
            checkbox.classList.remove('checked');
            checkbox.setAttribute('aria-checked', 'false');
        } else {
            state.allMailboxes.forEach((mailbox) => state.selectedEmailIds.add(mailbox.id));
            checkbox.classList.add('checked');
            checkbox.setAttribute('aria-checked', 'true');
        }
        renderAllMailboxes();
    }

    function cancelEmailSelection() {
        state.selectedEmailIds.clear();
        const checkbox = document.getElementById('selectAllEmailsCheckbox');
        checkbox.classList.remove('checked');
        checkbox.setAttribute('aria-checked', 'false');
        renderAllMailboxes();
    }

    async function toggleLoginAllowed(id) {
        const mailbox = state.allMailboxes.find((item) => item.id === id);
        if (!mailbox) return;
        try {
            await adminMailboxAPI.update(id, { is_login_allowed: !mailbox.is_login_allowed });
            mailbox.is_login_allowed = !mailbox.is_login_allowed;
            renderAllMailboxes();
            showToast(mailbox.is_login_allowed ? '已允许登录' : '已禁止登录');
        } catch (error) {
            showToast(error.message || '操作失败');
        }
    }

    function deleteSingleMailbox(id) {
        const target = state.allMailboxes.find((item) => item.id === id);
        openIOSAlert('删除邮箱', '确定要删除此邮箱吗？此操作无法撤销。', async () => removeSingleMailbox(id, target?.address || ''));
    }

    async function removeSingleMailbox(id, targetAddress) {
        try {
            await adminMailboxAPI.delete(id);
            animateDelete(document.getElementById(`email-row-${id}`), () => finalizeMailboxRemoval([id]));
            home.applyMailboxDeletionsToHome([targetAddress]);
            showToast('已删除');
        } catch (error) {
            showToast(error.message || '删除失败');
        }
    }

    function finalizeMailboxRemoval(ids) {
        const idSet = new Set(ids);
        ids.forEach((id) => {
            state.selectedEmailIds.delete(id);
            state.expandedEmailDetails.delete(id);
        });
        state.allMailboxes = state.allMailboxes.filter((item) => !idSet.has(item.id));
        renderAllMailboxes();
        if (state.allMailboxes.length === 0 && state.allMailboxesPageState.page > 1) state.allMailboxesPageState.page -= 1;
        void loadAllMailboxes();
    }

    function batchDeleteEmails() {
        const count = state.selectedEmailIds.size;
        if (count === 0) return;
        openIOSAlert('批量删除', `确定删除选中的 ${count} 个邮箱吗？`, async () => removeSelectedMailboxes(count));
    }

    async function removeSelectedMailboxes(count) {
        try {
            const ids = Array.from(state.selectedEmailIds);
            const addresses = ids.map((id) => state.allMailboxes.find((item) => item.id === id)?.address).filter(Boolean);
            await adminMailboxAPI.batchDelete(ids);
            animateBatchDelete(ids, 'email-row-', () => finalizeMailboxRemoval(ids));
            home.applyMailboxDeletionsToHome(addresses);
            showToast(`已删除 ${count} 个邮箱`);
        } catch (error) {
            showToast(error.message || '删除失败');
        }
    }

    async function batchToggleLoginEmails(allow) {
        const count = state.selectedEmailIds.size;
        if (count === 0) return;
        try {
            const ids = Array.from(state.selectedEmailIds);
            await adminMailboxAPI.batchUpdateLogin(ids, allow);
            state.allMailboxes.forEach((mailbox) => { if (state.selectedEmailIds.has(mailbox.id)) mailbox.is_login_allowed = allow; });
            renderAllMailboxes();
            showToast(allow ? `已允许 ${count} 个邮箱登录` : `已禁止 ${count} 个邮箱登录`);
            cancelEmailSelection();
        } catch (error) {
            showToast(error.message || '操作失败');
        }
    }

    registerGlobals();
    registerMailboxEditors({ state, deps, loadAllMailboxes, renderAllMailboxes });
    return { loadAllMailboxes, renderAllMailboxes, renderDomainFilter };
};
