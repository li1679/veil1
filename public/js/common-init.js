import { initIOSAlert, initModalA11y } from './common-modal.js';
import { initUserMenuClose } from './common-menu.js';

let keyboardActivationInitialized = false;

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

function initMobileSidebar() {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);
}

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
    if (!target.matches('[role="button"][tabindex="0"]')) return;
    if (key !== 'Enter') event.preventDefault();
    target.click();
}

export function initCommon() {
    initModalA11y();
    initIOSAlert();
    initUserMenuClose();
    initMobileSidebar();
    initKeyboardActivation();
    if (typeof window !== 'undefined' && window.initTheme) window.initTheme();
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
