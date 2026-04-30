export function registerMailboxEditors(args) {
    const ctx = { ...args, currentPwdEditId: null, currentRemarkEditId: null };
    window.openPwdModal = (id, address) => openPwdModal(ctx, id, address);
    window.closePwdModal = () => closePwdModal(ctx);
    window.copyOldPassword = (event) => copyOldPassword(ctx, event);
    window.savePassword = () => savePassword(ctx);
    window.openRemarkModal = (id, address) => openRemarkModal(ctx, id, address);
    window.closeRemarkModal = () => closeRemarkModal(ctx);
    window.saveRemark = () => saveRemark(ctx);
}

async function openPwdModal(ctx, id, address) {
    ctx.currentPwdEditId = id;
    document.getElementById('pwdEditEmail').textContent = address;
    resetPasswordModalFields();
    ctx.deps.openModal('passwordModal');
    try {
        const res = await ctx.deps.adminMailboxAPI.getPassword(address);
        if (ctx.currentPwdEditId === id) fillOldPasswordHint(res);
    } catch (error) {
        if (ctx.currentPwdEditId === id) document.getElementById('oldPasswordHint').textContent = error?.message || '获取原密码失败';
    }
}

function closePwdModal(ctx) {
    ctx.deps.closeModal('passwordModal');
    ctx.currentPwdEditId = null;
}

function copyOldPassword(ctx, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const value = document.getElementById('oldPasswordInput')?.value || '';
    if (!value) return ctx.deps.showToast('暂无可复制的原密码');
    ctx.deps.copyText(value);
}

async function savePassword(ctx) {
    if (!ctx.currentPwdEditId) return;
    const password = document.getElementById('newPasswordInput').value.trim();
    const mailbox = ctx.state.allMailboxes.find((item) => item.id === ctx.currentPwdEditId);
    try {
        await ctx.deps.adminMailboxAPI.update(ctx.currentPwdEditId, {
            password: password || null,
            password_changed: Boolean(password && password !== mailbox?.address),
        });
        ctx.deps.showToast(!password || password === mailbox?.address ? '已恢复默认密码' : '密码已修改');
        ctx.loadAllMailboxes();
        closePwdModal(ctx);
    } catch (error) {
        ctx.deps.showToast(error.message || '保存失败');
    }
}

function openRemarkModal(ctx, id, address) {
    ctx.currentRemarkEditId = id;
    document.getElementById('remarkEditEmail').textContent = address;
    const mailbox = ctx.state.allMailboxes.find((item) => item.id === id);
    document.getElementById('remarkInput').value = mailbox?.remark || '';
    ctx.deps.openModal('remarkModal');
}

function closeRemarkModal(ctx) {
    ctx.deps.closeModal('remarkModal');
    ctx.currentRemarkEditId = null;
}

async function saveRemark(ctx) {
    if (!ctx.currentRemarkEditId) return;
    const remark = (document.getElementById('remarkInput')?.value || '').trim();
    const mailbox = ctx.state.allMailboxes.find((item) => item.id === ctx.currentRemarkEditId);
    try {
        const res = await ctx.deps.adminMailboxAPI.update(ctx.currentRemarkEditId, { remark });
        if (mailbox) mailbox.remark = (res && typeof res.remark === 'string') ? res.remark : remark;
        ctx.renderAllMailboxes();
        ctx.deps.showToast('备注已保存');
        closeRemarkModal(ctx);
    } catch (error) {
        ctx.deps.showToast(error.message || '保存失败');
    }
}

function resetPasswordModalFields() {
    document.getElementById('oldPasswordInput').value = '';
    document.getElementById('oldPasswordHint').innerHTML = '<i class="ph ph-info"></i> 正在获取原密码...';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('newPasswordInput').placeholder = '';
}

function fillOldPasswordHint(res) {
    document.getElementById('oldPasswordInput').value = res?.password ?? '';
    const hint = document.getElementById('oldPasswordHint');
    if (!res?.recoverable && !res?.is_default) {
        hint.innerHTML = '<i class="ph ph-info"></i> 该邮箱密码已自定义，但旧密码未保存，无法显示。可直接设置新密码。';
    } else if (res?.is_default) {
        hint.innerHTML = '<i class="ph ph-info"></i> 当前为默认密码（同邮箱地址）。';
    } else {
        hint.textContent = '';
    }
}
