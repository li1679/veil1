const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const mailboxAddress = 'loginbox@example.com';
const detail = {
  id: 1,
  sender: 'sender@example.com',
  to_addrs: mailboxAddress,
  subject: 'HTML fallback body',
  content: '<table><tr><td>Readable HTML body</td></tr></table>',
  html_content: '',
  received_at: '2026-04-28 00:00:00',
};
const listItem = {
  id: 1,
  sender: detail.sender,
  subject: detail.subject,
  preview: 'Readable HTML body',
  received_at: detail.received_at,
};
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.json', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        send(res, 500, `Unstubbed API reached server: ${url.pathname}`);
        return;
      }
      const pathname = url.pathname === '/' ? '/mailbox.html' : decodeURIComponent(url.pathname);
      const filePath = path.normalize(path.join(publicRoot, pathname));
      if (!filePath.startsWith(publicRoot)) {
        send(res, 403, 'Forbidden');
        return;
      }
      const data = await fs.readFile(filePath);
      send(res, 200, data, mimeTypes.get(path.extname(filePath)) || 'application/octet-stream');
    } catch (error) {
      send(res, error.code === 'ENOENT' ? 404 : 500, error.message);
    }
  });
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;

  try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    const page = await browser.newPage();
    await page.route('**/api/session', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, role: 'mailbox', username: mailboxAddress, mailbox_address: mailboxAddress, can_send: 0 }),
    }));
    await page.route('**/api/emails', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ emails: [listItem] }),
    }));
    await page.route('**/api/email/1', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detail),
    }));

    await page.goto(`http://127.0.0.1:${server.address().port}/mailbox.html`);
    await page.waitForSelector('.mail-item', { timeout: 3000 });
    await page.click('.mail-item');
    await page.waitForSelector('.mail-detail-frame', { timeout: 3000 });

    const outerText = await page.locator('#mailDetailBody').textContent();
    if (outerText.includes('<table>')) {
      throw new Error(`Raw HTML leaked into detail body: ${outerText}`);
    }

    const frameBody = page.frameLocator('.mail-detail-frame').locator('body');
    await frameBody.waitFor({ timeout: 3000 });
    const frameText = await frameBody.textContent();
    if (!frameText.includes('Readable HTML body')) {
      throw new Error(`Expected readable HTML body in iframe, got: ${frameText}`);
    }

    console.log('PASS inbox renders HTML-looking text as sanitized iframe content');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
