const DEFAULT_PREVIEW_LENGTH = 120;

export function looksLikeHtml(value) {
    return /<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i.test(String(value || ''));
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
}

function stripHiddenBlocks(html) {
    let output = String(html || '');
    const hiddenBlock = /<([a-z][\w:-]*)\b[^>]*(?:hidden\b|style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|max-height\s*:\s*0|mso-hide\s*:\s*all)[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi;
    for (let index = 0; index < 6; index += 1) {
        const next = output.replace(hiddenBlock, ' ');
        if (next === output) return output;
        output = next;
    }
    return output;
}

function cleanPlainText(value) {
    return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

export function htmlToPreviewText(html) {
    return cleanPlainText(
        stripHiddenBlocks(html)
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<(?:br|\/p|\/div|\/tr|\/td|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    );
}

export function buildEmailPreview({ text = '', html = '', maxLength = DEFAULT_PREVIEW_LENGTH } = {}) {
    const textSource = String(text || '').trim();
    const textPreview = looksLikeHtml(textSource) ? htmlToPreviewText(textSource) : cleanPlainText(textSource);
    const preview = textPreview || htmlToPreviewText(html);
    return preview.slice(0, maxLength);
}
