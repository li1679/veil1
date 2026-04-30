export function initUserEventListeners({ logout, inbox }) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    bindHistoryList();
    bindDomainOptions();
    inbox.bindInboxActions();
}

function bindHistoryList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    container.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl || !container.contains(actionEl)) return;
        const action = actionEl.dataset.action;
        const id = parseInt(actionEl.dataset.id || '', 10);
        if (action === 'restore-email') window.restoreEmail(actionEl.dataset.email);
        else if (action === 'toggle-pin') window.togglePin(id);
        else if (action === 'delete-history') window.confirmDeleteHistory(id);
    });
}

function bindDomainOptions() {
    const domainOptions = document.getElementById('domainOptions');
    if (!domainOptions) return;
    domainOptions.addEventListener('click', (event) => {
        const option = event.target.closest('[data-action="select-domain"]');
        if (option) window.selectDomain(option, option.dataset.domain);
    });
}
