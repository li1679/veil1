export function animateDelete(el, callback, delay = 400) {
    if (!el) return;
    el.classList.add('deleting');
    setTimeout(() => {
        if (callback) callback();
    }, delay);
}

export function animateBatchDelete(ids, idPrefix, callback, stagger = 50, delay = 400) {
    ids.forEach((id, index) => {
        const el = document.getElementById(`${idPrefix}${id}`);
        if (el) setTimeout(() => el.classList.add('deleting'), index * stagger);
    });
    setTimeout(() => {
        if (callback) callback();
    }, ids.length * stagger + delay);
}
