import { readRuntimeConfigStatus } from './runtimeConfig.js';

const HEALTH_SERVICE_NAME = 'veil';
const HEALTH_VERSION = 'p7';

export function registerHealthRoutes(router) {
  router.get('/api/health', handleHealth);
}

export function handleHealth(context) {
  const config = readRuntimeConfigStatus(context.env || {});
  return Response.json(
    {
      ok: config.ok,
      service: HEALTH_SERVICE_NAME,
      version: HEALTH_VERSION,
      time: new Date().toISOString(),
      config,
    },
    { status: config.ok ? 200 : 503 }
  );
}
