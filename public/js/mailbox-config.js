// Shared by the browser UI and Worker handlers; role limits are intentional.
export const MAX_BULK_GENERATE_COUNT_USER = 50;
export const MAX_BULK_GENERATE_COUNT_ADMIN = 100;
export const HISTORY_FETCH_LIMIT = 50;

export function getBulkGenerateLimit(role) {
    return role === 'StrictAdmin' ? MAX_BULK_GENERATE_COUNT_ADMIN : MAX_BULK_GENERATE_COUNT_USER;
}
