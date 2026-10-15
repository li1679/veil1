// A page-local ES module registry, never exposed on window.
export const actions = Object.create(null);
let bound = false;

export function bindPageActions() {
    if (bound) return;
    bound = true;
    for (const type of ['click', 'input', 'change']) {
        document.addEventListener(type, (event) => {
            if (event.target.closest('.mail-detail-body')) return;
            const element = event.target.closest(`[data-command-${type}]`);
            if (!element || element.closest('[disabled], .disabled')) return;
            const name = element.getAttribute(`data-command-${type}`);
            const handler = actions[name];
            if (typeof handler !== 'function') throw new Error(`Unknown page command: ${name}`);
            const args = JSON.parse(element.dataset.commandArgs || '[]').map((value) => {
                if (value === '$element') return element;
                if (value === '$event') return event;
                if (value === '$value') return element.value;
                return value;
            });
            handler(...args);
        });
    }
}
