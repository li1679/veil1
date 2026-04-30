const modalStack = [];
const modalLastFocus = new Map();
let modalA11yInitialized = false;
let pendingAlertAction = null;

function getFocusableElements(root) {
    if (!root) return [];
    const selector = [
        'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
        'input:not([disabled])', 'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(root.querySelectorAll(selector)).filter(isFocusableElement);
}

function isFocusableElement(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return el.offsetParent !== null;
}

function getTopModal() {
    const topId = modalStack[modalStack.length - 1];
    if (!topId) return null;
    const modal = document.getElementById(topId);
    return modal && modal.classList.contains('active') ? modal : null;
}

function focusFirstElement(modal) {
    if (!(modal instanceof HTMLElement)) return;
    const focusables = getFocusableElements(modal);
    if (focusables.length > 0) {
        focusables[0].focus();
        return;
    }
    modal.setAttribute('tabindex', '-1');
    modal.focus();
}

function handleModalKeydown(event) {
    const modal = getTopModal();
    if (!modal) return;
    if (event.key === 'Escape') return handleModalEscape(event, modal);
    if (event.key === 'Tab') trapModalFocus(event, modal);
}

function handleModalEscape(event, modal) {
    const modalId = modal.id || '';
    if (!modalId || modalId === 'iosAlertModal') return;
    event.preventDefault();
    closeModal(modalId);
}

function trapModalFocus(event, modal) {
    const focusables = getFocusableElements(modal);
    if (focusables.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!(active instanceof Element) || !modal.contains(active)) {
        event.preventDefault();
        first.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
    }
}

function handleModalOverlayClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('modal-overlay')) return;
    if (!target.classList.contains('active')) return;
    if (event.target !== target || target.id === 'iosAlertModal') return;
    closeModal(target.id);
}

function ensureModalA11y() {
    if (modalA11yInitialized || typeof document === 'undefined') return;
    modalA11yInitialized = true;
    document.addEventListener('keydown', handleModalKeydown);
    document.addEventListener('click', handleModalOverlayClick);
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    ensureModalA11y();
    if (!modalStack.includes(modalId)) modalStack.push(modalId);
    const active = document.activeElement;
    if (active instanceof HTMLElement) modalLastFocus.set(modalId, active);
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.classList.add('active');
    document.body.classList.add('has-open-modal');
    setTimeout(() => focusFirstElement(modal), 0);
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    const index = modalStack.lastIndexOf(modalId);
    if (index >= 0) modalStack.splice(index, 1);
    const fallback = modalLastFocus.get(modalId);
    modalLastFocus.delete(modalId);
    const topModal = getTopModal();
    if (topModal) return setTimeout(() => focusFirstElement(topModal), 0);
    document.body.classList.remove('has-open-modal');
    if (fallback instanceof HTMLElement) setTimeout(() => fallback.focus(), 0);
}

export function openIOSAlert(title, desc, confirmCallback) {
    const titleEl = document.getElementById('iosAlertTitle');
    const descEl = document.getElementById('iosAlertDesc');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    pendingAlertAction = confirmCallback;
    openModal('iosAlertModal');
}

function closeIOSAlert() {
    closeModal('iosAlertModal');
    pendingAlertAction = null;
}

function confirmIOSAlert() {
    if (pendingAlertAction) pendingAlertAction();
    closeIOSAlert();
}

export function initIOSAlert() {
    const confirmBtn = document.getElementById('iosAlertConfirmBtn');
    if (confirmBtn) confirmBtn.onclick = confirmIOSAlert;
    const cancelBtn = document.querySelector('#iosAlertModal .ios-alert-btn:first-child');
    if (cancelBtn) cancelBtn.onclick = closeIOSAlert;
}

export function initModalA11y() {
    ensureModalA11y();
}
