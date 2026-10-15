import { getBulkGenerateLimit } from './mailbox-config.js';

const HOME_TEMPLATE = `
            <!-- 邮箱显示 -->
            <div class="email-display-container" role="button" tabindex="0" aria-label="查看收件箱" data-command-click="scrollToInbox">
                <div class="current-email" id="fullEmailDisplay">
                    <span id="prefixText">先生成一个邮箱</span><span id="suffixText" class="suffix-text"></span>
                </div>
                <div class="click-hint">点击查看收件箱</div>
            </div>

            <!-- 操作按钮 -->
            <div class="actions-row disabled" id="actionButtons">
                <button class="btn btn-secondary" data-command-click="copyEmail"><i class="ph-bold ph-copy"></i> <span>复制</span></button>
                <button class="btn btn-secondary" data-command-click="refreshInbox"><i class="ph-bold ph-arrows-clockwise"></i> <span>刷新</span></button>
                <button class="btn btn-primary send-action-btn" id="sendActionBtn" data-command-click="openSendModal"><i class="ph-bold ph-paper-plane-tilt"></i> <span>发送</span></button>
                <button class="btn btn-danger" data-command-click="confirmClearInbox"><i class="ph-bold ph-trash"></i> <span>清空</span></button>
            </div>

            <!-- 配置和历史 -->
            <div class="dashboard-grid">
                <div class="panel-group">
                    <div class="group-header">生成配置</div>
                    <div class="ios-card">
                        <div class="field-label-sm">域名后缀</div>
                        <select class="filter-select domain-select" id="domainSelect" aria-label="域名后缀" disabled><option>加载域名中…</option></select>

                        <div class="form-row setting-row setting-row-spaced">
                            <div>
                                <div class="setting-title">随机域名后缀</div>
                                <div class="muted-caption">开启后每次生成都会随机选择域名</div>
                            </div>
                            <div class="ios-switch" id="randomDomainSwitch" role="switch" tabindex="0" aria-checked="false" aria-label="切换随机域名后缀" data-command-click="toggleRandomDomain">
                                <div class="ios-switch-thumb"></div>
                            </div>
                        </div>

                        <div class="field-label-sm">有效时长</div>
                        <div class="segment-container segment-4">
                            <div class="segment-bg segment-pos-1" id="expirySegmentBg"></div>
                            <button class="segment-btn" data-command-click="setExpiry" data-command-args="[&quot;$element&quot;,&quot;1h&quot;,0]">1小时</button>
                            <button class="segment-btn active" data-command-click="setExpiry" data-command-args="[&quot;$element&quot;,&quot;24h&quot;,1]">1天</button>
                            <button class="segment-btn" data-command-click="setExpiry" data-command-args="[&quot;$element&quot;,&quot;3d&quot;,2]">3天</button>
                            <button class="segment-btn" data-command-click="setExpiry" data-command-args="[&quot;$element&quot;,&quot;permanent&quot;,3]">永久</button>
                        </div>

                        <div class="field-label-sm">前缀模式</div>
                        <div class="segment-container">
                            <div class="segment-bg" id="segmentBg"></div>
                            <button class="segment-btn active" data-command-click="setPrefixMode" data-command-args="[&quot;$element&quot;,&quot;random&quot;,0]">随机</button>
                            <button class="segment-btn" data-command-click="setPrefixMode" data-command-args="[&quot;$element&quot;,&quot;name&quot;,1]">人名</button>
                            <button class="segment-btn" data-command-click="setPrefixMode" data-command-args="[&quot;$element&quot;,&quot;custom&quot;,2]">自定义</button>
                        </div>

                        <input type="text" class="custom-input" id="customInputBox" aria-label="自定义邮箱前缀" maxlength="64" placeholder="输入自定义前缀…">

                        <div id="lengthSection" class="slider-container">
                            <div class="slider-header">
                                <span>长度</span>
                                <span id="lengthDisplay" class="text-accent">12</span>
                            </div>
                            <input type="range" id="lengthSlider" min="4" max="32" value="12" aria-label="前缀长度" data-command-input="updateLengthLabel" data-command-args="[&quot;$value&quot;]">
                        </div>

                        <div id="bulkCountSection" class="slider-container">
                            <div class="slider-header">
                                <span>数量</span>
                                <span id="generateCountDisplay" class="text-accent">1</span>
                            </div>
                            <input type="range" id="generateCountInput" min="1" value="1" data-command-input="updateGenerateCount" data-command-args="[&quot;$value&quot;]" aria-label="批量生成数量">
                        </div>

                        <button class="btn btn-primary generate-btn" data-command-click="generateEmail" disabled>
                            立即生成
                        </button>
                        <p class="hint-text generation-hint" id="generateHint">正在加载域名</p>
                        <button class="text-button is-hidden" id="retryDomainsBtn" data-command-click="retryDomains">重新加载域名</button>
                    </div>
                </div>

                <div class="panel-group">
                    <div class="section-heading-row">
                        <div class="group-header group-header-tight">历史邮箱</div>
                        <i class="ph ph-trash clear-history-btn" role="button" tabindex="0" aria-label="清空历史邮箱" data-command-click="confirmClearHistory" title="清空所有"></i>
                    </div>
                    <div class="ios-card history-card">
                        <div class="history-list" id="historyListContainer">
                            <div class="state-block state-loading state-compact" aria-live="polite"><i class="ph ph-spinner spinning" aria-hidden="true"></i><span class="state-title">加载中...</span></div>
                        </div>
                        <button class="text-button history-more is-hidden" id="historyLoadMore" data-command-click="loadMoreHistory">加载更多邮箱</button>
                    </div>
                </div>
            </div>

            <!-- 收件箱 -->
            <div class="inbox-section" id="inboxSection">
                <div class="inbox-header">
                    <div class="inbox-title"><span class="status-dot"></span> 收件箱</div>
                    <div class="inbox-caption" id="inboxStatus">选择邮箱后开始收件</div>
                </div>
                <div id="inboxContainer" class="inbox-empty">
                    <div class="state-block state-empty"><i class="ph ph-tray" aria-hidden="true"></i><span class="state-title">准备接收邮件</span><span class="state-description">选择或生成邮箱即可开始</span></div>
                </div>
            </div>
`;

export function mountHomeTemplate(container, role) {
    container.innerHTML = HOME_TEMPLATE;
    document.getElementById('generateCountInput').max = String(getBulkGenerateLimit(role));
    document.getElementById('sendActionBtn').classList.toggle('is-allowed', role === 'StrictAdmin');
}
