import { escapeHtml } from './common.js';

const ICON_CLASS_PATTERN = /^[a-z0-9\s_-]+$/i;

export function renderUiState({ icon = '', title = '', description = '', tone = 'empty', compact = false } = {}) {
    const safeTone = escapeHtml(tone || 'empty');
    const compactClass = compact ? ' state-compact' : '';
    const iconHtml = icon ? `<i class="${safeIconClass(icon)}" aria-hidden="true"></i>` : '';
    const titleHtml = title ? `<span class="state-title">${escapeHtml(title)}</span>` : '';
    const descriptionHtml = description ? `<span class="state-description">${escapeHtml(description)}</span>` : '';
    return `<div class="state-block state-${safeTone}${compactClass}" aria-live="polite">${iconHtml}${titleHtml}${descriptionHtml}</div>`;
}

function safeIconClass(value) {
    const normalized = String(value || '').trim();
    if (!ICON_CLASS_PATTERN.test(normalized)) return '';
    return escapeHtml(normalized.replace(/\s+/g, ' '));
}
