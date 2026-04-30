const API_BASE = '';

export async function request(url, options = {}) {
    const defaultOptions = {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    };
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };
    try {
        const response = await fetch(`${API_BASE}${url}`, mergedOptions);
        return await readApiResponse(response);
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function readApiResponse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        return data;
    }
    const text = await response.text();
    if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
    return text;
}

export function normalizeId(value) {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
}

export async function deleteMailboxByAddress(address) {
    if (!address) throw new Error('Missing address');
    try {
        return await request(`/api/mailboxes?address=${encodeURIComponent(address)}`, { method: 'DELETE' });
    } catch (error) {
        const msg = String(error?.message || '');
        if (msg.includes('邮箱不存在')) return { success: true, deleted: false };
        throw error;
    }
}
