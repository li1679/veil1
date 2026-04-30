import { handleApiRequest, handleEmailReceive } from './apiHandlers.js';
import { timingSafeEqual } from './authentication.js';
import { registerAuthRoutes } from './authRoutes.js';
import { extractEmail } from './commonUtils.js';
import { getDatabaseWithValidation } from './dbConnectionHelper.js';
import { registerHealthRoutes } from './healthRoutes.js';
export { authMiddleware, resolveAuthPayload } from './requestAuth.js';

const API_DELEGATE_METHODS = ['get', 'post', 'patch', 'put', 'delete'];

/**
 * 路由处理器类，用于管理所有API路由
 */
export class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }

  /**
   * 添加中间件
   * @param {Function} middleware - 中间件函数
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * 添加GET路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  get(path, handler) {
    this.addRoute('GET', path, handler);
  }

  /**
   * 添加POST路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  post(path, handler) {
    this.addRoute('POST', path, handler);
  }

  /**
   * 添加PATCH路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  patch(path, handler) {
    this.addRoute('PATCH', path, handler);
  }

  /**
   * 添加PUT路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  put(path, handler) {
    this.addRoute('PUT', path, handler);
  }

  /**
   * 添加DELETE路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  delete(path, handler) {
    this.addRoute('DELETE', path, handler);
  }

  /**
   * 添加路由
   * @param {string} method - HTTP方法
   * @param {string} path - 路径模式
   * @param {Function} handler - 处理函数
   */
  addRoute(method, path, handler) {
    // 将路径转换为正则表达式，支持参数捕获
    const paramNames = [];
    const regexPath = path
      .replace(/:\w+/g, (match) => {
        paramNames.push(match.slice(1)); // 移除冒号
        return '([^/]+)';
      })
      .replace(/\*/g, '.*');

    this.routes.push({
      method: method.toUpperCase(),
      path,
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
      handler
    });
  }

  /**
   * 处理请求
   * @param {Request} request - HTTP请求
   * @param {object} context - 上下文对象
   * @returns {Promise<Response>} HTTP响应
   */
  async handle(request, context) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const pathname = url.pathname;

    // 查找匹配的路由
    for (const route of this.routes) {
      if (route.method === method) {
        const match = pathname.match(route.regex);
        if (match) {
          // 构建参数对象
          const params = {};
          route.paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
          });

          // 创建增强的请求上下文
          const enhancedContext = {
            ...context,
            params,
            query: Object.fromEntries(url.searchParams.entries()),
            request,
            url
          };

          // 执行中间件
          for (const middleware of this.middlewares) {
            const result = await middleware(enhancedContext);
            if (result) return result; // 如果中间件返回响应，直接返回
          }

          // 执行路由处理函数
          return await route.handler(enhancedContext);
        }
      }
    }

    // 未找到匹配的路由
    return null;
  }
}

/**
 * 创建并配置路由器
 * @returns {Router} 配置好的路由器实例
 */
export function createRouter() {
  const router = new Router();

  registerAuthRoutes(router);
  registerHealthRoutes(router);
  registerApiDelegateRoutes(router);
  registerReceiveRoute(router);
  return router;
}

function registerApiDelegateRoutes(router) {
  for (const method of API_DELEGATE_METHODS) {
    router[method]('/api/*', async (context) => delegateApiRequest(context));
  }
}

function registerReceiveRoute(router) {
  router.post('/receive', handleReceiveRequest);
}

async function handleReceiveRequest(context) {
  const { request, env } = context;
  const tokenFailure = validateReceiveToken(request, env);
  if (tokenFailure) return tokenFailure;

  let DB;
  try {
    DB = await getDatabaseWithValidation(env);
  } catch (error) {
    console.error('邮件接收时数据库连接失败:', error.message);
    return new Response('数据库连接失败', { status: 500 });
  }

  return handleEmailReceive(request, DB, env);
}

function validateReceiveToken(request, env) {
  const receiveToken = String(env.RECEIVE_TOKEN || '').trim();
  if (!isLocalRequest(request) && !receiveToken) {
    return new Response('缺少 RECEIVE_TOKEN 配置：生产环境必须设置 RECEIVE_TOKEN', { status: 500 });
  }
  if (!receiveToken) return null;

  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const xToken = request.headers.get('X-Receive-Token') || '';
  if (isReceiveTokenMatch(receiveToken, bearer) || isReceiveTokenMatch(receiveToken, xToken)) {
    return null;
  }
  return new Response('Unauthorized', { status: 401 });
}

function isLocalRequest(request) {
  let hostname = '';
  try {
    hostname = new URL(request.url).hostname;
  } catch (_) {
    hostname = '';
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isReceiveTokenMatch(expectedToken, actualToken) {
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expectedToken);
  const actualBytes = encoder.encode(actualToken);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * 委托API请求到原有的处理器
 * @param {object} context - 请求上下文
 * @returns {Promise<Response>} HTTP响应
 */
async function delegateApiRequest(context) {
  const { request, env, authPayload } = context;
  let DB;
  try {
    DB = await getDatabaseWithValidation(env);
  } catch (error) {
    console.error('API请求时数据库连接失败:', error.message);
    return new Response('数据库连接失败', { status: 500 });
  }
  
  // 支持多个域名：使用逗号/空格分隔
  const MAIL_DOMAINS = (env.MAIL_DOMAIN || 'temp.example.com')
    .split(/[,\s]+/)
    .map(d => d.trim())
    .filter(Boolean);
    
  // RESEND配置支持多种格式：
  // 1. 单一API密钥：直接填写密钥
  // 2. 多域名配置：域名=密钥的键值对格式，如 "domain1.com=key1,domain2.com=key2"
  // 3. JSON格式：{"domain1.com": "key1", "domain2.com": "key2"}
  const RESEND_API_KEY = env.RESEND_API_KEY || env.RESEND_TOKEN || env.RESEND || '';
  const ADMIN_NAME = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
  const PASSWORD_ENCRYPTION_KEY =
    env.MAILBOX_PASSWORD_KEY ||
    env.MAILBOX_PASSWORD_ENCRYPTION_KEY ||
    env.PASSWORD_ENCRYPTION_KEY ||
    env.JWT_TOKEN ||
    env.JWT_SECRET ||
    '';

  // 邮箱用户只能访问自己的邮箱数据
  if (authPayload.role === 'mailbox') {
    return handleApiRequest(request, DB, MAIL_DOMAINS, { 
      mockOnly: false, 
      resendApiKey: RESEND_API_KEY, 
      adminName: ADMIN_NAME, 
      passwordEncryptionKey: PASSWORD_ENCRYPTION_KEY,
      r2: env.MAIL_EML, 
      authPayload,
      mailboxOnly: true
    });
  }
  
  return handleApiRequest(request, DB, MAIL_DOMAINS, { 
    mockOnly: false, 
    resendApiKey: RESEND_API_KEY, 
    adminName: ADMIN_NAME, 
    passwordEncryptionKey: PASSWORD_ENCRYPTION_KEY,
    r2: env.MAIL_EML, 
    authPayload 
  });
}
