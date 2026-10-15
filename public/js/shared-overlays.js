// Shared by all authenticated pages; IDs remain the controller contract.
const OVERLAYS = `
<div class="modal-overlay" id="sendModalOverlay" aria-hidden="true" aria-label="新邮件">
  <div class="sheet-modal">
    <div class="sheet-header">
      <button class="sheet-btn" data-command-click="closeSendModal">取消</button>
      <div class="sheet-title">新邮件</div>
      <button class="sheet-btn send" id="sendBtn" data-command-click="doSendEmail" disabled>发送</button>
    </div>
    <div class="sheet-body">
      <div class="compose-field"><label class="compose-label" for="senderNameInput">发件名称</label><input class="compose-input" id="senderNameInput" placeholder="例如：Veil" data-command-input="checkComposeInput"></div>
      <div class="compose-field"><label class="compose-label" for="toInput">收件人</label><input class="compose-input" id="toInput" inputmode="email" placeholder="recipient@example.com" data-command-input="checkComposeInput"></div>
      <div class="compose-field"><label class="compose-label" for="subjectInput">主题</label><input class="compose-input" id="subjectInput" placeholder="邮件主题" data-command-input="checkComposeInput"></div>
      <textarea class="compose-area" id="contentInput" aria-label="邮件正文" placeholder="输入邮件正文…" data-command-input="checkComposeInput"></textarea>
    </div>
  </div>
</div>
<div class="modal-overlay" id="mailDetailModal" aria-hidden="true" aria-label="邮件详情">
  <div class="sheet-modal mail-detail-modal">
    <div class="sheet-header"><button class="sheet-btn" data-command-click="closeMailDetail">关闭</button><div class="sheet-title">邮件详情</div><div class="sheet-spacer"></div></div>
    <div class="mail-detail-header">
      <h2 class="mail-detail-subject" id="mailDetailSubject"></h2>
      <div class="mail-detail-meta">
        <div class="mail-detail-avatar" id="mailDetailAvatar"></div>
        <div class="mail-detail-info"><div class="mail-detail-from" id="mailDetailFrom"></div><div class="mail-detail-to">收件人：<span id="mailDetailTo"></span></div></div>
        <div class="mail-detail-time" id="mailDetailTime"></div>
      </div>
    </div>
    <div class="mail-detail-body" id="mailDetailBody"></div>
  </div>
</div>
<div class="modal-overlay" id="iosAlertModal" aria-hidden="true" aria-labelledby="iosAlertTitle">
  <div class="ios-alert-box">
    <div class="ios-alert-content"><h3 id="iosAlertTitle" class="ios-alert-title">确认操作</h3><p id="iosAlertDesc" class="ios-alert-desc">确定要继续吗？</p></div>
    <div class="ios-alert-buttons"><button class="ios-alert-btn cancel">取消</button><button id="iosAlertConfirmBtn" class="ios-alert-btn destruct">确定</button></div>
  </div>
</div>`;

export function mountSharedOverlays() {
    const host = document.getElementById('sharedOverlays');
    host.innerHTML = OVERLAYS;
}
