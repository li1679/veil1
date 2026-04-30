import { showToast } from './common-toast.js';

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制');
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制');
    }
}
