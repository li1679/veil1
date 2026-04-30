const DANGEROUS_EXTENSIONS = new Set([
  '.php', '.jsp', '.asp', '.aspx', '.py', '.rb', '.pl', '.sh', '.bat', '.cmd',
  '.exe', '.scr', '.com', '.pif', '.msi', '.dll', '.jar'
]);

const DANGEROUS_PATTERNS = [
  /\.\.\//,
  /\/\.\./,
  /\/etc\//,
  /\/proc\//,
  /\/sys\//,
  /\/var\/log\//,
  /\/root\//,
  /\/home\//,
  /\.env/,
  /\.git/,
  /\.svn/,
  /\/config\//,
  /\/admin\//,
  /\/private\//,
  /\/secret\//
];

const SUSPICIOUS_USER_AGENT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scanner/i,
  /sqlmap/i,
  /nikto/i,
  /nmap/i
];

export class AssetSecurityChecker {
  constructor() {
    this.dangerousExtensions = DANGEROUS_EXTENSIONS;
    this.dangerousPatterns = DANGEROUS_PATTERNS;
  }

  isPathSafe(pathname) {
    const normalizedPath = pathname.toLowerCase();
    if (hasDangerousExtension(normalizedPath, this.dangerousExtensions)) return false;
    return !this.dangerousPatterns.some((pattern) => pattern.test(normalizedPath));
  }

  areHeadersSafe(request) {
    const userAgent = request.headers.get('User-Agent') || '';
    return !SUSPICIOUS_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
  }

  assessRisk(request) {
    const url = new URL(request.url);
    const risks = [];
    if (!this.isPathSafe(url.pathname)) risks.push('dangerous_path');
    if (!this.areHeadersSafe(request)) risks.push('suspicious_headers');
    return {
      isHighRisk: risks.length > 0,
      risks,
      riskLevel: risks.length === 0 ? 'low' : risks.length === 1 ? 'medium' : 'high'
    };
  }
}

function hasDangerousExtension(pathname, extensions) {
  for (const extension of extensions) {
    if (pathname.endsWith(extension)) return true;
  }
  return false;
}
