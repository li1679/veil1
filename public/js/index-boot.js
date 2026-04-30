const ROLE_REDIRECTS = Object.freeze({
    StrictAdmin: '/admin.html',
    User: '/user.html',
    MailboxUser: '/mailbox.html',
});

export function chooseIndexRedirect(user, currentUrl = window.location.href) {
    if (!user) return '/login.html';
    const fallback = getDefaultRedirectUrl(user);
    const requested = readRequestedRedirect(currentUrl);
    return isSafeRoleRedirect(user, requested) ? requested : fallback;
}

function getDefaultRedirectUrl(user) {
    return ROLE_REDIRECTS[user?.role] || '/login.html';
}

function readRequestedRedirect(currentUrl) {
    try {
        const value = new URL(currentUrl, 'https://veil.local').searchParams.get('redirect') || '';
        return value.startsWith('/') && !value.startsWith('//') ? value : '';
    } catch (_) {
        return '';
    }
}

function isSafeRoleRedirect(user, target) {
    if (!target) return false;
    return target === getDefaultRedirectUrl(user);
}

export async function bootIndexPage({ checkSession, initTheme, location = window.location } = {}) {
    if (typeof initTheme === 'function') initTheme();
    try {
        const user = await checkSession();
        location.href = chooseIndexRedirect(user, location.href);
    } catch (error) {
        console.error('Session check failed:', error);
        renderIndexFailure('会话检查失败，请重试', location);
    }
}

export function renderIndexFailure(message = '加载失败，请重试', location = window.location) {
    const text = document.querySelector('.loading-text');
    if (text) text.textContent = message;
    if (document.querySelector('.loading-retry')) return;
    const container = document.querySelector('.loading-container');
    if (!container) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'loading-retry';
    button.textContent = '重试';
    button.addEventListener('click', () => location.reload());
    container.appendChild(button);
}
