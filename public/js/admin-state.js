export function createAdminState() {
    return {
        currentUser: null,
        currentEmail: null,
        emailHistory: [],
        users: [],
        allMailboxes: [],
        selectedUserIds: new Set(),
        selectedEmailIds: new Set(),
        selectedExpiry: '24h',
        viewerMailbox: null,
        viewerEmails: [],
        allMailboxesLoadController: null,
        allMailboxesLoadSeq: 0,
        expandedEmailDetails: new Set(),
        allMailboxesPageState: {
            page: 1,
            limit: DEFAULT_ALL_MAILBOX_PAGE_SIZE,
            total: 0,
            totalPages: 1,
            hasMore: false,
        },
    };
}

export const HISTORY_FETCH_LIMIT = 50;
export const HISTORY_MAX_PAGES = 200;
export const DEFAULT_ALL_MAILBOX_PAGE_SIZE = 50;
export const ALL_MAILBOX_PAGE_SIZE_OPTIONS = [20, 50, 100];
