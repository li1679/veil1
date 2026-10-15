import { showToast } from './common-toast.js';

export async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(String(text));
            showToast('已复制');
            return true;
        }
    } catch (_) { /* Use the selection-based copy path when clipboard permission is denied. */ }
    const previous = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = String(text);
    textarea.className = 'clipboard-helper';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); }
    catch (_) { copied = false; }
    finally { textarea.remove(); previous?.focus({ preventScroll: true }); }
    showToast(copied ? '已复制' : '复制失败，请手动选择并复制');
    return copied;
}
