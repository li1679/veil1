export function getStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch {
        return defaultValue;
    }
}

export function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('localStorage not available:', error);
    }
}

export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('localStorage not available:', error);
    }
}
