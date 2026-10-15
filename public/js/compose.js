import { actions } from './page-actions.js';
import { showToast, openModal, closeModal } from './common.js';

export function createComposeController({ sendAPI, getFromAddress, canSend }) {
    let sending = false;

    function openSendModal() {
        if (!getFromAddress()) return showToast('请先生成邮箱');
        if (canSend && !canSend()) return showToast('您没有发送邮件的权限');
        for (const id of ['senderNameInput', 'toInput', 'subjectInput', 'contentInput']) {
            document.getElementById(id).value = '';
        }
        checkComposeInput();
        openModal('sendModalOverlay');
    }

    function closeSendModal() {
        closeModal('sendModalOverlay');
    }

    function checkComposeInput() {
        const { to, subject } = readComposeValues();
        const button = document.getElementById('sendBtn');
        button.disabled = sending || !to || !subject;
        button.classList.toggle('active', !button.disabled);
    }

    async function doSendEmail() {
        if (sending) return;
        if (canSend && !canSend()) return showToast('您没有发送邮件的权限');
        const values = readComposeValues();
        if (!values.to || !values.subject) return showToast('请填写收件人和主题');
        sending = true;
        checkComposeInput();
        try {
            await sendAPI.send(getFromAddress(), values.fromName, values.to, values.subject, values.content);
            closeSendModal();
            showToast('邮件已发送');
        } catch (error) {
            showToast(error.message || '发送失败');
        } finally {
            sending = false;
            checkComposeInput();
        }
    }

    const handlers = { openSendModal, closeSendModal, checkComposeInput, doSendEmail };
    Object.assign(actions, handlers);
    return handlers;
}

function readComposeValues() {
    return {
        fromName: document.getElementById('senderNameInput').value.trim() || 'Veil',
        to: document.getElementById('toInput').value.trim(),
        subject: document.getElementById('subjectInput').value.trim(),
        content: document.getElementById('contentInput').value,
    };
}
