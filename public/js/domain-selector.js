import { showToast, escapeHtml } from './common.js';
import { registerDomainSelectorActions } from './domain-selector-events.js';
import { getBulkGenerateLimit } from './mailbox-config.js';

/** Owns generation preferences; the native select owns menu/focus behavior. */
export function createDomainSelector({ domainAPI, role }) {
    const state = { domains: [], selectedDomain: '', randomDomainSuffix: false, prefixMode: 'random', prefixLength: 12, generateCount: 1, maxGenerateCount: getBulkGenerateLimit(role) };
    const listeners = new Set();
    const notify = () => listeners.forEach((listener) => listener());
    registerDomainSelectorActions({ state, notify });
    async function loadDomains() {
        const select = document.getElementById('domainSelect');
        select.disabled = true;
        try {
            const response = await domainAPI.getDomains();
            if (!Array.isArray(response.domains) || !response.domains.length) throw new Error('尚未配置可用邮箱域名');
            state.domains = response.domains;
            if (!state.domains.includes(state.selectedDomain)) state.selectedDomain = state.domains[0];
            select.innerHTML = state.domains.map((domain) => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`).join('');
            select.value = state.selectedDomain;
            select.disabled = state.randomDomainSuffix;
            notify();
            return true;
        } catch (error) {
            state.domains = []; state.selectedDomain = '';
            select.innerHTML = '<option>域名加载失败，请重试</option>';
            notify();
            showToast(error.message || '加载域名失败');
            return false;
        }
    }
    return {
        loadDomains,
        onChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        getDomains: () => state.domains,
        getSelectedDomain: () => state.selectedDomain,
        getDomainForGeneration: () => state.randomDomainSuffix ? state.domains[Math.floor(Math.random() * state.domains.length)] : state.selectedDomain,
        getPrefixMode: () => state.prefixMode,
        getPrefixLength: () => state.prefixLength,
        getGenerateCount: () => Math.max(1, Math.min(state.maxGenerateCount, state.generateCount)),
        isRandomDomain: () => state.randomDomainSuffix,
    };
}
