import { renderCheckbox, renderSwitch } from './ui-controls.js';
import { renderUiState } from './ui-state.js';

export function renderUserTableView({ state, deps, canManageUsers, isLockedUser, updateUserBatchBar }) {
    const container = document.getElementById('userTableBody');
    if (!container) return;
    updateUserBatchBar();
    if (state.users.length === 0) {
        container.innerHTML = renderUiState({ icon: 'ph ph-users', title: '暂无用户', tone: 'empty', compact: true });
        return;
    }
    container.innerHTML = state.users.map((user) => renderUserBlock(user, {
        state, escapeHtml: deps.escapeHtml, formatDate: deps.formatDate, canManageUsers, isLockedUser
    })).join('');
    syncQuotaMeters(container);
}

function renderUserBlock(user, ctx) {
    const meta = buildUserMeta(user, ctx);
    if (meta.locked) ctx.state.selectedUserIds.delete(user.id);
    return `
        <div class="user-block ${meta.isSelected ? 'selected' : ''}" id="user-block-${user.id}">
            <div class="t-row" data-action="toggle-expand" data-user-id="${user.id}">
                <div class="control-cell">${renderUserCheckbox(user, meta)}</div>
                <div class="col-avatar"><div class="avatar">${meta.avatar}</div></div>
                <div class="col-info">
                    <span class="name">${meta.displayName}</span>
                    <span class="username">@${meta.username}</span>
                </div>
                ${renderUserColumns(user, meta)}
            </div>
            ${renderDetailsPanel(user, meta, ctx)}
        </div>
    `;
}

function buildUserMeta(user, ctx) {
    const subEmails = user.mailboxes || [];
    const used = subEmails.length;
    const locked = ctx.isLockedUser(user);
    const quota = locked ? '∞' : (user.quota || 10);
    return {
        subEmails,
        used,
        locked,
        selectable: ctx.canManageUsers() && !locked,
        isSelected: ctx.state.selectedUserIds.has(user.id),
        quota,
        percentage: locked ? 100 : Math.min((used / (user.quota || 10)) * 100, 100),
        roleLabel: locked ? 'Super Admin' : user.role,
        avatar: ctx.escapeHtml((user.name || user.username || 'U').substring(0, 2).toUpperCase()),
        displayName: ctx.escapeHtml(user.name || user.username || ''),
        username: ctx.escapeHtml(user.username || ''),
    };
}

function renderUserCheckbox(user, meta) {
    return renderCheckbox({
        checked: meta.isSelected,
        action: meta.selectable ? 'toggle-select-user' : '',
        label: meta.selectable ? `选择用户 ${user.username || user.name || ''}` : '该用户不可选择',
        disabled: !meta.selectable,
        attrs: { 'data-user-id': user.id }
    });
}

function renderUserColumns(user, meta) {
    return `
        <div class="col-meta">${renderSendSwitch(user, meta)}</div>
        <div class="col-meta">${renderQuota(meta)}</div>
        <div class="col-meta"><span class="role-badge ${meta.locked ? 'role-super' : ''}">${meta.roleLabel}</span></div>
        <div class="col-meta">${renderStatusSelect(user, meta)}</div>
        <div class="col-meta action-cell">${renderActionButtons(user, meta)}</div>
        <div class="col-meta meta-right">${meta.locked ? '<i class="ph-bold ph-lock"></i>' : '<i class="ph-bold ph-caret-right chevron"></i>'}</div>
    `;
}

function renderSendSwitch(user, meta) {
    return `
        ${renderSwitch({
            checked: user.can_send,
            action: meta.selectable ? 'toggle-send-permission' : '',
            label: user.can_send ? '禁止用户发件' : '允许用户发件',
            disabled: !meta.selectable,
            className: 'switch-compact',
            attrs: { 'data-user-id': user.id }
        })}
        <span class="switch-mini-label">${user.can_send ? '允许' : '禁止'}</span>
    `;
}

