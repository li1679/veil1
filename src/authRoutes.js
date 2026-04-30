import { handleLogin, handleLogout } from './authLogin.js';
import { handleSession } from './authSession.js';

export function registerAuthRoutes(router) {
  router.post('/api/login', handleLogin);
  router.post('/api/logout', handleLogout);
  router.get('/api/session', handleSession);
}
