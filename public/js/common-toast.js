let toastTimeout = null;

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const msgEl = document.getElementById('toastMsg');
    if (msgEl) msgEl.textContent = msg;

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}
