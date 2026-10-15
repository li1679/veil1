import { actions } from './page-actions.js';
import { renderInboxList, renderInboxError } from './inbox-renderer.js';
import { renderUiState } from './ui-state.js';

export function createMailboxViewerController({ state, deps, inbox }) {
    let controller = null;
    const modal = document.getElementById('mailboxViewerModal');
    const list = document.getElementById('mailboxViewerList');
    const count = document.getElementById('mailboxViewerCount');
    modal.addEventListener('modal:closed', () => {
        controller?.abort(); controller = null;
        state.viewerMailbox = null; state.viewerEmails = []; list.replaceChildren();
    });
    async function loadMailboxViewer() {
        const address = state.viewerMailbox;
        if (!address) return;
        controller?.abort();
        const request = new AbortController();
        controller = request;
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = renderUiState({ title: '加载邮件中…', tone: 'loading', compact: true });
        try {
            const response = await deps.emailAPI.getEmails(address, { signal: request.signal });
            if (controller !== request || address !== state.viewerMailbox) return;
            state.viewerEmails = response.emails;
            renderInboxList(list, state.viewerEmails, { open: 'open-viewer-mail-detail', copy: 'copy-viewer-email-code', remove: 'delete-viewer-email-item' });
            count.textContent = `最近 ${state.viewerEmails.length} 封`;
        } catch (error) {
            if (error.name === 'AbortError' || controller !== request) return;
            renderInboxError(list, error.message);
            count.textContent = '加载失败';
        } finally { if (controller === request) list.setAttribute('aria-busy', 'false'); }
    }
    const closeMailboxViewer = () => deps.closeModal('mailboxViewerModal');
    Object.assign(actions, {
        openMailboxViewer(address) { state.viewerMailbox = address; document.getElementById('mailboxViewerAddress').textContent = address; deps.openModal('mailboxViewerModal'); return loadMailboxViewer(); },
        closeMailboxViewer,
        openViewerMailDetail(id) { closeMailboxViewer(); return actions.openMailDetail(id); },
        refreshMailboxViewer: loadMailboxViewer,
        copyViewerEmailCode(event, id) {
            event?.preventDefault(); event?.stopPropagation();
            const email = state.viewerEmails.find((item) => String(item.id) === String(id));
            const code = inbox.getEmailVerificationCode(email);
            if (code) return deps.copyText(code);
            deps.showToast('未找到验证码');
        },
        async deleteViewerEmailItem(event, id) {
            event?.preventDefault(); event?.stopPropagation();
            try { await deps.emailAPI.delete(id); deps.showToast('已删除'); await loadMailboxViewer(); }
            catch (error) { deps.showToast(error.message || '删除失败'); }
        },
    });
    return { loadMailboxViewer };
}
