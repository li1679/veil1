import { toggleTheme } from './theme.js';

export function initThemeSwitch() {
    const themeItem = document.getElementById('themeToggleItem');
    const themeSwitch = document.getElementById('themeSwitch');
    const themeLabel = document.getElementById('themeLabel');
    const themeMenuIcon = document.getElementById('themeMenuIcon');
    const themeMobileIcon = document.getElementById('themeMobileIcon');
    if (!themeItem || !themeSwitch) return;

    const updateSwitch = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        themeSwitch.classList.toggle('on', isDark);
        themeSwitch.setAttribute('aria-checked', isDark ? 'true' : 'false');
        if (themeLabel) themeLabel.textContent = isDark ? '浅色模式' : '暗黑模式';
        if (themeMenuIcon) themeMenuIcon.className = isDark ? 'ph-bold ph-sun-dim' : 'ph-bold ph-moon';
        if (themeMobileIcon) themeMobileIcon.className = isDark ? 'ph ph-sun-dim' : 'ph ph-moon';
    };

    updateSwitch();
    window.addEventListener('veil:themechange', updateSwitch);
    themeItem.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleTheme();
        updateSwitch();
    });
}
