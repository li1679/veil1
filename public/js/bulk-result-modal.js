import { closeModal, openModal } from './common-modal.js';
import { copyText } from './common-clipboard.js';
import { escapeHtml } from './common-html.js';
import { showToast } from './common-toast.js';

const BULK_MODAL_ID = 'bulkResultModal';
let lastBulkAddresses = [];
let globalsRegistered = false;

export function showBulkResult(result) {
    const summary = document.getElementById('bulkResultSummary');
    const list = document.getElementById('bulkResultList');
    const failed = document.getElementById('bulkResultFailed');
    if (!summary || !list || !failed) return;

    const created = Array.isArray(result?.created) ? result.created : [];
    const fails = Array.isArray(result?.failed) ? result.failed : [];
    lastBulkAddresses = created.map((item) => item?.address).filter(Boolean);

    summary.textContent = formatSummary(result, created.length, fails.length);
    list.innerHTML = created.length === 0
        ? '<div class="state-block state-empty state-compact"><span class="state-title">无成功生成的邮箱</span></div>'
        : created.map(renderAddressRow).join('');
    failed.textContent = fails.length === 0 ? '' : `失败 ${fails.length} 个：${summarizeFailures(fails)}`;

    registerBulkResultGlobals();
    openModal(BULK_MODAL_ID);
}

function renderAddressRow(item) {
    const address = escapeHtml(String(item?.address || ''));
    const expires = item?.expires
        ? `<span class="bulk-result-expires">到期 ${escapeHtml(String(item.expires))}</span>`
        : '';
    return `<div class="bulk-result-row" role="listitem">
        <div class="bulk-result-main"><span class="bulk-result-email">${address}</span>${expires}</div>
        <button class="btn btn-ghost bulk-result-copy" type="button" data-bulk-copy="${address}" aria-label="复制 ${address}"><i class="ph-bold ph-copy"></i></button>
    </div>`;
}

function formatSummary(result, successCount, failedCount) {
    const total = Number(result?.total ?? (successCount + failedCount));
    return `共请求 ${total} 个，成功 ${successCount} 个，失败 ${failedCount} 个`;
}

function summarizeFailures(fails) {
    const top = fails.slice(0, 3).map((item) => item?.reason || '未知错误');
    return fails.length > 3 ? `${top.join('；')}… 等` : top.join('；');
}

function registerBulkResultGlobals() {
    if (typeof window === 'undefined') return;
    if (globalsRegistered) return;
    globalsRegistered = true;
    window.closeBulkResult = () => closeModal(BULK_MODAL_ID);
    window.copyBulkResult = () => {
        if (lastBulkAddresses.length === 0) {
            showToast('没有可复制的地址');
            return;
        }
        copyText(lastBulkAddresses.join('\n'));
    };
    document.getElementById('bulkResultList')?.addEventListener('click', onBulkRowClick);
}

function onBulkRowClick(event) {
    const target = event.target.closest('[data-bulk-copy]');
    if (!target) return;
    const address = target.getAttribute('data-bulk-copy');
    if (address) copyText(address);
}
