export { extractCode } from './verification-code.js';
export { showToast } from './common-toast.js';
export { openModal, closeModal, openIOSAlert, initIOSAlert, initModalA11y } from './common-modal.js';
export { copyText } from './common-clipboard.js';
export { animateDelete, animateBatchDelete } from './common-animation.js';
export { toggleUserMenu, initUserMenuClose } from './common-menu.js';
export { escapeHtml, sanitizeEmailHtml, fitMailHtmlToViewport } from './common-html.js';
export { formatTime, formatDate } from './common-time.js';
export { getStorage, setStorage, removeStorage } from './common-storage.js';
export { initCommon } from './common-init.js';

import { openModal, closeModal } from './common-modal.js';

if (typeof window !== 'undefined') {
    window.openModal = openModal;
    window.closeModal = closeModal;
}
