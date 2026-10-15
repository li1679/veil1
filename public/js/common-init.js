import { initIOSAlert, initModalA11y } from './common-modal.js';
import { initUserMenuClose } from './common-menu.js';
import { initTheme } from './theme.js';
import { actions, bindPageActions } from './page-actions.js';
import { openModal, closeModal } from './common-modal.js';
import { showToast } from './common-toast.js';
import { renderUiState } from './ui-state.js';

let keyboardActivationInitialized = false;


function initKeyboardActivation() {
    if (keyboardActivationInitialized) return;
    keyboardActivationInitialized = true;
    document.addEventListener('keydown', handleKeyboardActivation);
}

function handleKeyboardActivation(event) {
    if (!event || event.defaultPrevented || event.repeat) return;
    const key = event.key;
    const isActivationKey = key === 'Enter' || key === ' ' || key === 'Spacebar';
    if (!isActivationKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.matches('button, input, select, textarea') || target.closest('[aria-disabled="true"], [disabled], .disabled')) return;
    if (!target.matches('[role="button"][tabindex="0"], [role="switch"][tabindex="0"], [role="checkbox"][tabindex="0"]')) return;
    event.preventDefault();
    target.click();
}

export function initCommon() {
    initModalA11y();
    initIOSAlert();
    initUserMenuClose();
    initKeyboardActivation();
    Object.assign(actions, { openModal, closeModal });
    bindPageActions();
    initTheme();
    initPwa();
}

function initPwa() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    if (window.location.protocol !== 'https:' && !isLocalhost) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch((error) => console.warn('SW registration failed:', error));
}

export function reportPageError(error) {
    const message = error.message || '暂时无法加载页面';
    showToast(message);
    const hint = document.getElementById('generateHint');
    if (hint) hint.textContent = `${message}，请刷新页面重试`;
    const inbox = document.getElementById('inboxContainer');
    if (inbox) inbox.innerHTML = renderUiState({ title: message, description: '请刷新页面重试', tone: 'error' });
}
