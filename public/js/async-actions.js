const pendingTasks = new Set();

/** Prevent duplicate writes and restore the control after completion. */
export async function runExclusive(key, task, { button, label } = {}) {
    if (pendingTasks.has(key)) return;
    pendingTasks.add(key);
    const original = button?.innerHTML;
    const wasDisabled = button?.disabled;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); if (label) button.textContent = label; }
    try { return await task(); }
    finally {
        pendingTasks.delete(key);
        if (button) { button.disabled = wasDisabled; button.removeAttribute('aria-busy'); if (label) button.innerHTML = original; }
    }
}

/** Ordered, bounded batch results; partial failures are never reported as all-success. */
export async function runBatch(items, worker, { concurrency = 4, onProgress } = {}) {
    const results = new Array(items.length);
    let cursor = 0;
    let completed = 0;
    async function consume() {
        while (cursor < items.length) {
            const index = cursor++;
            const id = items[index];
            try { results[index] = { id, success: true, value: await worker(id) }; }
            catch (error) { results[index] = { id, success: false, error: error.message || '操作失败' }; }
            onProgress?.(++completed, items.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
    const succeeded = results.filter((item) => item.success).length;
    return { success: succeeded === items.length, success_count: succeeded, fail_count: items.length - succeeded, total: items.length, results };
}

export function updateBatchProgress(done, total) {
    const description = document.getElementById('iosAlertDesc');
    if (description) description.textContent = `正在处理 ${done}/${total}，请勿关闭页面`;
}
