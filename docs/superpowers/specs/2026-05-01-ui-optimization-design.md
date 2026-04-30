# UI Optimization Design

目标是把这次前端 UI 优化收束成一次低风险改造，不改业务接口，不改路由，不改登录权限逻辑。

本次只处理已经查到的真实问题。现有 `public/css/styles.css` 已经超过 1400 行，静态页面和渲染模板里散落大量内联样式，表格复选框和开关缺少稳定语义，空状态和加载状态重复写在多个页面里，所有页面还额外加载了 fill 图标字体。它们都会影响后续维护、移动端可用性和首屏资源体积。

设计方案是保留 `/css/styles.css` 入口不变，把它改成 CSS 聚合入口，再按 token、base、auth、shell、controls、tables、modals、user-mailbox、responsive 拆到 `public/css/app/`。页面不用改资源路径，避免破坏 Workers Assets 和缓存策略。

UI 状态统一通过 `public/js/ui-state.js` 输出。收件箱、历史邮箱、邮箱独立页加载和错误状态复用同一套 markup。表格控件统一通过 `public/js/ui-controls.js` 输出，给 checkbox、switch 和图标按钮补足 role、aria 和触屏可见性需要的类名。

静态 HTML 的内联样式迁移到 CSS 类。JS 模板里的固定视觉样式迁移到 CSS 类。必要的运行时测量和动态状态仍由 JS 写入，例如 iframe 高度、分段条位移、quota 宽度，这些是状态计算，不属于静态 UI 样式债。

图标资源只移除 fill 字体。fill 用途目前只有 GitHub、info 和 pinned push-pin，全部可用 regular/bold 权重替代。bold 仍保留，因为操作按钮大量使用 bold 权重，贸然移除会改变视觉层级。

验收标准是新增测试先失败，再实现到通过。静态 HTML 不再有 `style=` 和内联 `<style>`，页面不再引用 `/css/icons/fill.css`，CSS partial 单文件不超过 300 行，UI state 和 controls 可独立测试，已有前端模块 import 和全量 node test 仍通过。
