import { createHomeController } from './home-controller.js';
import { getLastMailboxStorageKey } from './user-state.js';

export function createUserHomeController(options) {
    return createHomeController({
        ...options,
        getStorageKey: getLastMailboxStorageKey,
        updateUserInfo: options.deps.updateUserInfo,
    });
}
