export function createUserPageState() {
    return {
        currentUser: null,
        currentEmail: null,
        emailHistory: [],
        selectedExpiry: '24h',
    };
}

export function getLastMailboxStorageKey(state) {
    const username = state.currentUser?.username ? String(state.currentUser.username) : 'unknown';
    return `veil_last_mailbox_user_${username}`;
}
