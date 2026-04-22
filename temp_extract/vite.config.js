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
        hiddenFiles: []
    };

    if (!fs.existsSync(configPath)) {
        return defaults;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
            showInNav: parsed.showInNav !== false,
            hiddenFiles: Array.isArray(parsed.hiddenFiles) ? parsed.hiddenFiles : []
        };
    } catch {
        return defaults;
    }
}

function writeFolderConfig(folderPath, config) {
    const normalized = {
        showInNav: config.showInNav !== false,
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

function extractCustomNotes(existingReadme) {
    const startMarker = '<!-- CUSTOM_NOTES_START -->';
    const endMarker = '<!-- CUSTOM_NOTES_END -->';
    const startIndex = existingReadme.indexOf(startMarker);
    const endIndex = existingReadme.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        return '- 在这里补充你自己的项目说明、答辩背景或交付备注。';
    }

    return existingReadme
        .slice(startIndex + startMarker.length, endIndex)
        .trim() || '- 在这里补充你自己的项目说明、答辩背景或交付备注。';
}

function buildReadmeContent(rootDir, slidesDir, existingReadme) {
    const manifest = readSlidesManifest(slidesDir);
    const totalSlides = manifest.reduce((sum, folder) => sum + folder.files.length, 0);
    const hasBadgeLogo = Boolean(findAssetSource(rootDir, 'logo-badge.png'));
    const hasTextLogo = Boolean(findAssetSource(rootDir, 'logo-text.png'));
    const customNotes = extractCustomNotes(existingReadme);

    const chapterLines = manifest.length > 0
        ? manifest.map(folder => {
            const titles = folder.files.map(file => file.title).join(' / ') || '暂无页面';
            return `- \`${folder.name}\`：${folder.files.length} 页，包含 ${titles}`;
        }).join('\n')
        : '- 当前还没有章节，请先在 `slides/` 下创建内容。';

    return `# MockPPT

MockPPT 是一个用原生 HTML + Vite 搭建的演示项目管理台。它支持按章节整理 HTML 幻灯片、在浏览器里预览演示内容，并导出为可以直接离线打开的交付包。

## 当前项目概览
- 章节数：${manifest.length}
- 幻灯片总数：${totalSlides}
- 校徽图标：${hasBadgeLogo ? '已配置' : '未配置'}
- 文字图标：${hasTextLogo ? '已配置' : '未配置'}
- 管理台入口：\`index.html\`
- 预览入口：\`ppt.html\`
- 离线导出入口：控制台右上角“导出离线项目到 dist”

## 当前章节
${chapterLines}

## 本地开发
1. 安装依赖：\`npm install\`
2. 启动项目：\`npm run dev\`
3. 打开管理台，创建章节、拖拽导入 HTML、调整顺序
4. 需要演示时，打开 \`ppt.html\` 预览

## 控制台功能
- 创建、重命名、拖拽排序章节
- 将 HTML 文件拖入当前选中的章节
- 打开 \`dist\` 目录
- 清空 \`dist\`
- 根据当前项目结构自动更新根目录 \`README.md\`
- 导出离线项目到 \`dist/<项目名>\`

## 离线导出
- 导出的目录位于 \`dist/<项目名>\`
- 导出结果不再生成 \`.bat\` 启动脚本
- 把整个导出目录发给别人即可
- 对方直接双击目录里的 \`index.html\` 就能打开演示

## 资源文件
- 全局样式：\`style.css\`
- 章节内容：\`slides/\`
- 图标资源：\`public/logo-badge.png\`、\`public/logo-text.png\`
- 离线模板：\`ppt-standalone-template.html\`

## 自定义备注
<!-- CUSTOM_NOTES_START -->
${customNotes}
<!-- CUSTOM_NOTES_END -->

## 说明
- 本 README 可通过管理台中的“更新 README”按钮重新生成
- README 会根据当前章节数量、页面数量和图标配置自动刷新
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
                            const content = buildReadmeContent(rootDir, slidesDir, existingReadme);
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

                    next();
                });
            }
        }
    ]
});
