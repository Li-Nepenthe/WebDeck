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
        .filter(dirent => dirent.isDirectory() && /^\d/.test(dirent.name))
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
    return [
        '# WebDeck 控制台使用指南',
        '',
        '本指南将帮助你快速启动并使用 WebDeck 演示项目管理台。',
        '',
        '## 1. 环境准备 (配置 Node.js)',
        '',
        '在运行本项目之前，需要确保你的电脑已经安装了 Node.js 环境：',
        '1. 访问 Node.js 官网：[https://nodejs.org/](https://nodejs.org/)。',
        '2. 下载并按照提示安装 LTS (长期维护) 版本。',
        '3. 安装过程保持默认选项即可，一直点击"下一步"直到完成。',
        '',
        '## 2. 启动控制台',
        '',
        '无需手动输入复杂的命令行，只需执行以下简便操作：',
        '1. 在当前项目文件夹下找到 `start.bat` 脚本文件。',
        '2. **双击运行 `start.bat`**。',
        '3. 脚本会自动检查环境、安装所需的依赖，并在浏览器中自动为你打开 WebDeck 控制台界面。',
        '',
        '## 3. 控制台功能概览',
        '',
        '成功进入控制台后，你可以使用以下主要功能来高效管理你的演示内容：',
        '',
        '- **章节管理**',
        '  - **创建章节**：在左侧区域点击新增章节（相当于演示的各个部分）。',
        '  - **重命名与排序**：可以随时修改章节名称，并通过拖拽轻松调整章节的前后顺序。',
        '',
        '- **幻灯片内容导入**',
        '  - **拖拽上传**：选中某个章节后，将本地准备好的 HTML 幻灯片文件直接拖入中间的内容区域即可快速导入。',
        '',
        '- **项目预览与放映**',
        '  - **实时预览**：点击预览按钮，可以直接在浏览器中查看当前的演示效果，管理台的修改会实时同步。',
        '',
        '- **离线交付与导出**',
        '  - **一键导出**：点击右上角的"导出离线项目"，系统会将当前所有的幻灯片合并打包到 `dist` 目录下的独立文件夹中。',
        '  - **便于分享**：导出的离线项目已解除了所有环境依赖。你可以直接将该文件夹打包发送给其他人，对方只需双击里面的 `index.html` 就能直接在任意浏览器播放演示，支持完全断网脱机使用。',
        '  - **目录管理**：支持一键打开 `dist` 目录或清空旧的导出结果。',
        '',
        '---',
        '',
        '## 🤖 WebDeck HTML 幻灯片生成提示词',
        '',
        '将以下提示词复制到 AI 助手的「自定义指令」中，AI 就会在你要求生成 HTML 时自动按规范输出。',
        '',
        '### 核心要点',
        '',
        '1. **输出完整 HTML 文档**：必须包含 `<!DOCTYPE html>`、`<html>`、`<head>`、`<body>` 标签。框架会自动检测完整文档并通过 iframe 隔离渲染。',
        '2. **必须包含 `<title>` 标签**：管理台使用 title 内容作为页面显示名称。',
        '3. **不要用 markdown 代码块包裹**：直接输出纯 HTML，前后不加 ``` 符号。',
        '4. **追求演示级视觉品质**：深色背景 + 渐变光效 + 微动画，不要白底黑字的简陋页面。',
        '5. **只在用户要求生成 HTML 时启用**：正常对话不受影响。',
        '',
        '> 完整的提示词模板请参见项目根目录下的 `README.md` 文件。',
    ].join('\n');
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

                                // Copy all non-HTML static assets from slides/ subdirectories
                                // so that relative image/font/video references in slide HTML work in the export.
                                if (fs.existsSync(slidesDir)) {
                                    fs.readdirSync(slidesDir, { withFileTypes: true })
                                        .filter(d => d.isDirectory())
                                        .forEach(folderDirent => {
                                            const srcFolder = path.join(slidesDir, folderDirent.name);
                                            const dstFolder = path.join(projectPath, 'slides', folderDirent.name);
                                            fs.readdirSync(srcFolder, { withFileTypes: true })
                                                .filter(f => f.isFile() && !f.name.endsWith('.html') && f.name !== 'config.json')
                                                .forEach(fileDirent => {
                                                    ensureDir(dstFolder);
                                                    fs.copyFileSync(
                                                        path.join(srcFolder, fileDirent.name),
                                                        path.join(dstFolder, fileDirent.name)
                                                    );
                                                });
                                        });
                                }

                                const template = fs.readFileSync(path.resolve(rootDir, 'ppt-standalone-template.html'), 'utf-8');
                                const presentationData = buildPresentationData(slidesDir);

                                // Download MathJax for offline embedding
                                let mathjaxCode = '';
                                try {
                                    const mjUrl = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
                                    const mjResponse = await fetch(mjUrl);
                                    if (mjResponse.ok) {
                                        mathjaxCode = await mjResponse.text();
                                        console.log(`[export] MathJax downloaded: ${(mathjaxCode.length / 1024).toFixed(0)}KB`);
                                    }
                                } catch (e) {
                                    console.warn('[export] Failed to download MathJax, formulas will need internet:', e.message);
                                }
                                // Store as global for iframe access + inline execution
                                const mathjaxInline = mathjaxCode
                                    ? `window.__MATHJAX_CODE__ = ${JSON.stringify(mathjaxCode)};\n${mathjaxCode}`
                                    : `var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";document.head.appendChild(s);`;

                                const html = template
                                    .replace('__PRESENTATION_DATA__', serializeForInlineScript(presentationData))
                                    .replace('__MATHJAX_INLINE_CODE__', mathjaxInline);

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

                    if (req.url === '/api/import-project' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (!body.html) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ success: false, error: '缺少 HTML 内容' }));
                            return;
                        }

                        try {
                            // Extract presentationData JSON from exported HTML
                            const jsonMatch = body.html.match(/let\s+presentationData\s*=\s*(\{.+\});/);
                            if (!jsonMatch) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ success: false, error: '无法从 HTML 中提取演示数据，请确认这是 WebDeck 导出的文件' }));
                                return;
                            }

                            let importedData;
                            try {
                                importedData = JSON.parse(jsonMatch[1]);
                            } catch (parseErr) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ success: false, error: '解析演示数据失败：' + parseErr.message }));
                                return;
                            }

                            const chapters = importedData.chapters || [];
                            const slides = importedData.slides || [];

                            // Optionally clear existing slides
                            if (body.clearExisting) {
                                if (fs.existsSync(slidesDir)) {
                                    fs.readdirSync(slidesDir, { withFileTypes: true })
                                        .filter(d => d.isDirectory())
                                        .forEach(d => fs.rmSync(path.join(slidesDir, d.name), { recursive: true, force: true }));
                                }
                            }

                            ensureDir(slidesDir);

                            // Recreate chapter directories with config
                            for (const chapter of chapters) {
                                const chapterDir = path.join(slidesDir, chapter.prefix);
                                ensureDir(chapterDir);
                                writeFolderConfig(chapterDir, {
                                    showInNav: chapter.showInNav !== false,
                                    hideNav: chapter.hideNav === true,
                                    hiddenFiles: []
                                });
                            }

                            // Write slide HTML files
                            let importedCount = 0;
                            for (const slide of slides) {
                                const chapterDir = path.join(slidesDir, slide.chapterPrefix);
                                ensureDir(chapterDir);
                                const filename = slide.filename || `${String(importedCount + 1).padStart(2, '0')}_slide.html`;
                                const filePath = path.join(chapterDir, filename);
                                fs.writeFileSync(filePath, slide.html || slide.rawHtml || '', 'utf-8');
                                importedCount++;
                            }

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, chapters: chapters.length, slides: importedCount }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        }
                        return;
                    }

                    if (req.url === '/api/reset-project' && req.method === 'POST') {
                        try {
                            if (fs.existsSync(slidesDir)) {
                                fs.readdirSync(slidesDir, { withFileTypes: true })
                                    .filter(d => d.isDirectory())
                                    .forEach(d => fs.rmSync(path.join(slidesDir, d.name), { recursive: true, force: true }));
                            }
                            ensureDir(slidesDir);

                            const coverDir = path.join(slidesDir, '01_封面');
                            ensureDir(coverDir);
                            fs.writeFileSync(
                                path.join(coverDir, 'config.json'),
                                JSON.stringify({ showInNav: false, hideNav: true, hiddenFiles: [] }, null, 2),
                                'utf-8'
                            );

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
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

                    if (req.url.startsWith('/api/get-file') && req.method === 'GET') {
                        const urlObj = new URL(req.url, 'http://localhost');
                        const folder = urlObj.searchParams.get('folder');
                        const filename = urlObj.searchParams.get('filename');
                        if (folder && filename) {
                            try {
                                const filePath = path.resolve(path.join(slidesDir, folder, filename));
                                // Safety: ensure resolved path is within slidesDir
                                if (!filePath.startsWith(path.resolve(slidesDir))) {
                                    res.statusCode = 403;
                                    res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
                                    return;
                                }
                                if (!fs.existsSync(filePath)) {
                                    res.statusCode = 404;
                                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                                    return;
                                }
                                const content = fs.readFileSync(filePath, 'utf-8');
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true, content }));
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

                    if (req.url === '/api/save-file' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder && body.filename && body.content !== undefined) {
                            try {
                                const filePath = path.resolve(path.join(slidesDir, body.folder, body.filename));
                                // Safety: ensure resolved path is within slidesDir
                                if (!filePath.startsWith(path.resolve(slidesDir))) {
                                    res.statusCode = 403;
                                    res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
                                    return;
                                }
                                if (!fs.existsSync(filePath)) {
                                    res.statusCode = 404;
                                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                                    return;
                                }
                                fs.writeFileSync(filePath, body.content, 'utf-8');
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        } else {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ success: false, error: 'Missing folder, filename or content' }));
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

                    if (req.url === '/api/upload-image' && req.method === 'POST') {
                        const body = await parseJsonBody(req);
                        if (body.folder && body.filename && body.data) {
                            try {
                                const folderPath = path.resolve(path.join(slidesDir, body.folder));
                                // Safety: ensure resolved path is within slidesDir
                                if (!folderPath.startsWith(path.resolve(slidesDir))) {
                                    res.statusCode = 403;
                                    res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
                                    return;
                                }
                                ensureDir(folderPath);

                                // Sanitize filename: keep only safe characters
                                const safeName = body.filename.replace(/[\\/:*?"<>|]/g, '_');
                                const filePath = path.join(folderPath, safeName);

                                // Decode base64 data and write binary file
                                const buffer = Buffer.from(body.data, 'base64');
                                fs.writeFileSync(filePath, buffer);

                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true, filename: safeName }));
                            } catch (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: error.message }));
                            }
                        } else {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ success: false, error: 'Missing folder, filename or data' }));
                        }
                        return;
                    }

                    if (req.url === '/api/list-images' && req.method === 'GET') {
                        const urlObj = new URL(req.url, 'http://localhost');
                        const folder = urlObj.searchParams.get('folder');
                        if (folder) {
                            try {
                                const folderPath = path.resolve(path.join(slidesDir, folder));
                                if (!folderPath.startsWith(path.resolve(slidesDir))) {
                                    res.statusCode = 403;
                                    res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
                                    return;
                                }
                                const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
                                const images = fs.existsSync(folderPath)
                                    ? fs.readdirSync(folderPath).filter(f => imageExts.includes(path.extname(f).toLowerCase()))
                                    : [];
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true, images }));
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

                    next();
                });
            }
        }
    ]
});
