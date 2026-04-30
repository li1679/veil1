export function createUserPageState() {
    return {
        currentUser: null,
        currentEmail: null,
        emailHistory: [],
        selectedExpiry: '24h',
    };
}

export const LIST_FETCH_LIMIT = 50;
export const MAX_LIST_FETCH_PAGES = 200;

export function getLastMailboxStorageKey(state) {
    const username = state.currentUser?.username ? String(state.currentUser.username) : 'unknown';
    return `veil_last_mailbox_user_${username}`;
}
