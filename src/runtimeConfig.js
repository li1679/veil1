const REQUIRED_BINDINGS = ['TEMP_MAIL_DB', 'MAIL_EML', 'ASSETS'];
const REQUIRED_SECRETS = ['MAIL_DOMAIN', 'ADMIN_PASSWORD', 'JWT_TOKEN'];
const OPTIONAL_SECRETS = [
  'ROOT_ADMIN_TOKEN',
  'RECEIVE_TOKEN',
  'PUBLIC_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
];

export function readRuntimeConfigStatus(env = {}) {
  const domains = readMailDomains(env);
  const bindings = readBindingStatus(env);
  const secrets = readSecretStatus(env);
  const errors = [
    ...readMissingBindings(bindings),
    ...readMissingSecrets(secrets, domains),
  ];
  const warnings = readRuntimeWarnings(secrets);
  return { ok: errors.length === 0, bindings, secrets, domains, errors, warnings };
}

function readMailDomains(env) {
  return String(env?.MAIL_DOMAIN || '')
    .split(/[,\s]+/)
    .map((domain) => domain.trim())
    .filter(Boolean);
}

function readBindingStatus(env) {
  return Object.fromEntries(REQUIRED_BINDINGS.map((name) => [name, hasBinding(env, name)]));
}

function hasBinding(env, name) {
  const value = env?.[name];
  if (name === 'TEMP_MAIL_DB') return Boolean(value && typeof value.prepare === 'function');
  if (name === 'MAIL_EML') return Boolean(value && (typeof value.put === 'function' || typeof value.get === 'function'));
  if (name === 'ASSETS') return Boolean(value && typeof value.fetch === 'function');
  return Boolean(value);
}

function readSecretStatus(env) {
  const names = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  return Object.fromEntries(names.map((name) => [name, hasSecret(env, name)]));
}

function hasSecret(env, name) {
  return String(env?.[name] || '').trim().length > 0;
}

function readMissingBindings(bindings) {
  return REQUIRED_BINDINGS
    .filter((name) => !bindings[name])
    .map((name) => `Missing binding: ${name}`);
}

function readMissingSecrets(secrets, domains) {
  const missing = REQUIRED_SECRETS
    .filter((name) => name !== 'MAIL_DOMAIN' && !secrets[name])
    .map((name) => `Missing secret: ${name}`);
  if (!domains.length) missing.unshift('Missing secret: MAIL_DOMAIN');
  return missing;
}

function readRuntimeWarnings(secrets) {
  const warnings = [];
  if (!secrets.ROOT_ADMIN_TOKEN) warnings.push('ROOT_ADMIN_TOKEN not configured; root override access is disabled');
  if (!secrets.RECEIVE_TOKEN) warnings.push('RECEIVE_TOKEN not configured; remote /receive is blocked outside localhost');
  if (!secrets.TURNSTILE_SECRET_KEY) warnings.push('TURNSTILE_SECRET_KEY not configured; login captcha is disabled');
  return warnings;
}
