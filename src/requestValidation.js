export class RequestValidationError extends Error {}

export function requireJsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('请求体必须为 JSON 对象');
  }
  return value;
}

export function readInteger(value, { name, min, max, defaultValue }) {
  const input = value === undefined ? defaultValue : value;
  if (typeof input !== 'number' && !(typeof input === 'string' && /^\d+$/.test(input))) {
    throw new RequestValidationError(`${name}必须为 ${min}-${max} 的整数`);
  }
  const number = Number(input);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new RequestValidationError(`${name}必须为 ${min}-${max} 的整数`);
  }
  return number;
}

export function readBoolean(value, name) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  throw new RequestValidationError(`${name}必须为布尔值或 0/1`);
}
