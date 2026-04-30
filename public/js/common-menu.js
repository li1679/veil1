export function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.toggle('show');
}

function closeUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.remove('show');
}

export function initUserMenuClose() {
    document.addEventListener('click', (event) => {
        const container = document.querySelector('.user-profile-container');
        if (container && !container.contains(event.target)) closeUserMenu();
    });
}
