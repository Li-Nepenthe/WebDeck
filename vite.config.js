import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

async function parseJsonBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function getFolderConfigPath(folderPath) {
    return path.join(folderPath, 'config.json');
}

function readFolderConfig(folderPath) {
    const configPath = getFolderConfigPath(folderPath);
    const defaults = {
        showInNav: true,
        hideNav: false,
        hiddenFiles: []
    };

    if (!fs.existsSync(configPath)) {
        return defaults;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
            showInNav: parsed.showInNav !== false,
            hideNav: parsed.hideNav === true,
            hiddenFiles: Array.isArray(parsed.hiddenFiles) ? parsed.hiddenFiles : []
        };
    } catch {
        return defaults;
    }
}

function writeFolderConfig(folderPath, config) {
    const normalized = {
        showInNav: config.showInNav !== false,
        hideNav: config.hideNav === true,
        hiddenFiles: Array.isArray(config.hiddenFiles) ? [...new Set(config.hiddenFiles)].sort((a, b) => a.localeCompare(b)) : []
    };

    fs.writeFileSync(
        getFolderConfigPath(folderPath),
        JSON.stringify(normalized, null, 2),
        'utf-8'
    );
}

function getNextPrefix(dir) {
    if (!fs.existsSync(dir)) return '00';
    const items = fs.readdirSync(dir);
    const prefixes = items
        .filter(item => /^\d+_/.test(item))
        .map(item => parseInt(item.split('_')[0], 10));
    const maxPrefix = prefixes.length > 0 ? Math.max(...prefixes) : -1;
    const nextPrefix = maxPrefix + 1;
    return nextPrefix < 10 ? `0${nextPrefix}` : `${nextPrefix}`;
}

function serializeForInlineScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function findAssetSource(rootDir, filename) {
    const candidates = [
        path.resolve(rootDir, filename),
        path.resolve(rootDir, 'public', filename)
    ];
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function readSlidesManifest(slidesDir, options = {}) {
    const { includeHtml = false } = options;
    if (!fs.existsSync(slidesDir)) return [];

    return fs.readdirSync(slidesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(dirent => {
            const folderPath = path.join(slidesDir, dirent.name);
            const folderConfig = readFolderConfig(folderPath);
            const files = fs.readdirSync(folderPath)
                .filter(filename => filename.endsWith('.html'))
                .sort((a, b) => a.localeCompare(b))
                .map(filename => {
                    const filePath = path.join(folderPath, filename);
                    const html = fs.readFileSync(filePath, 'utf-8');
                    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
                    const record = {
                        filename,
                        title: titleMatch ? titleMatch[1] : filename,
                        visible: !folderConfig.hiddenFiles.includes(filename)
                    };

                    if (includeHtml) {
                        record.html = html;
                    }

                    return record;
                });

            return {
                name: dirent.name,
                title: dirent.name.replace(/^\d+_/, ''),
                showInNav: folderConfig.showInNav,
                hideNav: folderConfig.hideNav,
                files
            };
        });
}

function buildPresentationData(slidesDir) {
    const manifest = readSlidesManifest(slidesDir, { includeHtml: true });
    const chapters = [];
    const slides = [];

    manifest.forEach(folder => {
        const visibleFiles = folder.files.filter(file => file.visible);
        const startIndex = visibleFiles.length > 0 ? slides.length : -1;

        chapters.push({
            prefix: folder.name,
            title: folder.title,
            showInNav: folder.showInNav,
            hideNav: folder.hideNav,
            startIndex,
            isEmpty: visibleFiles.length === 0,
            totalFiles: folder.files.length,
            visibleFiles: visibleFiles.length
        });

        visibleFiles.forEach(file => {
            slides.push({
                html: file.html,
                chapterTitle: folder.title,
                chapterPrefix: folder.name,
                filename: file.filename,
                title: file.title
            });
        });
    });

    return { chapters, slides };
}

function buildSlidesDb(slidesDir) {
    return buildPresentationData(slidesDir).slides.map(slide => ({
        html: slide.html,
        chapterTitle: slide.chapterTitle,
        chapterPrefix: slide.chapterPrefix
    }));
}

function buildReadmeContent() {
    return `# WebDeck 控制台使用指南

本指南将帮助你快速启动并使用 WebDeck 演示项目管理台。

## 1. 环境准备 (配置 Node.js)

在运行本项目之前，需要确保你的电脑已经安装了 Node.js 环境：
1. 访问 Node.js 官网：[https://nodejs.org/](https://nodejs.org/)。
2. 下载并按照提示安装 LTS (长期维护) 版本。
3. 安装过程保持默认选项即可，一直点击“下一步”直到完成。

## 2. 启动控制台

无需手动输入复杂的命令行，只需执行以下简便操作：
1. 在当前项目文件夹下找到 \`start.bat\` 脚本文件。
2. **双击运行 \`start.bat\`**。
3. 脚本会自动检查环境、安装所需的依赖，并在浏览器中自动为你打开 WebDeck 控制台界面。

## 3. 控制台功能概览

成功进入控制台后，你可以使用以下主要功能来高效管理你的演示内容：

- **章节管理**
  - **创建章节**：在左侧区域点击新增章节（相当于演示的各个部分）。
  - **重命名与排序**：可以随时修改章节名称，并通过拖拽轻松调整章节的前后顺序。
  
- **幻灯片内容导入**
  - **拖拽上传**：选中某个章节后，将本地准备好的 HTML 幻灯片文件直接拖入中间的内容区域即可快速导入。

- **项目预览与放映**
  - **实时预览**：点击预览按钮，可以直接在浏览器中查看当前的演示效果，管理台的修改会实时同步。

- **离线交付与导出**
  - **一键导出**：点击右上角的“导出离线项目”，系统会将当前所有的幻灯片合并打包到 \`dist\` 目录下的独立文件夹中。
  - **便于分享**：导出的离线项目已解除了所有环境依赖。你可以直接将该文件夹打包发送给其他人，对方只需双击里面的 \`index.html\` 就能直接在任意浏览器播放演示，支持完全断网脱机使用。
  - **目录管理**：支持一键打开 \`dist\` 目录或清空旧的导出结果。

---

## 🤖 WebDeck 专属 AI 生成提示词 (Prompt)

如果你想让 ChatGPT、Claude 或其他 AI 助手为你自动生成适配 WebDeck 框架的高质量幻灯片，请直接复制以下 Prompt 发送给 AI：

\`\`\`markdown
**【系统指令：WebDeck 学术幻灯片架构师 v2】**

你是一位专业的学术演示设计师与前端开发专家。我将为你提供一篇学术论文（或项目文档）的核心内容，请你帮我将其拆解、提炼，并转化为适用于 **WebDeck 演示框架** 的前端 HTML 代码。

---

### 📌 第一阶段：大纲结构拆解
请按照学术汇报逻辑，拆分出几个大章节文件夹，并在每个大章节下规划具体的 HTML 页面。
1. **封面必须独立**：第一个文件夹必须命名为 \`01_封面\`（系统会自动识别此名称以隐藏导航栏，实现全屏沉浸）。封面下一般放 1~2 个页面（主封面、目录页）。
2. **正文逻辑**：后续文件夹如 \`02_研究背景\`, \`03_核心设计\`, \`04_实验评估\` 等。每个文件夹通常 1~4 个 HTML 页面。
3. **文件命名**：在文件夹内，按展示顺序以数字前缀命名文件，如 \`01_背景介绍.html\`, \`02_问题定义.html\`。

---

### 🎨 第二阶段：代码格式与架构规范

#### 核心输出格式
你只需输出 **HTML 代码片段**。系统会自动在外层包裹 \`<html>/<head>/<body>\` 以及 \`.slide > .slide-content\` 容器结构。

⚠️ **绝对不要包含** \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, \`<body>\` 标签！

#### ✅ 允许且鼓励使用 \`<style>\` 标签
你 **可以且应该** 在每个页面开头写一个 \`<style>\` 标签来定义该页面的专属 CSS 类，以实现丰富的视觉效果。所有自定义样式 **必须使用 class 选择器**，绝对不能使用全局标签选择器。

#### 🚫 CSS 安全红线（违反任何一条都会破坏框架）
- 严禁 \`*\` 通配符选择器（破坏所有元素的默认盒模型）
- 严禁 \`html\`, \`body\` 标签选择器（破坏框架全屏布局引擎）
- 严禁 \`#top-nav\`, \`.slide\`, \`.slide-content\`（框架保留的核心选择器）
- 严禁 \`!important\` 声明（会覆盖框架样式权重）
- 严禁 \`position: fixed\`（会逃逸出幻灯片容器边界）
- 严禁直接裸写 \`h1 { }\`, \`p { }\`, \`li { }\`（会污染框架预设排版，必须加自定义类前缀如 \`.my-page h1 { }\`）

#### ✅ CSS 正确写法示例
    <style>
      /* ✅ 正确：用自定义类名限定作用域 */
      .bg-intro { display: flex; gap: 2rem; align-items: flex-start; }
      .bg-intro .info-card {
        flex: 1;
        padding: 1.5rem 2rem;
        background: rgba(0, 94, 170, 0.04);
        border-left: 4px solid var(--accent-color);
        border-radius: 8px;
      }
      .bg-intro .info-card h3 {
        font-size: 1.3rem;
        color: var(--accent-color);
        margin-bottom: 0.5rem;
      }
    </style>
    
    <div class="bg-intro">
      <div class="info-card">
        <h3>卡片标题</h3>
        <p>内容描述...</p>
      </div>
    </div>

---

### 🎨 框架内置设计系统参考

#### CSS 变量色板（可在你的 \`<style>\` 中直接引用）
- \`--accent-color\`: \`#005eaa\` — 🔵 主题学术蓝
- \`--accent-light\`: \`#38bdf8\` — 💡 亮蓝色
- \`--text-primary\`: \`#0f172a\` — 主要文字色
- \`--text-secondary\`: \`#475569\` — 正文次要文字色
- \`--glass-bg\`: \`rgba(255,255,255,0.85)\` — 毛玻璃背景
- \`--glass-border\`: \`rgba(0,94,170,0.15)\` — 毛玻璃边框
- \`--shadow-color\`: \`rgba(0,94,170,0.08)\` — 阴影色

#### 框架已自动生效的排版（无需手动设置）
- \`<h1>\` → 4rem 超大字号，蓝色渐变文字，font-weight 800
- \`<h2>\` → 2.5rem，学术蓝纯色，font-weight 600
- \`<p>\`, \`<li>\` → 1.5rem，灰色正文，1.6 行高
- \`<ul> > <li>\` → 自带蓝色 ▪ 列表符号

---

### 📐 页面内容密度与排版指导
1. **每页要点不超过 5~7 条**，提炼核心观点
2. **绝不堆砌大段文字**！一个 \`<li>\` 条目建议控制在 1~2 行内
3. **善用可视化布局**：卡片、双栏、表格、关键词高亮等手法
4. **学术公式**：原生支持 MathJax。行内 \`\\( ... \\)\`，块级 \`$$...$$\`
5. **占位图片**：\`<img src="图片占位.png" style="width: 80%; border-radius: 8px;">\`

---

### 🧱 推荐页面布局模板

**请务必为每个页面创造有设计感的视觉层次，不要只是裸写 \`<h1>\` + \`<ul>\`。**

**模板 A：封面页**（\`01_封面\` 文件夹专用）— 使用 \`.cover-page\` > \`.title-container\` > \`.author-info\` 固定类名。

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

**模板 B：信息卡片**（研究背景等）— 用 \`<style>\` 定义 grid 布局的 \`.card\` 卡片，配合 \`var(--glass-bg)\`, \`var(--glass-border)\` 实现毛玻璃效果。

    <style>
      .cards-page { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem; }
      .cards-page .card {
        padding: 1.8rem;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: 12px;
        box-shadow: 0 8px 24px var(--shadow-color);
        backdrop-filter: blur(8px);
      }
      .cards-page .card h3 { font-size: 1.3rem; font-weight: 700; color: var(--accent-color); margin-bottom: 0.8rem; }
      .cards-page .card p { font-size: 1.1rem; color: var(--text-secondary); line-height: 1.6; }
    </style>
    
    <h1>章节主标题</h1>
    <div class="cards-page">
      <div class="card">
        <h3>🔍 要点一</h3>
        <p>简洁描述内容...</p>
      </div>
      <div class="card">
        <h3>📊 要点二</h3>
        <p>简洁描述内容...</p>
      </div>
      <div class="card">
        <h3>⚡ 要点三</h3>
        <p>简洁描述内容...</p>
      </div>
      <div class="card">
        <h3>🎯 要点四</h3>
        <p>简洁描述内容...</p>
      </div>
    </div>

**模板 C：图文双栏**（方法论等）— 用 flex 布局，左侧文字右侧图片。

    <style>
      .split-page { display: flex; gap: 3rem; align-items: flex-start; margin-top: 1.5rem; }
      .split-page .text-side { flex: 1; }
      .split-page .visual-side { flex: 1; display: flex; align-items: center; justify-content: center; }
      .split-page .visual-side img { width: 100%; border-radius: 12px; box-shadow: 0 10px 30px var(--shadow-color); }
    </style>
    
    <h1>页面标题</h1>
    <div class="split-page">
      <div class="text-side">
        <h2>核心思路</h2>
        <ul>
          <li>第一个关键点</li>
          <li>第二个关键点</li>
          <li>第三个关键点</li>
        </ul>
      </div>
      <div class="visual-side">
        <img src="图片占位.png" alt="示意图">
      </div>
    </div>

**模板 D：数据指标面板**（实验结果等）— 大号数字 + 标签的指标卡片行。

    <style>
      .metrics-row { display: flex; gap: 2rem; margin: 2rem 0; justify-content: center; }
      .metrics-row .metric {
        flex: 1;
        text-align: center;
        padding: 2rem 1rem;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        box-shadow: 0 8px 24px var(--shadow-color);
      }
      .metrics-row .metric .value { font-size: 3rem; font-weight: 800; color: var(--accent-color); }
      .metrics-row .metric .label { font-size: 1rem; color: var(--text-secondary); margin-top: 0.5rem; }
    </style>
    
    <h1>实验结果总览</h1>
    <div class="metrics-row">
      <div class="metric">
        <div class="value">95.2%</div>
        <div class="label">准确率 (Accuracy)</div>
      </div>
      <div class="metric">
        <div class="value">3.1×</div>
        <div class="label">速度提升 (Speedup)</div>
      </div>
      <div class="metric">
        <div class="value">Top-1</div>
        <div class="label">排行榜排名</div>
      </div>
    </div>
    <ul>
      <li>在 8 个公开数据集上均超越现有 SOTA 方法</li>
      <li>消融实验验证了各模块的有效性</li>
    </ul>

**模板 E：目录页**（章节概览）— 带序号的可交互列表条目。

    <style>
      .toc-page .toc-list { list-style: none; padding: 0; margin-top: 2rem; }
      .toc-page .toc-item {
        display: flex; align-items: center; gap: 1.5rem;
        padding: 1rem 1.5rem; margin-bottom: 0.8rem;
        background: var(--glass-bg); border-radius: 8px;
        border-left: 0px solid var(--accent-color);
        transition: all 0.3s ease;
      }
      .toc-page .toc-item:hover { border-left-width: 5px; transform: translateX(8px); box-shadow: 0 4px 15px var(--shadow-color); }
      .toc-page .toc-num { font-size: 1.8rem; font-weight: 800; color: var(--accent-color); min-width: 2.5rem; }
      .toc-page .toc-title { font-size: 1.2rem; font-weight: 600; color: var(--text-primary); }
      .toc-page .toc-desc { font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.2rem; }
    </style>
    
    <div class="toc-page">
      <h1>汇报提纲</h1>
      <ul class="toc-list">
        <li class="toc-item">
          <span class="toc-num">01</span>
          <div>
            <div class="toc-title">研究背景与动机</div>
            <div class="toc-desc">当前领域现状及本研究要解决的核心问题</div>
          </div>
        </li>
        <li class="toc-item">
          <span class="toc-num">02</span>
          <div>
            <div class="toc-title">方法论与核心设计</div>
            <div class="toc-desc">本文提出的关键技术路线与创新点</div>
          </div>
        </li>
        <!-- 更多条目... -->
      </ul>
    </div>

---

### 🚀 开始任务
请仔细阅读我接下来发送给你的文本内容，先输出你的【文件夹与文件推荐结构大纲】，确认无误后，再依次输出每个 HTML 文件的完整代码。

**特别强调**：每一页都必须有精心的视觉设计（善用 \`<style>\` 定义卡片、网格、高亮框、数据面板等），绝对不允许出现只有裸 \`<h1>\` + \`<ul>\` 的"白板页面"。
\`\`\`
`;
}

function openDirectory(targetPath) {
    spawn('explorer.exe', [targetPath], {
        detached: true,
        stdio: 'ignore'
    }).unref();
}

function openFile(targetPath) {
    const escapedPath = targetPath.replace(/'/g, "''");
    spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process -LiteralPath '${escapedPath}'`], {
        detached: true,
        stdio: 'ignore'
    }).unref();
}

export default defineConfig({
    base: './',
    plugins: [
        {
            name: 'mockppt-manager-api',
            configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                    const rootDir = process.cwd();
                    const slidesDir = path.resolve(rootDir, 'slides');
                    const distDir = path.resolve(rootDir, 'dist');
                    const readmePath = path.resolve(rootDir, 'README.md');

                    ensureDir(slidesDir);

                    if (req.url === '/api/slides-preview' && req.method === 'GET') {
                        const slidesDb = buildSlidesDb(slidesDir);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(slidesDb));
                        return;
                    }

                    if (req.url === '/api/presentation-data' && req.method === 'GET') {
                        const presentationData = buildPresentationData(slidesDir);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(presentationData));
                        return;
                    }

                    if (req.url === '/api/list' && req.method === 'GET') {
                        const folders = readSlidesManifest(slidesDir).map(folder => ({
                            name: folder.name,
                            title: folder.title,
                            showInNav: folder.showInNav,
                            hideNav: folder.hideNav,
                            files: folder.files.map(file => ({
                                filename: file.filename,
                                title: file.title,
                                visible: file.visible
                            }))
                        }));

                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ folders }));
                        return;
                    }

                    if (req.url === '/api/create' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.name) {
                            const prefix = getNextPrefix(slidesDir);
                            const folderName = `${prefix}_${body.name}`;
                            const newPath = path.join(slidesDir, folderName);
                            ensureDir(newPath);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, folderName }));
                        }
                        return;
                    }

                    if (req.url === '/api/reorder' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.items && Array.isArray(body.items)) {
                            try {
                                const targetDir = body.parent ? path.join(slidesDir, body.parent) : slidesDir;
                                const tempMapping = body.items.map((name, index) => {
                                    const prefix = index + 1 < 10 ? `0${index + 1}` : `${index + 1}`;
                                    const cleanName = name.replace(/^\d+_/, '');
                                    return { old: name, new: `${prefix}_${cleanName}` };
                                });

                                tempMapping.forEach(item => {
                                    const oldPath = path.join(targetDir, item.old);
                                    const tempPath = path.join(targetDir, `TEMP_${item.old}`);
                                    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, tempPath);
                                });

                                tempMapping.forEach(item => {
                                    const tempPath = path.join(targetDir, `TEMP_${item.old}`);
                                    const newPath = path.join(targetDir, item.new);
                                    if (fs.existsSync(tempPath)) fs.renameSync(tempPath, newPath);
                                });

                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        }
                        return;
                    }

                    if (req.url === '/api/toggle-folder-nav' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder) {
                            try {
                                const folderPath = path.join(slidesDir, body.folder);
                                const config = readFolderConfig(folderPath);
                                config.showInNav = body.showInNav !== false;
                                writeFolderConfig(folderPath, config);
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        }
                        return;
                    }

                    if (req.url === '/api/toggle-folder-hidenav' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder) {
                            try {
                                const folderPath = path.join(slidesDir, body.folder);
                                const config = readFolderConfig(folderPath);
                                config.hideNav = body.hideNav === true;
                                config.showInNav = !config.hideNav;
                                writeFolderConfig(folderPath, config);
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        }
                        return;
                    }

                    if (req.url === '/api/toggle-file-visibility' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder && body.filename) {
                            try {
                                const folderPath = path.join(slidesDir, body.folder);
                                const config = readFolderConfig(folderPath);
                                const hiddenFiles = new Set(config.hiddenFiles);

                                if (body.visible === false) hiddenFiles.add(body.filename);
                                else hiddenFiles.delete(body.filename);

                                config.hiddenFiles = [...hiddenFiles];
                                writeFolderConfig(folderPath, config);

                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        }
                        return;
                    }

                    if (req.url === '/api/export-project' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.projectName) {
                            try {
                                const projectPath = path.resolve(distDir, body.projectName);
                                fs.rmSync(projectPath, { recursive: true, force: true });
                                ensureDir(projectPath);

                                ['style.css', 'logo-badge.png', 'logo-text.png'].forEach(filename => {
                                    const src = findAssetSource(rootDir, filename);
                                    if (src) fs.copyFileSync(src, path.join(projectPath, filename));
                                });

                                const template = fs.readFileSync(path.resolve(rootDir, 'ppt-standalone-template.html'), 'utf-8');
                                const presentationData = buildPresentationData(slidesDir);
                                const html = template.replace('__PRESENTATION_DATA__', serializeForInlineScript(presentationData));

                                fs.writeFileSync(path.join(projectPath, 'index.html'), html, 'utf-8');

                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true, path: projectPath }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        }
                        return;
                    }

                    if (req.url === '/api/clear-dist' && req.method === 'POST') {
                        if (fs.existsSync(distDir)) {
                            for (const entry of fs.readdirSync(distDir)) {
                                const entryPath = path.join(distDir, entry);
                                try {
                                    fs.rmSync(entryPath, { recursive: true, force: true });
                                } catch {
                                    // Ignore locked files and continue clearing the rest.
                                }
                            }
                        } else {
                            ensureDir(distDir);
                        }

                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true }));
                        return;
                    }

                    if (req.url === '/api/open-dist' && req.method === 'POST') {
                        ensureDir(distDir);

                        try {
                            openDirectory(distDir);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, path: distDir }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        }
                        return;
                    }

                    if (req.url === '/api/readme' && req.method === 'GET') {
                        try {
                            if (!fs.existsSync(readmePath)) {
                                fs.writeFileSync(readmePath, '# MockPPT\n', 'utf-8');
                            }
                            const content = fs.readFileSync(readmePath, 'utf-8');
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, path: readmePath, content }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        }
                        return;
                    }

                    if (req.url === '/api/open-readme' && req.method === 'POST') {
                        try {
                            if (!fs.existsSync(readmePath)) {
                                fs.writeFileSync(readmePath, '# MockPPT\n', 'utf-8');
                            }
                            openFile(readmePath);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, path: readmePath }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        }
                        return;
                    }

                    if (req.url === '/api/update-readme' && req.method === 'POST') {
                        try {
                            const existingReadme = fs.existsSync(readmePath)
                                ? fs.readFileSync(readmePath, 'utf-8')
                                : '';
                            const content = buildReadmeContent();
                            fs.writeFileSync(readmePath, content, 'utf-8');

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, path: readmePath }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        }
                        return;
                    }

                    if (req.url === '/api/rename' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        const { oldName, newName, parentFolder } = body;
                        if (oldName && newName) {
                            const parentPath = parentFolder ? path.join(slidesDir, parentFolder) : slidesDir;
                            const prefixMatch = oldName.match(/^(\d+_)/);
                            const prefix = prefixMatch ? prefixMatch[1] : '';
                            const finalNewName = newName.startsWith(prefix) ? newName : `${prefix}${newName}`;
                            const oldPath = path.join(parentPath, oldName);
                            const newPath = path.join(parentPath, finalNewName);
                            if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true }));
                        }
                        return;
                    }

                    if (req.url === '/api/upload' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.filename && body.content && body.folder) {
                            const folderPath = path.join(slidesDir, body.folder);
                            ensureDir(folderPath);
                            const prefix = getNextPrefix(folderPath);
                            const finalFileName = `${prefix}_${body.filename}`;
                            fs.writeFileSync(path.join(folderPath, finalFileName), body.content, 'utf-8');
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true }));
                        }
                        return;
                    }

                    if (req.url === '/api/delete-folder' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder) {
                            try {
                                const folderPath = path.join(slidesDir, body.folder);
                                if (fs.existsSync(folderPath)) {
                                    fs.rmSync(folderPath, { recursive: true, force: true });
                                }
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        } else {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ success: false, error: 'Missing folder' }));
                        }
                        return;
                    }

                    if (req.url === '/api/delete-file' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder && body.filename) {
                            try {
                                const filePath = path.join(slidesDir, body.folder, body.filename);
                                if (fs.existsSync(filePath)) {
                                    fs.rmSync(filePath, { force: true });
                                }
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        } else {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ success: false, error: 'Missing folder or filename' }));
                        }
                        return;
                    }

                    next();
                });
            }
        }
    ]
});
