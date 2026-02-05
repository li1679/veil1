/**
 * Veil - 主题管理模块
 * 处理暗黑模式切换和系统偏好跟随
 */

const THEME_KEY = 'veil_theme';

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}

function storeTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
        console.warn('localStorage not available:', e);
    }
}

export function applyTheme(theme, save = true) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    if (save) storeTheme(theme);
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
}

export function initTheme() {
    const saved = getStoredTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = (isDark) => {
        applyTheme(isDark ? 'dark' : 'light', false);
    };

    if (saved) {
        applyTheme(saved, false);
    } else {
        applySystemTheme(media.matches);
    }

    const onChange = (e) => {
        if (!getStoredTheme()) {
            applySystemTheme(Boolean(e.matches));
        }
    };

    if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange);
    } else if (typeof media.addListener === 'function') {
        media.addListener(onChange);
    }
}

if (typeof window !== 'undefined') {
    window.initTheme = initTheme;
    window.toggleTheme = toggleTheme;
}
