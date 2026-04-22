const fs = require('fs');

// Read the corrupted file as raw bytes to handle encoding issues
const raw = fs.readFileSync('vite.config.js', 'utf8');

// The function we want to replace - find it by unique markers
const funcStart = 'function buildReadmeContent()';
const funcEnd = '\nfunction openDirectory(targetPath)';

const startIdx = raw.indexOf(funcStart);
const endIdx = raw.indexOf(funcEnd);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find function boundaries!');
    console.log('startIdx:', startIdx, 'endIdx:', endIdx);
    process.exit(1);
}

const newFunc = `function buildReadmeContent() {
    return \`# WebDeck 使用指南

## 1. 环境配置 (Node.js)
在使用 WebDeck 之前，请确保您的电脑上已经安装了 **Node.js** 环境。
- **验证是否安装**：在键盘上按 \\\`Win + R\\\`，输入 \\\`cmd\\\` 打开命令提示符。在黑框中输入 \\\`node -v\\\` 并回车，如果下方出现了版本号（例如 \\\`v20.x.x\\\`），则说明已配置并安装成功。
- **如何安装**：如果提示"不是内部或外部命令"，请前往 [Node.js 官方网站 (https://nodejs.org)](https://nodejs.org) 下载最新的 LTS (长期维护版) 安装包，下载后双击运行，安装过程中一路点击"下一步"即可。

## 2. 启动服务与项目
1. 若您是首次获得本系统源码包，请在该项目根目录空白处**按住 Shift 键并点击鼠标右键**，选择"在此处打开 PowerShell 窗口/终端"。在弹出的蓝框中输入 \\\`npm install\\\` 并回车。系统将自动下载必备的组件（此操作终生只需执行一次）。
2. 配置就绪后，以后每次使用时，您只需**双击根目录下的 \\\`start.bat\\\` 脚本**！
3. 脚本会自动在后台架设本地服务引擎，并自动在浏览器中唤起您的 **WebDeck 控制台界面**。

## 3. 核心功能及操作指南
WebDeck 提供了一套无缝、沉浸式、极度灵活的 HTML 文档演示流。

### 📁 章节与页面管理 (大纲拼装)
- **大章节体系**：在左侧栏底部点击"添加"可建立您的核心骨架（如：研究背景、相关工作）。支持鼠标**按压拖动**任意调整章节先后顺序。
- **HTML 页面注入**：选中某个大章节后，您可以将本地已经写好的 \\\`.html\\\` 流式结构文件**直接拖拽**到右侧虚线框内！当然，您也可以点击章节名字旁的 \\\`➕\\\` 号立刻新建一页，直接粘贴代码进入。

### 🎨 沉浸式预览与自由编辑
- 在目录列表中点击任何一份切片页面，右方大屏都会**实时无缝渲染出该页在放映时的实际展现效果**（底层的排版引擎以及 Mathjax 公式库均已挂载待命）。
- 点击章节旁专属的 \\\`✏️\\\` 图标可以随时唤起质感满分的悬浮重命名模态框。不用担惊受怕，您做的所有挪动、改名都会立刻生效并固化排序。

### 🧰 幻灯放映及悬浮百宝箱
- 点击左侧顶部 "进入演示页面"，您组织好的所有页面都将转换为干净利落的全屏幕纵卷幻灯模式。
- **物理激光感知**：在屏幕任意处按下鼠标并滑动，都会触发带有残影的高级鼠标激光跟踪！
- **百宝箱集合库**：点击界面右下角的扳手 \\\`🛠️\\\` 图标将弹出工具面板。
- **随时批注**：您可以选取画笔 \\\`🖊\\\` 随意圈划重点，甚至通过内置拾色器定义你的个性化笔迹颜色；错误时一键使用 \\\`🧽\\\` 抹除。
- **原汁原味的 PDF**：在百宝箱内直接点击 \\\`🖨️\\\` 以调用系统级的高保真打印，完美隐去所有边框和底色导出极其纯净的学术风 PDF 报告。

### 🚀 终极杀器：离线项目导出
所有的工作准备就绪，点击控制台右上角的 **"💾 导出离线项目至 dist"**：
- 它会将后台依赖全部抽离，为您输出一份脱机即走、绝对静态可拷的 \\\`dist\\\` 文件夹包。
- 将它发给你的导师或者带去演讲机房，直接双击打开里面的 \\\`index.html\\\`，再没有任何卡脖子的依赖！

---

## 🤖 WebDeck 专属 AI 生成提示词 (Prompt)

如果你想让 ChatGPT、Claude 或其他 AI 助手为你自动生成适配 WebDeck 框架的高质量幻灯片，请直接复制以下整段 Prompt 发送给 AI：

\\\`\\\`\\\`
【系统指令：WebDeck 学术幻灯片架构师 v2】

你是一位专业的学术演示设计师与前端开发专家。我将为你提供一篇学术论文（或项目文档）的核心内容，请你帮我将其拆解、提炼，并转化为适用于 WebDeck 演示框架 的高质量前端 HTML 代码。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 第一阶段：大纲结构拆解
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 封面必须独立：第一个文件夹必须命名为 01_封面（系统会自动识别此名称以隐藏导航栏，实现全屏沉浸）。封面下一般放 1~2 个页面（主封面页 + 目录页）。
2. 正文逻辑：后续文件夹如 02_研究背景, 03_核心设计, 04_实验评估 等。每个文件夹通常 1~4 个 HTML 页面。
3. 文件命名：在文件夹内，按展示顺序以数字前缀命名，如 01_背景介绍.html, 02_问题定义.html。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 第二阶段：代码输出格式规范
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【输出格式】每个文件输出 HTML 代码片段。⛔ 绝对禁止输出 <!DOCTYPE html>、<html>、<head>、<body> 标签！

【<style> 标签】✅ 强烈鼓励：在每个页面开头写 <style> 标签，为本页定义专属 CSS 类。

🚫 CSS 安全红线（违反任何一条都会破坏框架布局）：
  - 禁止 * 通配符选择器
  - 禁止 html、body 标签选择器
  - 禁止覆盖 #top-nav、.slide、.slide-content 等框架保留选择器
  - 禁止使用 !important 和 position: fixed
  - 禁止直接裸写 h1 { }、p { }、li { } 等全局标签选择器（必须加自定义类前缀）

【框架内置 CSS 变量（可在 <style> 中直接引用）】
  --accent-color: #005eaa  --accent-light: #38bdf8
  --text-primary: #0f172a  --text-secondary: #475569
  --glass-bg: rgba(255,255,255,0.85)  --glass-border: rgba(0,94,170,0.15)  --shadow-color: rgba(0,94,170,0.08)

【框架已自动生效的排版】<h1> 4rem蓝色渐变 / <h2> 2.5rem学术蓝 / <p><li> 1.5rem灰色正文 / <ul>li 自带▪符号

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 内容密度与排版原则
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 每页要点不超过 5~7 条，<li> 控制在 1~2 行
2. 每页必须有视觉设计（卡片/双栏/数据面板），禁止"白板页面"（只有裸 <h1>+<ul>）
3. 学术公式：行内 \\\\( ... \\\\)，块级 $$...$$（框架已挂载 MathJax）
4. 占位图片：<img src="图片占位.png" style="width:80%;border-radius:8px;"> 后续替换

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧱 推荐布局模板（按需选用或自由变形）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▌模板 A：封面页（01_封面 文件夹专用，类名固定不可改）

    <div class="cover-page">
        <div class="title-container">
            <h1>这里填入论文主标题</h1>
            <h2 class="subtitle">副标题或汇报场景</h2>
        </div>
        <div class="author-info">
            <p class="presenter">汇报人：XXX</p>
            <p class="university">XX大学 · XX学院 | 202X年X月</p>
        </div>
    </div>

▌模板 B：信息卡片（研究背景、问题阐述等）

    <style>
      .cards-page { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem; }
      .cards-page .card { padding: 1.8rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; box-shadow: 0 8px 24px var(--shadow-color); backdrop-filter: blur(8px); }
      .cards-page .card h3 { font-size: 1.3rem; font-weight: 700; color: var(--accent-color); margin-bottom: 0.8rem; }
      .cards-page .card p { font-size: 1.1rem; color: var(--text-secondary); line-height: 1.6; }
    </style>
    <h1>章节主标题</h1>
    <div class="cards-page">
      <div class="card"><h3>🔍 要点一</h3><p>简洁描述...</p></div>
      <div class="card"><h3>📊 要点二</h3><p>简洁描述...</p></div>
      <div class="card"><h3>⚡ 要点三</h3><p>简洁描述...</p></div>
      <div class="card"><h3>🎯 要点四</h3><p>简洁描述...</p></div>
    </div>

▌模板 C：图文双栏（方法论、系统架构等）

    <style>
      .split-page { display: flex; gap: 3rem; align-items: flex-start; margin-top: 1.5rem; }
      .split-page .text-side { flex: 1; }
      .split-page .visual-side { flex: 1; display: flex; align-items: center; justify-content: center; }
      .split-page .visual-side img { width: 100%; border-radius: 12px; box-shadow: 0 10px 30px var(--shadow-color); }
    </style>
    <h1>页面标题</h1>
    <div class="split-page">
      <div class="text-side"><h2>核心思路</h2><ul><li>关键点一</li><li>关键点二</li><li>关键点三</li></ul></div>
      <div class="visual-side"><img src="图片占位.png" alt="示意图"></div>
    </div>

▌模板 D：数据指标面板（实验结果、性能对比）

    <style>
      .metrics-row { display: flex; gap: 2rem; margin: 2rem 0; justify-content: center; }
      .metrics-row .metric { flex: 1; text-align: center; padding: 2rem 1rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 8px 24px var(--shadow-color); }
      .metrics-row .metric .value { font-size: 3rem; font-weight: 800; color: var(--accent-color); }
      .metrics-row .metric .label { font-size: 1rem; color: var(--text-secondary); margin-top: 0.5rem; }
    </style>
    <h1>实验结果总览</h1>
    <div class="metrics-row">
      <div class="metric"><div class="value">95.2%</div><div class="label">准确率 Accuracy</div></div>
      <div class="metric"><div class="value">3.1×</div><div class="label">速度提升 Speedup</div></div>
      <div class="metric"><div class="value">Top-1</div><div class="label">排行榜排名</div></div>
    </div>
    <ul><li>在 8 个公开数据集上均超越现有 SOTA 方法</li><li>消融实验验证了各模块的有效性</li></ul>

▌模板 E：目录 / 章节概览

    <style>
      .toc-page .toc-list { list-style: none; padding: 0; margin-top: 2rem; }
      .toc-page .toc-item { display: flex; align-items: center; gap: 1.5rem; padding: 1rem 1.5rem; margin-bottom: 0.8rem; background: var(--glass-bg); border-radius: 8px; border-left: 0px solid var(--accent-color); transition: all 0.3s ease; }
      .toc-page .toc-item:hover { border-left-width: 5px; transform: translateX(8px); box-shadow: 0 4px 15px var(--shadow-color); }
      .toc-page .toc-num { font-size: 1.8rem; font-weight: 800; color: var(--accent-color); min-width: 2.5rem; }
      .toc-page .toc-title { font-size: 1.2rem; font-weight: 600; color: var(--text-primary); }
      .toc-page .toc-desc { font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.2rem; }
    </style>
    <div class="toc-page">
      <h1>汇报提纲</h1>
      <ul class="toc-list">
        <li class="toc-item"><span class="toc-num">01</span><div><div class="toc-title">研究背景与动机</div><div class="toc-desc">当前领域现状及本研究要解决的核心问题</div></div></li>
        <li class="toc-item"><span class="toc-num">02</span><div><div class="toc-title">方法论与核心设计</div><div class="toc-desc">本文提出的关键技术路线与创新点</div></div></li>
      </ul>
    </div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 开始任务
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请仔细阅读我接下来发送给你的文本内容，先输出【文件夹与文件推荐结构大纲】，确认无误后，再依次输出每个 HTML 文件的完整代码。

特别强调：每一页都必须有精心的视觉设计，绝对不允许出现只有裸 <h1> + <ul> 的"白板页面"。
\\\`\\\`\\\`
\`;\n}`;

const result = raw.slice(0, startIdx) + newFunc + funcEnd;
fs.writeFileSync('vite.config.js', result, 'utf8');
console.log('Done. Chars:', result.length);
