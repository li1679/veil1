import { requireJsonObject } from './requestValidation.js';

export function createJsonBodyReader(request) {
  let loaded = false;
  let cachedBody;
  let bodyError = null;

  return async function readJsonBody() {
    if (!loaded) {
      try {
        const value = await request.clone().json();
        if (new URL(request.url).pathname === '/api/send/batch') {
          if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error('批量发信请求体必须为1-100项对象数组');
          cachedBody = value.map(requireJsonObject);
        } else {
          cachedBody = requireJsonObject(value);
        }
      } catch (error) {
        bodyError = error;
      }
      loaded = true;
    }
    if (bodyError) throw bodyError;
    return cachedBody;
  };
}

export function formatD1Timestamp(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}
