import { ensureMailboxAccess, ensureMessageAccess, userOwnsMailbox } from './apiContextAccess.js';
import { resolveAdminUserId } from './apiContextAdmin.js';
import {
  buildAuthContext,
  getJwtPayloadFromRequest,
  isStrictAdminPayload,
  isSuperAdminNameValue
} from './apiContextAuth.js';
import { createJsonBodyReader, formatD1Timestamp } from './apiContextBody.js';

export function createApiContext(request, db, mailDomains, options = {}) {
  const base = createBaseContext(request, db, mailDomains, options);
  const context = {
    ...base,
    readJsonBody: createJsonBodyReader(request),
    getJwtPayload: () => getJwtPayloadFromRequest(request, options),
    formatD1Timestamp,
  };
  return attachApiContextMethods(context);
}

function createBaseContext(request, db, mailDomains, options) {
  const url = new URL(request.url);
  const isMock = Boolean(options.mockOnly);
  const mockDomains = ['exa.cc', 'exr.yp', 'duio.ty'];
  const availableDomains = isMock
    ? mockDomains
    : (Array.isArray(mailDomains) ? mailDomains : [mailDomains || 'temp.example.com']);
  return {
    db,
    request,
    url,
    path: url.pathname,
    method: request.method,
    options,
    isMock,
    isMailboxOnly: Boolean(options.mailboxOnly),
    mailDomains,
    availableDomains,
    mockDomains,
    resendApiKey: options.resendApiKey || '',
    adminName: String(options.adminName || '').trim().toLowerCase(),
    passwordEncryptionKey: String(options.passwordEncryptionKey || '').trim(),
    r2: options.r2 || null,
  };
}

function attachApiContextMethods(context) {
  context.isStrictAdmin = () => isStrictAdminPayload(context.getJwtPayload(), context.adminName);
  context.isSuperAdminName = (username) => isSuperAdminNameValue(username, context.adminName);
  context.getAuthContext = () => buildAuthContext(context.getJwtPayload());
  context.userOwnsMailbox = (userId, mailboxId) => userOwnsMailbox(context.db, userId, mailboxId);
  context.ensureMailboxAccess = (mailboxId, mailboxAddress) => ensureMailboxAccess(context, mailboxId, mailboxAddress);
  context.ensureMessageAccess = (emailId) => ensureMessageAccess(context, emailId);
  context.resolveAdminUserId = () => resolveAdminUserId(context);
  return context;
}
