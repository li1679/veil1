import { isTokenMatch } from './requestAuthTokens.js';

export function authenticatePublicApiRequest(context) {
  const expectedKey = readPublicApiKey(context.env);
  if (!expectedKey) {
    return Response.json({ error: 'PUBLIC_API_KEY not configured' }, { status: 500 });
  }

  const providedKey = readProvidedApiKey(context.request);
  if (isTokenMatch(expectedKey, providedKey)) {
    context.authPayload = { role: 'user', username: '__api_key__', userId: 0 };
    return null;
  }
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

function readPublicApiKey(env) {
  return env.PUBLIC_API_KEY ||
    env.NPCMAIL_API_KEY ||
    env.API_KEY ||
    env.TM_API_KEY ||
    '';
}

function readProvidedApiKey(request) {
  return request.headers.get('X-API-Key') ||
    request.headers.get('x-api-key') ||
    request.headers.get('X-Api-Key') ||
    '';
}
