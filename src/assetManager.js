import {
  checkGuestOnlyPath,
  checkProtectedPathAuth,
  handleIllegalPath
} from './assetAuthGuards.js';
import {
  handleAdminPage,
  handleAllMailboxesPage,
  handleIndexPage,
  handleMailboxPage,
  wrapHtmlResponse
} from './assetPages.js';
import {
  createAssetPolicy,
  getAccessLog,
  isApiPath,
  isGuestOnlyPath,
  isPathAllowed,
  isProtectedPath,
  mapAssetRequest
} from './assetPolicy.js';
export { AssetSecurityChecker } from './assetSecurityChecker.js';

export class AssetManager {
  constructor() {
    this.policy = createAssetPolicy();
    this.allowedPaths = this.policy.allowedPaths;
    this.allowedPrefixes = this.policy.allowedPrefixes;
    this.protectedPaths = this.policy.protectedPaths;
    this.guestOnlyPaths = this.policy.guestOnlyPaths;
  }

  isPathAllowed(pathname) {
    return isPathAllowed(this.policy, pathname);
  }

  isProtectedPath(pathname) {
    return isProtectedPath(this.policy, pathname);
  }

  isGuestOnlyPath(pathname) {
    return isGuestOnlyPath(this.policy, pathname);
  }

  async handleAssetRequest(request, env, mailDomains) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const auth = readAssetAuthConfig(env);

    const guard = await this.checkRequestAccess(request, pathname, url, auth);
    if (guard) return guard;
    if (!env.ASSETS?.fetch) return Response.redirect(new URL('/login.html', url).toString(), 302);

    const mappedRequest = this.handlePathMapping(request, url);
    const pageResponse = await this.tryHandleSpecialPage(mappedRequest, env, mailDomains, auth, pathname);
    if (pageResponse) return pageResponse;
    return await fetchStaticAsset(env, mappedRequest);
  }

  async checkRequestAccess(request, pathname, url, auth) {
    if (!this.isPathAllowed(pathname)) {
      return await handleIllegalPath(request, auth.jwtSecret, auth.rootAdminToken);
    }
    if (this.isProtectedPath(pathname)) {
      const response = await checkProtectedPathAuth(request, auth.jwtSecret, auth.rootAdminToken, url);
      if (response) return response;
    }
    if (this.isGuestOnlyPath(pathname)) {
      return await checkGuestOnlyPath(request, auth.jwtSecret, auth.rootAdminToken, url);
    }
    return null;
  }

  handlePathMapping(request, url) {
    return mapAssetRequest(request, url);
  }

  async tryHandleSpecialPage(request, env, mailDomains, auth, pathname) {
    if (pathname === '/' || pathname === '/index.html') {
      return await this.handleIndexPage(request, env, mailDomains, auth.jwtSecret, auth.rootAdminToken);
    }
    if (pathname === '/admin.html') {
      return await this.handleAdminPage(request, env, auth.jwtSecret, auth.rootAdminToken);
    }
    if (pathname === '/mailbox.html') {
      return await this.handleMailboxPage(request, env, auth.jwtSecret, auth.rootAdminToken);
    }
    return null;
  }

  async handleIndexPage(request, env, mailDomains, jwtSecret, rootAdminToken) {
    return handleIndexPage(request, env, mailDomains, jwtSecret, rootAdminToken);
  }

  async handleAdminPage(request, env, jwtSecret, rootAdminToken) {
    return handleAdminPage(request, env, jwtSecret, rootAdminToken);
  }

  async wrapHtmlResponse(resp) {
    return wrapHtmlResponse(resp);
  }

  async handleMailboxPage(request, env, jwtSecret, rootAdminToken) {
    return handleMailboxPage(request, env, jwtSecret, rootAdminToken);
  }

  async handleAllMailboxesPage(request, env, jwtSecret, rootAdminToken) {
    return handleAllMailboxesPage(request, env, jwtSecret, rootAdminToken);
  }

  addAllowedPath(path) {
    this.allowedPaths.add(path);
  }

  addAllowedPrefix(prefix) {
    this.allowedPrefixes.push(prefix);
  }

  removeAllowedPath(path) {
    this.allowedPaths.delete(path);
  }

  isApiPath(pathname) {
    return isApiPath(pathname);
  }

  getAccessLog(request) {
    return getAccessLog(request);
  }
}

function readAssetAuthConfig(env) {
  return {
    jwtSecret: env.JWT_TOKEN || env.JWT_SECRET || '',
    rootAdminToken: env.ROOT_ADMIN_TOKEN ||
      env.ROOT_TOKEN ||
      env.ADMIN_API_TOKEN ||
      env.ADMIN_TOKEN ||
      ''
  };
}

async function fetchStaticAsset(env, mappedRequest) {
  const response = await env.ASSETS.fetch(mappedRequest);
  try {
    const targetPath = new URL(mappedRequest.url).pathname;
    if (targetPath.endsWith('.html')) return await wrapHtmlResponse(response);
  } catch (_) {
    return response;
  }
  return response;
}

export function createAssetManager() {
  return new AssetManager();
}
