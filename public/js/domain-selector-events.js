import { actions } from './page-actions.js';

export function registerDomainSelectorActions({ state, notify }) {
    document.getElementById('domainSelect').addEventListener('change', (event) => { state.selectedDomain = event.target.value; notify(); });
    actions.toggleRandomDomain = () => {
        state.randomDomainSuffix = !state.randomDomainSuffix;
        const toggle = document.getElementById('randomDomainSwitch');
        toggle.classList.toggle('on', state.randomDomainSuffix);
        toggle.setAttribute('aria-checked', String(state.randomDomainSuffix));
        document.getElementById('domainSelect').disabled = state.randomDomainSuffix || !state.domains.length;
    };
    actions.setPrefixMode = (button, mode, index) => {
        state.prefixMode = mode;
        button.parentElement.querySelectorAll('.segment-btn').forEach((item) => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
        button.parentElement.querySelector('.segment-bg').style.transform = `translateX(${index * 100}%)`;
        const custom = document.getElementById('customInputBox');
        custom.classList.toggle('is-visible', mode === 'custom');
        document.getElementById('lengthSection').classList.toggle('is-hidden', mode === 'custom');
        if (mode === 'custom') custom.focus();
    };
    actions.updateLengthLabel = (value) => { state.prefixLength = Number(value); document.getElementById('lengthDisplay').textContent = value; };
    actions.updateGenerateCount = (value) => {
        state.generateCount = Math.max(1, Math.min(state.maxGenerateCount, Number(value)));
        document.getElementById('generateCountDisplay').textContent = state.generateCount;
    };
}
