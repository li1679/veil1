import { escapeHtml } from './common.js';
import { renderUiState } from './ui-state.js';

export function renderHistoryLoading() {
    return renderUiState({ icon: 'ph ph-spinner spinning', title: '加载中...', tone: 'loading', compact: true });
}

export function renderHistoryEmpty() {
    return renderUiState({ icon: 'ph ph-tray', title: '暂无历史记录', tone: 'empty', compact: true });
}

export function renderHistoryItem(item) {
    const safeEmail = escapeHtml(item.email);
    const safeTime = escapeHtml(item.time);
    const count = escapeHtml(item.emailCount ?? 0);
    const pinnedClass = item.pinned ? ' is-pinned' : '';
    const pinLabel = item.pinned ? '取消置顶' : '置顶邮箱';
    return `
        <div class="history-item" id="history-${escapeHtml(item.id)}" role="button" tabindex="0" data-action="restore-email" data-email="${safeEmail}">
            <div class="h-info"><div>${safeEmail}</div><div>${safeTime} • ${count} 封</div></div>
            <div class="h-actions">
                <button class="h-btn" type="button" data-action="toggle-pin" data-id="${escapeHtml(item.id)}" aria-label="${pinLabel}">
                    <i class="ph ph-push-pin pin-icon${pinnedClass}" aria-hidden="true"></i>
                </button>
                <button class="h-btn" type="button" data-action="delete-history" data-id="${escapeHtml(item.id)}" aria-label="删除历史邮箱">
                    <i class="ph-bold ph-trash" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    `;
}
