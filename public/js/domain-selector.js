import { showToast, escapeHtml } from './common.js';
import { registerDomainSelectorGlobals } from './domain-selector-events.js';

export function createDomainSelector(opts) {
    const state = {
        domains: [],
        selectedDomain: '',
        randomDomainSuffix: false,
        prefixMode: 'random',
        prefixLength: 12,
    };
    const context = { state, updateRandomDomainUI: () => updateRandomDomainUI(state) };
    registerDomainSelectorGlobals(context);
    return {
        loadDomains: () => loadDomains(opts.domainAPI, state),
        getDomains: () => state.domains,
        getSelectedDomain: () => state.selectedDomain,
        getDomainForGeneration: () => getDomainForGeneration(state),
        getPrefixMode: () => state.prefixMode,
        getPrefixLength: () => state.prefixLength,
    };
}

async function loadDomains(domainAPI, state) {
    try {
        const response = await domainAPI.getDomains();
        state.domains = response.domains || [];
        if (state.domains.length > 0) {
            state.selectedDomain = state.domains[0];
            renderDomainDropdown(state);
        }
    } catch (error) {
        console.error('Failed to load domains:', error);
        showToast('加载域名失败');
    }
}

function renderDomainDropdown(state) {
    const trigger = document.getElementById('selectedDomain');
    const optionsList = document.getElementById('domainOptions');
    if (trigger) trigger.textContent = state.selectedDomain;
    if (!optionsList) return;
    optionsList.innerHTML = state.domains.map((domain) => renderDomainOption(domain, state.selectedDomain)).join('');
}

function renderDomainOption(domain, selectedDomain) {
    const safeDomain = escapeHtml(domain);
    const selectedClass = domain === selectedDomain ? 'selected' : '';
    return `<li class="option ${selectedClass}" data-action="select-domain" data-domain="${safeDomain}">${safeDomain}</li>`;
}

function getDomainForGeneration(state) {
    if (state.randomDomainSuffix && Array.isArray(state.domains) && state.domains.length > 0) {
        return state.domains[Math.floor(Math.random() * state.domains.length)];
    }
    return state.selectedDomain || state.domains?.[0] || '';
}

function updateRandomDomainUI(state) {
    const sw = document.getElementById('randomDomainSwitch');
    if (sw) {
        sw.classList.toggle('on', state.randomDomainSuffix);
        sw.setAttribute('aria-checked', state.randomDomainSuffix ? 'true' : 'false');
    }
    const wrapper = document.getElementById('domainSelectWrapper');
    if (wrapper) wrapper.classList.toggle('is-disabled', state.randomDomainSuffix);
    const dropdown = document.getElementById('domainOptions');
    if (state.randomDomainSuffix && dropdown) dropdown.classList.remove('show');
}