function renderQuota(meta) {
    return `
        <div class="quota-container">
            <div class="quota-text">${meta.used} / ${meta.quota} 个</div>
            <div class="quota-track"><div class="quota-fill" data-percent="${meta.percentage}"></div></div>
        </div>
    `;
}

function renderStatusSelect(user, meta) {
    return `
        <select class="status-select ${user.status === 'Active' ? 'active' : 'inactive'}" data-action="change-user-status" data-user-id="${user.id}" ${meta.selectable ? '' : 'disabled'}>
            <option value="Active" ${user.status === 'Active' ? 'selected' : ''}>活跃</option>
            <option value="Inactive" ${user.status !== 'Active' ? 'selected' : ''}>停用</option>
        </select>
    `;
}

function renderActionButtons(user, meta) {
    if (!meta.selectable) return '<div class="row-locked"><i class="ph-bold ph-lock"></i><span>只读</span></div>';
    return `
        <button class="action-btn" type="button" title="编辑" aria-label="编辑用户" data-action="open-edit-user" data-user-id="${user.id}"><i class="ph-bold ph-pencil-simple"></i></button>
        <button class="action-btn delete" type="button" title="删除" aria-label="删除用户" data-action="delete-user" data-user-id="${user.id}"><i class="ph-bold ph-trash"></i></button>
    `;
}

function renderDetailsPanel(user, meta, ctx) {
    if (meta.locked) return '';
    return `
        <div class="details-panel" onclick="event.stopPropagation()">
            <div class="panel-content">
                <div class="detail-panel-header">
                    <span class="subemail-title">已分配邮箱列表 (${meta.used})</span>
                    ${renderAssignButton(user, meta)}
                </div>
                <div id="sub-emails-${user.id}">${renderSubEmails(user, meta, ctx)}</div>
            </div>
        </div>
    `;
}

function renderAssignButton(user, meta) {
    if (!meta.selectable) return '<div class="locked-hint">只读</div>';
    return `<button class="btn btn-primary assign-small-btn" type="button" data-action="open-assign-modal" data-user-id="${user.id}"><i class="ph-bold ph-plus"></i> 分配新邮箱</button>`;
}

function renderSubEmails(user, meta, ctx) {
    if (meta.subEmails.length === 0) return '<div class="table-empty-inline">暂无分配邮箱</div>';
    return meta.subEmails.map((mail) => renderSubEmailItem(user, mail, meta, ctx)).join('');
}

function renderSubEmailItem(user, mail, meta, ctx) {
    const safeAddress = ctx.escapeHtml(String(mail.address || ''));
    return `
        <div class="email-item" id="email-item-${mail.id}">
            <div class="subemail-main">
                <i class="ph ph-envelope-simple icon-accent"></i>
                <span class="mail-address-text">${safeAddress}</span>
                <span class="mail-date-text">${ctx.formatDate(mail.created_at)}</span>
            </div>
            ${renderSubEmailActions(user, mail, safeAddress, meta)}
        </div>
    `;
}

function renderSubEmailActions(user, mail, safeAddress, meta) {
    if (!meta.selectable) return '<div class="email-actions disabled"><i class="ph-bold ph-lock"></i></div>';
    return `
        <div class="email-actions">
            <button class="action-btn" type="button" aria-label="复制邮箱" data-action="copy-mailbox" data-address="${safeAddress}"><i class="ph-bold ph-copy"></i></button>
            <button class="action-btn delete" type="button" aria-label="删除邮箱" data-action="delete-sub-email" data-user-id="${user.id}" data-mailbox-id="${mail.id}"><i class="ph-bold ph-trash"></i></button>
        </div>
    `;
}

function syncQuotaMeters(container) {
    if (typeof container.querySelectorAll !== 'function') return;
    container.querySelectorAll('.quota-fill[data-percent]').forEach((meter) => {
        meter.style.width = `${meter.dataset.percent}%`;
    });
}
