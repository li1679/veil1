import { createHomeController } from './home-controller.js';
import { getLastMailboxStorageKey } from './admin-utils.js';

export function createAdminHomeController(options) {
    return createHomeController({ ...options, getStorageKey: getLastMailboxStorageKey, scope: 'own' });
}
