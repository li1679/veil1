import { escapeHtml } from './common.js';

export function renderCheckbox({ id = '', checked = false, action = '', label = '', disabled = false, attrs = {} } = {}) {
    const classes = ['custom-checkbox'];
    if (checked) classes.push('checked');
    if (disabled) classes.push('disabled');
    const dataAttrs = renderDataAttributes({ ...defaultIdAttr(id), ...attrs, 'data-action': action });
    return `<div class="${classes.join(' ')}" role="checkbox" tabindex="${disabled ? '-1' : '0'}" aria-checked="${checked ? 'true' : 'false'}" aria-label="${escapeHtml(label)}"${disabled ? ' aria-disabled="true"' : ''}${dataAttrs}></div>`;
}

export function renderSwitch({ id = '', checked = false, action = '', label = '', disabled = false, className = '', attrs = {} } = {}) {
    const classes = ['ios-switch'];
    if (checked) classes.push('on');
    if (disabled) classes.push('disabled');
    if (className) classes.push(className);
    const dataAttrs = renderDataAttributes({ ...defaultIdAttr(id), ...attrs, 'data-action': action });
    return `<div class="${classes.map(escapeHtml).join(' ')}" role="switch" tabindex="${disabled ? '-1' : '0'}" aria-checked="${checked ? 'true' : 'false'}" aria-label="${escapeHtml(label)}"${disabled ? ' aria-disabled="true"' : ''}${dataAttrs}><div class="ios-switch-thumb"></div></div>`;
}

function defaultIdAttr(id) {
    return id === '' || id === null || id === undefined ? {} : { 'data-id': id };
}

function renderDataAttributes(attrs) {
    return Object.entries(attrs)
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([name, value]) => ` ${escapeHtml(name)}="${escapeHtml(value)}"`)
        .join('');
}
