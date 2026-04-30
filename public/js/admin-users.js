import { renderUserTableView } from './admin-user-table.js';
import { canManageUsers, isLockedUser, renderDomainOptions } from './admin-utils.js';
export const createAdminUsersController = ({ state, deps, domainSelector }) => {
    const { userAPI, showToast, openIOSAlert, openModal, closeModal, animateDelete, animateBatchDelete } = deps;
    function normalizeUserList(list) {
        const normalized = (list || []).map((user) => ({ ...user, is_super_admin: Boolean(user?.is_super_admin) }));
        return [
            ...normalized.filter((user) => user.is_super_admin),
            ...normalized.filter((user) => !user.is_super_admin),
        ];
    }
    function ensureManageAccess(user = null) {
        if (!canManageUsers(state)) {
            showToast('无权限');
            return false;
        }
        if (user && isLockedUser(user)) {
            showToast('超级管理员不可修改');
            return false;
        }
        return true;
    }
    async function loadUsers() {
        try {
            const response = await userAPI.getUsers();
            state.users = normalizeUserList(response.users || []);
            if (!canManageUsers(state)) state.selectedUserIds.clear();
            renderUserTable();
            renderUserFilter();
        } catch (error) {
            console.error('Failed to load users:', error);
            showToast('加载用户失败');
        }
    }
    function renderUserTable() {
        renderUserTableView({
            state,
            deps,
            canManageUsers: () => canManageUsers(state),
            isLockedUser,
            updateUserBatchBar,
        });
    }
    function renderUserFilter() {
        const filter = document.getElementById('userFilter');
        if (!filter) return;
        const currentValue = String(filter.value || '');
        const options = ['<option value="">全部用户</option>', ...state.users.map((user) => renderUserFilterOption(user, currentValue))];
        filter.innerHTML = options.filter(Boolean).join('');
    }
    function renderUserFilterOption(user, currentValue) {
        const id = user && typeof user.id !== 'undefined' ? String(user.id) : '';
        if (!id) return '';
        const username = deps.escapeHtml(String(user?.username || ''));
        return `<option value="${id}" ${id === currentValue ? 'selected' : ''}>${username}</option>`;
    }

    function updateUserBatchBar() {
        const count = state.selectedUserIds.size;
        document.getElementById('selectedUsersCount').textContent = count;
        const bar = document.getElementById('userBatchBar');
        if (count > 0 && canManageUsers(state)) bar.classList.add('show');
        else bar.classList.remove('show');
    }

    function registerGlobals() {
        window.toggleExpand = toggleExpand;
        window.toggleSelectUser = toggleSelectUser;
        window.toggleSelectAllUsers = toggleSelectAllUsers;
        window.cancelUserSelection = cancelUserSelection;
        window.toggleSendPermission = toggleSendPermission;
        window.changeUserStatus = changeUserStatus;
        window.deleteUser = deleteUser;
        window.batchDeleteUsers = batchDeleteUsers;
        window.openUserModal = openUserModal;
        window.openEditUser = openEditUser;
        window.saveUser = saveUser;
        window.openAssignModal = openAssignModal;
        window.confirmAssignEmail = confirmAssignEmail;
        window.deleteSubEmail = deleteSubEmail;
    }

    function toggleExpand(userId, event) {
        if (event?.target.closest('button, .ios-switch, select, .custom-checkbox')) return;
        const user = state.users.find((item) => item.id === userId);
        if (user && isLockedUser(user)) return;
        document.getElementById(`user-block-${userId}`)?.classList.toggle('expanded');
    }

    function toggleSelectUser(id) {
        if (!canManageUsers(state)) return;
        const user = state.users.find((item) => item.id === id);
        if (!user || isLockedUser(user)) return;
        if (state.selectedUserIds.has(id)) state.selectedUserIds.delete(id);
        else state.selectedUserIds.add(id);
        renderUserTable();
    }

    function toggleSelectAllUsers() {
        if (!canManageUsers(state)) return;
        const checkbox = document.getElementById('selectAllUsersCheckbox');
        const selectableUsers = state.users.filter((user) => !isLockedUser(user));
        if (state.selectedUserIds.size === selectableUsers.length) {
            state.selectedUserIds.clear();
            checkbox.classList.remove('checked'); checkbox.setAttribute('aria-checked', 'false');
        } else {
            selectableUsers.forEach((user) => state.selectedUserIds.add(user.id));
            checkbox.classList.add('checked'); checkbox.setAttribute('aria-checked', 'true');
        }
        renderUserTable();
    }

    function cancelUserSelection() {
        if (!canManageUsers(state)) return;
        state.selectedUserIds.clear();
        const checkbox = document.getElementById('selectAllUsersCheckbox');
        checkbox.classList.remove('checked'); checkbox.setAttribute('aria-checked', 'false');
        renderUserTable();
    }

    async function toggleSendPermission(userId) {
        const user = state.users.find((item) => item.id === userId);
        if (!user || !ensureManageAccess(user)) return;
        try {
            await userAPI.update(userId, { can_send: !user.can_send });
            user.can_send = !user.can_send;
            renderUserTable();
            showToast(user.can_send ? '已允许发件' : '已禁止发件');
        } catch (error) {
            showToast(error.message || '操作失败');
        }
    }

    async function changeUserStatus(userId, status) {
        const user = state.users.find((item) => item.id === userId);
        if (!user || !ensureManageAccess(user)) return;
        try {
            await userAPI.update(userId, { status });
            user.status = status;
            renderUserTable();
            showToast('状态已更新');
        } catch (error) {
            showToast(error.message || '操作失败');
        }
    }

    function deleteUser(userId) {
        const user = state.users.find((item) => item.id === userId);
        if (!user || !ensureManageAccess(user)) return;
        openIOSAlert('删除用户', '确定要删除此用户吗？操作无法撤销。', async () => removeUser(userId));
    }

    async function removeUser(userId) {
        try {
            await userAPI.delete(userId);
            animateDelete(document.getElementById(`user-block-${userId}`), () => {
                state.users = state.users.filter((user) => user.id !== userId);
                state.selectedUserIds.delete(userId);
                renderUserTable();
            });
            showToast('已删除用户');
        } catch (error) {
            showToast(error.message || '删除失败');
        }
    }

    function batchDeleteUsers() {
        if (!canManageUsers(state)) return showToast('无权限');
        const count = state.selectedUserIds.size;
        if (count === 0) return;
        openIOSAlert('批量删除用户', `确定删除选中的 ${count} 位用户吗？`, async () => removeSelectedUsers(count));
    }

    async function removeSelectedUsers(count) {
        try {
            const ids = Array.from(state.selectedUserIds);
            await userAPI.batchDelete(ids);
            animateBatchDelete(ids, 'user-block-', () => {
                state.users = state.users.filter((user) => !state.selectedUserIds.has(user.id));
                state.selectedUserIds.clear();
                renderUserTable();
            });
            showToast(`已删除 ${count} 位用户`);
        } catch (error) {
            showToast(error.message || '删除失败');
        }
    }

    function openUserModal() {
        if (!canManageUsers(state)) return showToast('无权限');
        fillUserModal({ id: '', name: '', username: '', password: '', quota: 10, canSend: false, initialEmail: true });
        const domainSelect = document.getElementById('inputInitialDomain');
        renderDomainOptions(domainSelect, domainSelector.getSelectedDomain(), domainSelector, deps.escapeHtml);
        openModal('userModal');
    }

    function openEditUser(userId) {
        const user = state.users.find((item) => item.id === userId);
        if (!user || !ensureManageAccess(user)) return;
        fillUserModal({ id: user.id, name: user.name || '', username: user.username, password: '', quota: user.quota || 10, canSend: user.can_send, initialEmail: false });
        openModal('userModal');
    }

    function fillUserModal(values) {
        document.getElementById('modalTitle').textContent = values.id ? '编辑用户' : '新增用户';
        document.getElementById('editUserId').value = values.id;
        document.getElementById('inputName').value = values.name;
        document.getElementById('inputLoginUsername').value = values.username;
        document.getElementById('inputPassword').value = values.password;
        document.getElementById('inputQuota').value = values.quota;
        const sendSwitch = document.getElementById('inputSendSwitch');
        sendSwitch.classList.toggle('on', Boolean(values.canSend)); sendSwitch.setAttribute('aria-checked', values.canSend ? 'true' : 'false');
        document.getElementById('inputInitialEmail').value = '';
        document.getElementById('initialEmailRow').style.display = values.initialEmail ? 'block' : 'none';
    }

    async function saveUser() {
        if (!canManageUsers(state)) return showToast('无权限');
        const userData = readUserFormData();
        if (!userData.username) return showToast('请填写用户名');
        if (!userData.id && !userData.password) return showToast('请填写密码');
        try {
            if (userData.id) await userAPI.update(userData.id, userData);
            else await userAPI.create(userData);
            showToast(userData.id ? '已更新' : '已创建');
            closeModal('userModal');
            loadUsers();
        } catch (error) {
            showToast(error.message || '保存失败');
        }
    }

    function readUserFormData() {
        const id = document.getElementById('editUserId').value;
        const userData = {
            id,
            name: document.getElementById('inputName').value.trim(),
            username: document.getElementById('inputLoginUsername').value.trim(),
            password: document.getElementById('inputPassword').value,
            quota: parseInt(document.getElementById('inputQuota').value) || 10,
            can_send: document.getElementById('inputSendSwitch').classList.contains('on'),
        };
        if (!id) addInitialMailbox(userData);
        return userData;
    }

    function addInitialMailbox(userData) {
        const prefix = document.getElementById('inputInitialEmail').value.trim();
        if (!prefix) return;
        userData.initial_mailbox = { prefix, domain: document.getElementById('inputInitialDomain').value };
    }

    function openAssignModal(userId) {
        const user = state.users.find((item) => item.id === userId);
        if (!user || !ensureManageAccess(user)) return;
        document.getElementById('assignUserId').value = userId;
        document.getElementById('assignPrefix').value = '';
        renderDomainOptions(document.getElementById('assignDomain'), domainSelector.getSelectedDomain(), domainSelector, deps.escapeHtml);
        openModal('assignEmailModal');
    }

    async function confirmAssignEmail() {
        if (!canManageUsers(state)) return showToast('无权限');
        const userId = parseInt(document.getElementById('assignUserId').value);
        const prefix = document.getElementById('assignPrefix').value.trim();
        if (!prefix) return showToast('请输入前缀');
        try {
            await userAPI.assignMailbox(userId, prefix, document.getElementById('assignDomain').value);
            closeModal('assignEmailModal');
            loadUsers();
            showToast('分配成功');
        } catch (error) {
            showToast(error.message || '分配失败');
        }
    }

    function deleteSubEmail(userId, mailboxId) {
        const user = state.users.find((item) => item.id === userId);
        if (!user || !ensureManageAccess(user)) return;
        openIOSAlert('删除邮箱', '确定永久删除此邮箱吗？', async () => removeSubEmail(userId, mailboxId));
    }

    async function removeSubEmail(userId, mailboxId) {
        try {
            await userAPI.removeMailbox(userId, mailboxId);
            animateDelete(document.getElementById(`email-item-${mailboxId}`), () => loadUsers());
            showToast('已删除');
        } catch (error) {
            showToast(error.message || '删除失败');
        }
    }

    registerGlobals();
    return { loadUsers, renderUserFilter, renderUserTable };
};