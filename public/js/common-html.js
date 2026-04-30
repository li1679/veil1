export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return ch;
        }
    });
}

function sanitizeUrl(rawValue, attrName) {
    const value = String(rawValue ?? '').trim();
    if (!value) return '';
    const normalized = value.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
    if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) return '';
    if (normalized.startsWith('data:')) return sanitizeDataUrl(value, attrName);
    const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!schemeMatch) return value;
    const scheme = String(schemeMatch[1] || '').toLowerCase();
    if (attrName === 'href' || attrName === 'xlink:href' || attrName === 'formaction') {
        return ['http', 'https', 'mailto', 'tel'].includes(scheme) ? value : '';
    }
    if (attrName === 'src') return ['http', 'https'].includes(scheme) ? value : '';
    return value;
}

function sanitizeDataUrl(value, attrName) {
    if (attrName === 'src' && /^data:image\/(png|gif|jpe?g|webp);/i.test(value)) return value;
    return '';
}

export function sanitizeEmailHtml(inputHtml, options = {}) {
    const raw = String(inputHtml ?? '');
    if (!raw) return '';
    if (typeof DOMParser === 'undefined') return escapeHtml(raw);
    try {
        return sanitizeEmailDocument(raw, Boolean(options && options.stripStyles));
    } catch (_) {
        return escapeHtml(raw);
    }
}

function sanitizeEmailDocument(raw, stripStyles) {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const body = doc.body;
    if (!body) return '';
    removeBlockedTags(body);
    body.querySelectorAll('*').forEach((el) => sanitizeElement(el, stripStyles));
    return body.innerHTML || '';
}

function removeBlockedTags(body) {
    const blockedTags = [
        'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta',
        'base', 'noscript', 'template', 'form', 'input', 'button',
        'textarea', 'select', 'option', 'svg', 'math'
    ];
    blockedTags.forEach((tag) => body.querySelectorAll(tag).forEach((el) => el.remove()));
}

function sanitizeElement(el, stripStyles) {
    for (const attr of Array.from(el.attributes || [])) {
        sanitizeAttribute(el, attr, stripStyles);
    }
    enforceBlankTargetRel(el);
}

function sanitizeAttribute(el, attr, stripStyles) {
    const name = String(attr.name || '').toLowerCase();
    const value = String(attr.value ?? '');
    if (name.startsWith('on') || name === 'srcdoc' || name === 'srcset' || name === 'ping') {
        el.removeAttribute(attr.name);
    } else if (name === 'style') {
        sanitizeStyleAttribute(el, attr, value, stripStyles);
    } else if (['href', 'src', 'xlink:href', 'formaction', 'action'].includes(name)) {
        const safe = sanitizeUrl(value, name);
        if (!safe) el.removeAttribute(attr.name);
        else el.setAttribute(attr.name, safe);
    }
}

function sanitizeStyleAttribute(el, attr, value, stripStyles) {
    if (stripStyles) return el.removeAttribute(attr.name);
    const lower = value.toLowerCase().replace(/\/\*[\s\S]*?\*\//g, '');
    const blocked = ['expression', 'javascript:', 'vbscript:', 'url(', '@import', '-moz-binding', 'behavior'];
    if (blocked.some((token) => lower.includes(token))) el.removeAttribute(attr.name);
}

function enforceBlankTargetRel(el) {
    const target = String(el.getAttribute('target') || '').toLowerCase();
    if (target !== '_blank') return;
    const parts = String(el.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!parts.includes('noopener')) parts.push('noopener');
    if (!parts.includes('noreferrer')) parts.push('noreferrer');
    el.setAttribute('rel', parts.join(' '));
}

export function fitMailHtmlToViewport(target = 'mailDetailBody') {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!(container instanceof HTMLElement)) return;
    const fitRoot = container.querySelector('.mail-html-fit');
    const content = fitRoot?.querySelector('.mail-html-sanitized');
    if (!(fitRoot instanceof HTMLElement) || !(content instanceof HTMLElement)) return;
    applyMailHtmlFit(fitRoot, content);
    content.querySelectorAll('img').forEach((img) => bindImageFitRefresh(img, fitRoot, content));
}

function applyMailHtmlFit(fitRoot, content) {
    resetMailHtmlFit(fitRoot, content);
    const viewportWidth = fitRoot.clientWidth;
    const naturalWidth = Math.max(content.scrollWidth, content.offsetWidth);
    if (!viewportWidth || !naturalWidth || naturalWidth <= viewportWidth) {
        content.style.maxWidth = '100%';
        return;
    }
    const scale = viewportWidth / naturalWidth;
    const naturalHeight = Math.max(content.scrollHeight, content.offsetHeight);
    content.style.width = `${naturalWidth}px`;
    content.style.transformOrigin = 'top left';
    content.style.transform = `scale(${scale})`;
    fitRoot.style.height = `${Math.ceil(naturalHeight * scale)}px`;
}

function resetMailHtmlFit(fitRoot, content) {
    content.style.transform = '';
    content.style.transformOrigin = '';
    content.style.width = '';
    content.style.maxWidth = '';
    fitRoot.style.height = '';
}

function bindImageFitRefresh(img, fitRoot, content) {
    if (!(img instanceof HTMLImageElement) || img.complete) return;
    const refresh = () => applyMailHtmlFit(fitRoot, content);
    img.addEventListener('load', refresh, { once: true });
    img.addEventListener('error', refresh, { once: true });
}
