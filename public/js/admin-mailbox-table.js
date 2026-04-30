import { renderCheckbox, renderSwitch } from './ui-controls.js';
import { renderUiState } from './ui-state.js';

export function renderAllMailboxesView({ state, deps, updateEmailBatchBar }) {
    const container = document.getElementById('emailListBody');
    if (!container) return;
    updateEmailBatchBar();
    if (state.allMailboxes.length === 0) {
        container.innerHTML = renderUiState({ icon: 'ph ph-tray', title: '无匹配邮箱', tone: 'empty', compact: true });
        return;
    }
    container.innerHTML = state.allMailboxes.map((item) => renderMailboxRow(item, state, deps)).join('');
}

function renderMailboxRow(item, state, deps) {
    const meta = buildMailboxMeta(item, state, deps.escapeHtml);
    return `
        <div class="e-row ${meta.isSelected ? 'selected' : ''} ${meta.isExpanded ? 'mobile-details-open' : ''}" id="email-row-${item.id}">
            <div class="control-cell">${renderMailboxCheckbox(item, meta)}</div>
            <div class="col-email"><i class="ph ph-envelope-simple muted-icon"></i><span>${meta.safeAddress}</span></div>
            <div class="col-created-by e-detail-field"><span class="locked-hint" title="创建者不可编辑">${meta.createdBy}</span></div>
            ${renderRemarkCell(item, meta)}
            ${renderPasswordCell(item, meta)}
            ${renderLoginCell(item)}
            <div class="cell-date e-detail-field">${deps.formatDate(item.created_at)}</div>
            ${renderMailboxActions(item, meta)}
        </div>
    `;
}

function buildMailboxMeta(item, state, escapeHtml) {
    const isDefaultPwd = !item.password_changed;
    const remarkRaw = String(item.remark || '').trim();
    const rawAddress = String(item.address || '');
    return {
        isSelected: state.selectedEmailIds.has(item.id),
        isExpanded: state.expandedEmailDetails.has(item.id),
        rawAddress,
        safeAddress: escapeHtml(rawAddress),
        createdBy: escapeHtml(String(item.created_by_username || '系统')),
        pwdText: isDefaultPwd ? '默认 (同邮箱)' : '已自定义',
        pwdClass: isDefaultPwd ? '' : 'custom',
        remarkHtml: remarkRaw ? escapeHtml(remarkRaw) : '<span class="remark-placeholder">添加备注</span>',
    };
}

function renderRemarkCell(item, meta) {
    return `
        <div class="col-remark e-detail-field" data-action="open-remark-modal" data-id="${item.id}" data-address="${meta.safeAddress}">
            <i class="ph-bold ph-note-pencil table-icon-muted"></i>
            <span class="remark-text">${meta.remarkHtml}</span>
        </div>
    `;
}

function renderPasswordCell(item, meta) {
    return `
        <div class="col-pass e-detail-field" data-action="open-pwd-modal" data-id="${item.id}" data-address="${meta.safeAddress}">
            <div class="pass-dot ${meta.pwdClass}"></div>
            <span class="pass-state ${meta.pwdClass}">${meta.pwdText}</span>
            <i class="ph-bold ph-pencil-simple table-icon-tiny"></i>
        </div>
    `;
}

function renderLoginCell(item) {
    return `
        <div class="hover-control-group">
            ${renderSwitch({
                id: item.id,
                checked: item.is_login_allowed,
                action: 'toggle-login-allowed',
                label: item.is_login_allowed ? '禁止邮箱登录' : '允许邮箱登录'
            })}
            <span class="login-state-text">${item.is_login_allowed ? '允许' : '禁止'}</span>
        </div>
    `;
}

function renderMailboxActions(item, meta) {
    return `
        <div class="col-actions">
            <button class="icon-btn e-detail-toggle" type="button" title="${meta.isExpanded ? '收起详情' : '展开详情'}" aria-label="${meta.isExpanded ? '收起详情' : '展开详情'}" data-action="toggle-email-details" data-id="${item.id}">
                <i class="ph-bold ph-caret-down"></i>
            </button>
            <button class="icon-btn" type="button" title="查看收件箱" aria-label="查看收件箱" data-action="open-mailbox-viewer" data-address="${meta.safeAddress}">
                <i class="ph-bold ph-envelope-open"></i>
            </button>
            <button class="icon-btn" type="button" title="复制邮箱" aria-label="复制邮箱" data-action="copy-mailbox" data-address="${meta.safeAddress}">
                <i class="ph-bold ph-copy"></i>
            </button>
            <button class="icon-btn delete" type="button" title="删除" aria-label="删除邮箱" data-action="delete-single-mailbox" data-id="${item.id}">
                <i class="ph-bold ph-trash"></i>
            </button>
        </div>
    `;
}

function renderMailboxCheckbox(item, meta) {
    return renderCheckbox({
        id: item.id,
        checked: meta.isSelected,
        action: 'toggle-select-email',
        label: `选择邮箱 ${meta.rawAddress}`
    });
}

export function renderEmailPagination(state) {
    const container = document.getElementById('emailPagination');
    const infoEl = document.getElementById('emailPageInfo');
    const prevBtn = document.getElementById('emailPrevBtn');
    const nextBtn = document.getElementById('emailNextBtn');
    const sizeSelect = document.getElementById('emailPageSize');
    if (!container || !infoEl || !prevBtn || !nextBtn || !sizeSelect) return;
    const pageState = state.allMailboxesPageState;
    const totalPages = Math.max(1, Number(pageState.totalPages) || 1);
    const page = Math.min(Math.max(1, Number(pageState.page) || 1), totalPages);
    const hasPrev = page > 1;
    const hasNext = page < totalPages || pageState.hasMore;
    const totalText = Number.isFinite(Number(pageState.total)) ? `共 ${pageState.total} 项` : `当前 ${state.allMailboxes.length} 项`;
    infoEl.textContent = `第 ${page} / ${totalPages} 页 · ${totalText}`;
    prevBtn.disabled = !hasPrev;
    nextBtn.disabled = !hasNext;
    sizeSelect.value = String(pageState.limit);
    container.style.display = (Number(pageState.total) > pageState.limit || hasNext || hasPrev) ? 'flex' : 'none';
}
