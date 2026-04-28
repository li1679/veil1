const CODE_KEYWORD_PATTERN = /(?:verification|verify|one[-\s]?time|two[-\s]?factor|2fa|authentication|confirm(?:ation)?|code|otp|passcode|验证码|校验码|驗證碼|確認碼|認證碼|認証コード|인증코드|코드)/gi;
const CODE_TOKEN_PATTERN = /(?<![a-z0-9])([a-z0-9]{2,12}(?:[-–—][a-z0-9]{2,12}){1,3}|[a-z0-9]{4,24}|[0-9](?:[\u00A0\s._\-–—]?[0-9]){3,7})(?![a-z0-9])/gi;

function normalizeCandidate(rawValue) {
    const compact = String(rawValue || '')
        .trim()
        .replace(/[–—]/g, '-')
        .replace(/\s*-\s*/g, '-');
    if (!compact) return '';
    if (/^[\d\s._-]+$/.test(compact)) return compact.replace(/\D+/g, '');
    return compact.replace(/[\s._]+/g, '');
}

function isDateLike(rawValue) {
    return /\b\d{4}[-/._]\d{1,2}[-/._]\d{1,2}\b/.test(String(rawValue || ''));
}

function isValidCodeCandidate(rawValue) {
    if (isDateLike(rawValue)) return false;
    const normalized = normalizeCandidate(rawValue);
    const comparable = normalized.replace(/-/g, '');
    if (comparable.length < 4 || comparable.length > 24) return false;
    if (!/\d/.test(comparable)) return false;
    if (/^\d{4}$/.test(comparable)) {
        const year = Number(comparable);
        if (year >= 2000 && year <= 2099) return false;
    }
    return true;
}

function findCodeNearKeyword(text, keywordMatch) {
    const start = Math.max(0, keywordMatch.index - 80);
    const end = Math.min(text.length, keywordMatch.index + keywordMatch[0].length + 120);
    const windowText = text.slice(start, end);
    CODE_TOKEN_PATTERN.lastIndex = 0;
    let tokenMatch;
    while ((tokenMatch = CODE_TOKEN_PATTERN.exec(windowText)) !== null) {
        const rawToken = tokenMatch[1];
        if (isValidCodeCandidate(rawToken)) return normalizeCandidate(rawToken);
    }
    return '';
}

export function extractCode(text) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (!source) return null;
    CODE_KEYWORD_PATTERN.lastIndex = 0;
    let keywordMatch;
    while ((keywordMatch = CODE_KEYWORD_PATTERN.exec(source)) !== null) {
        const code = findCodeNearKeyword(source, keywordMatch);
        if (code) return code;
    }
    return null;
}
