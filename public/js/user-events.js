export function initUserEventListeners({ logout, inbox }) {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    inbox.bindInboxActions();
}
