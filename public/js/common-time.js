const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const WEEK_MS = 604800000;

function parseDateInput(dateString) {
    if (!dateString) return null;
    if (dateString instanceof Date) return dateString;
    const raw = String(dateString).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
        return new Date(raw.replace(' ', 'T') + 'Z');
    }
    return new Date(raw);
}

export function formatTime(dateString) {
    const date = parseDateInput(dateString);
    if (!date || Number.isNaN(date.getTime())) return String(dateString || '');
    const diff = new Date() - date;
    if (diff < MINUTE_MS) return '刚刚';
    if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} 分钟前`;
    if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} 小时前`;
    if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)} 天前`;
    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDate(dateString) {
    const date = parseDateInput(dateString);
    if (!date || Number.isNaN(date.getTime())) return String(dateString || '');
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}
