export function registerDomainSelectorGlobals(context) {
    window.toggleDropdown = () => toggleDropdown(context);
    window.selectDomain = (el, domain) => selectDomain(context, el, domain);
    window.toggleRandomDomain = () => toggleRandomDomain(context);
    window.setPrefixMode = (btn, mode, index) => setPrefixMode(context, btn, mode, index);
    window.updateLengthLabel = (val) => updateLengthLabel(context, val);
    window.updateGenerateCount = (val) => updateGenerateCount(context, val);
    document.addEventListener('click', closeDomainDropdownOnOutsideClick);
}

function toggleDropdown(context) {
    if (context.state.randomDomainSuffix) return;
    const dropdown = document.getElementById('domainOptions');
    if (dropdown) dropdown.classList.toggle('show');
}

function selectDomain(context, el, domain) {
    context.state.selectedDomain = domain;
    document.getElementById('selectedDomain').textContent = domain;
    document.querySelectorAll('#domainOptions .option').forEach((option) => option.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('domainOptions').classList.remove('show');
}

function toggleRandomDomain(context) {
    context.state.randomDomainSuffix = !context.state.randomDomainSuffix;
    context.updateRandomDomainUI();
}

function setPrefixMode(context, btn, mode, index) {
    context.state.prefixMode = mode;
    const container = btn.parentElement;
    container.querySelectorAll('.segment-btn').forEach((button) => button.classList.remove('active'));
    btn.classList.add('active');
    container.querySelector('.segment-bg').style.transform = `translateX(${index * 100}%)`;
    syncPrefixModeInputs(mode);
}

function syncPrefixModeInputs(mode) {
    const customInput = document.getElementById('customInputBox');
    const lengthSection = document.getElementById('lengthSection');
    if (mode === 'custom') {
        customInput.style.display = 'block';
        lengthSection.style.display = 'none';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        lengthSection.style.display = 'block';
    }
}

function updateLengthLabel(context, val) {
    context.state.prefixLength = parseInt(val);
    document.getElementById('lengthDisplay').textContent = val;
}

function updateGenerateCount(context, val) {
    const parsed = Math.max(1, Math.min(100, Math.floor(Number(val) || 1)));
    context.state.generateCount = parsed;
    const input = document.getElementById('generateCountInput');
    if (input && Number(input.value) !== parsed) input.value = String(parsed);
    const display = document.getElementById('generateCountDisplay');
    if (display) display.textContent = String(parsed);
}

function closeDomainDropdownOnOutsideClick(event) {
    if (event.target.closest('.custom-select-wrapper')) return;
    const dropdown = document.getElementById('domainOptions');
    if (dropdown) dropdown.classList.remove('show');
}
