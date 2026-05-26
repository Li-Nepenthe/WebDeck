const folderListEl = document.getElementById('folderList');
const createFolderBtn = document.getElementById('createFolderBtn');
const newFolderNameInput = document.getElementById('newFolderName');
const dropzone = document.getElementById('dropzone');
const previewIframe = document.getElementById('previewIframe');
const targetFolderDisplay = document.getElementById('targetFolderDisplay');
const toastEl = document.getElementById('toast');
const saveStandaloneBtn = document.getElementById('saveStandaloneBtn');
const importProjectBtn = document.getElementById('importProjectBtn');
const clearDistBtn = document.getElementById('clearDistBtn');
const resetProjectBtn = document.getElementById('resetProjectBtn');
const openDistBtn = document.getElementById('openDistBtn');
const openReadmeBtn = document.getElementById('openReadmeBtn');
const readmeModal = document.getElementById('readmeModal');
const closeReadmeBtn = document.getElementById('closeReadmeBtn');
const readmeBody = document.getElementById('readmeBody');

const addPageModal = document.getElementById('addPageModal');
const closeAddPageBtn = document.getElementById('closeAddPageBtn');
const cancelAddPageBtn = document.getElementById('cancelAddPageBtn');
const confirmAddPageBtn = document.getElementById('confirmAddPageBtn');
const addPageName = document.getElementById('addPageName');
const addPageFolderSpan = document.getElementById('addPageFolderSpan');

const customPromptModal = document.getElementById('customPromptModal');
const customPromptTitle = document.getElementById('customPromptTitle');
const customPromptInput = document.getElementById('customPromptInput');
const customPromptCancelBtn = document.getElementById('customPromptCancelBtn');
const customPromptConfirmBtn = document.getElementById('customPromptConfirmBtn');

const customConfirmModal = document.getElementById('customConfirmModal');
const customConfirmTitle = document.getElementById('customConfirmTitle');
const customConfirmMessage = document.getElementById('customConfirmMessage');
const customConfirmCancelBtn = document.getElementById('customConfirmCancelBtn');
const customConfirmConfirmBtn = document.getElementById('customConfirmConfirmBtn');

const editPageModal = document.getElementById('editPageModal');
const editPageTitleSpan = document.getElementById('editPageTitleSpan');
const closeEditPageBtn = document.getElementById('closeEditPageBtn');
const cancelEditPageBtn = document.getElementById('cancelEditPageBtn');
const confirmEditPageBtn = document.getElementById('confirmEditPageBtn');

let currentEditFolder = null;
let currentEditFilename = null;

let currentActiveFolder = null;
let currentAddPageFolder = null;
const IFRAME_RENDER_HINT_REGEX = /<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]|<link[\s>]|<meta[\s>]|<base[\s>]|<title[\s>]/i;
const INLINE_HANDLER_HINT_REGEX = /\son[a-z][\w:-]*\s*=/i;
const JAVASCRIPT_URL_HINT_REGEX = /\b(?:href|src|xlink:href)\s*=\s*["']?\s*javascript:/i;
const REBASED_URL_ATTRIBUTES = ['src', 'href', 'poster', 'data', 'action', 'formaction', 'xlink:href'];
const REBASED_SRCSET_ATTRIBUTES = ['srcset', 'imagesrcset'];
const FULL_DOC_OVERRIDE_CSS = `
    html, body { width: 100% !important; height: 100% !important; min-height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important; }
    body { display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; }
    .slide-container { width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; transform: none !important; }
    canvas, iframe, video, img { display: block !important; }
    * { box-sizing: border-box !important; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-thumb { background: rgba(0, 94, 170, 0.2); border-radius: 4px; }
`;
let previewGlobalCssPromise = null;

function shouldRenderInIframe(rawHtml, explicit = false) {
    const html = rawHtml || '';
    return explicit === true
        || IFRAME_RENDER_HINT_REGEX.test(html)
        || INLINE_HANDLER_HINT_REGEX.test(html)
        || JAVASCRIPT_URL_HINT_REGEX.test(html);
}

function createSlideBaseUrl(folderName) {
    return new URL(`slides/${encodeURIComponent(folderName)}/`, window.location.href);
}

function rebaseAssetUrl(urlValue, baseHref) {
    const trimmed = (urlValue || '').trim();
    if (!trimmed || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(trimmed)) {
        return urlValue;
    }

    try {
        return new URL(trimmed, baseHref).toString();
    } catch {
        return urlValue;
    }
}

function buildIframeSrcdoc(rawHtml, { baseHref, overrideCssText }) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml || '', 'text/html');
    const head = doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement.insertBefore(doc.createElement('head'), doc.body || null);

    if (!doc.documentElement.getAttribute('lang')) {
        doc.documentElement.setAttribute('lang', 'zh-CN');
    }

    let baseElement = head.querySelector('base');
    if (!baseElement) {
        baseElement = doc.createElement('base');
        head.prepend(baseElement);
    }
    baseElement.setAttribute('href', baseHref);

    const overrideStyle = doc.createElement('style');
    overrideStyle.setAttribute('data-webdeck-injected', 'true');
    overrideStyle.textContent = overrideCssText;
    head.appendChild(overrideStyle);

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

function loadPreviewGlobalCss() {
    if (!previewGlobalCssPromise) {
        previewGlobalCssPromise = fetch('/api/presentation-data')
            .then(res => res.json())
            .then(data => data.globalCss || '')
            .catch(() => '');
    }

    return previewGlobalCssPromise;
}

function serializeForInlineScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildFragmentPreviewSrcdoc(rawHtml, folderName, globalCssText) {
    const payload = serializeForInlineScript({
        rawHtml,
        baseHref: createSlideBaseUrl(folderName).toString(),
        globalCssText: globalCssText || '',
        rebasedUrlAttributes: REBASED_URL_ATTRIBUTES,
        rebasedSrcsetAttributes: REBASED_SRCSET_ATTRIBUTES
    });

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
    <style>
        body, html { width: 100%; height: 100%; overflow: auto; background: transparent; margin: 0; padding: 0; }
        body::before { display: none; }
        .slide { position: relative !important; transform: none !important; opacity: 1 !important; pointer-events: auto !important; padding: 30px !important; display: flex; justify-content: center; align-items: flex-start; height: auto !important; min-height: 100vh; box-sizing: border-box; }
        .slide-content { flex: 1; width: 100%; display: flex; flex-direction: column; }
    </style>
</head>
<body>
    <div class="slide active">
        <div class="slide-content" id="slide-content">
            <div id="shadowHost" style="width:100%; height:100%; display:flex; flex-direction:column; flex:1;"></div>
        </div>
    </div>
    <script>
        (async () => {
            const payload = ${payload};

            function rebaseAssetUrl(urlValue, baseHref) {
                const trimmed = (urlValue || "").trim();
                if (!trimmed || /^(?:[a-z][a-z0-9+.-]*:|\\/\\/|#|\\/)/i.test(trimmed)) {
                    return urlValue;
                }

                try {
                    return new URL(trimmed, baseHref).toString();
                } catch {
                    return urlValue;
                }
            }

            function rewriteCssUrls(cssText, baseHref) {
                return (cssText || "").replace(/url\\(\\s*(['"]?)([^'"()]+)\\1\\s*\\)/gi, (match, quote, assetPath) => {
                    const rebasedUrl = rebaseAssetUrl(assetPath, baseHref);
                    return rebasedUrl === assetPath ? match : 'url("' + rebasedUrl + '")';
                });
            }

            function rebaseSrcsetValue(srcsetValue, baseHref) {
                return (srcsetValue || "").split(",").map(candidate => {
                    const trimmedCandidate = candidate.trim();
                    if (!trimmedCandidate) {
                        return trimmedCandidate;
                    }

                    const parts = trimmedCandidate.split(/\\s+/);
                    const assetPath = parts.shift();
                    const descriptor = parts.join(" ");
                    const rebasedUrl = rebaseAssetUrl(assetPath, baseHref);
                    return descriptor ? rebasedUrl + " " + descriptor : rebasedUrl;
                }).join(", ");
            }

            function rebaseFragmentAssetUrls(fragmentRoot, baseHref) {
                fragmentRoot.querySelectorAll("*").forEach(node => {
                    payload.rebasedUrlAttributes.forEach(attributeName => {
                        if (!node.hasAttribute(attributeName)) {
                            return;
                        }

                        const originalValue = node.getAttribute(attributeName);
                        const rebasedValue = rebaseAssetUrl(originalValue, baseHref);
                        if (rebasedValue !== originalValue) {
                            node.setAttribute(attributeName, rebasedValue);
                        }
                    });

                    payload.rebasedSrcsetAttributes.forEach(attributeName => {
                        if (!node.hasAttribute(attributeName)) {
                            return;
                        }

                        const originalValue = node.getAttribute(attributeName);
                        const rebasedValue = rebaseSrcsetValue(originalValue, baseHref);
                        if (rebasedValue !== originalValue) {
                            node.setAttribute(attributeName, rebasedValue);
                        }
                    });

                    if (node.hasAttribute("style")) {
                        node.setAttribute("style", rewriteCssUrls(node.getAttribute("style"), baseHref));
                    }
                });

                fragmentRoot.querySelectorAll("style").forEach(styleNode => {
                    styleNode.textContent = rewriteCssUrls(styleNode.textContent, baseHref);
                });
            }

            const host = document.getElementById("shadowHost");
            const shadow = host.attachShadow({ mode: "open" });

            // Inject global CSS as a <style> tag (most reliable in iframe context)
            if (payload.globalCssText) {
                const style = document.createElement("style");
                style.textContent = payload.globalCssText;
                shadow.appendChild(style);
            }

            const template = document.createElement("template");
            template.innerHTML = payload.rawHtml || "";
            rebaseFragmentAssetUrls(template.content, payload.baseHref);

            // Wrap content in .slide > .slide-content so CSS selectors like
            // .slide h1, .slide p, .slide li from style.css can match
            const slideWrapper = document.createElement("div");
            slideWrapper.className = "slide active";
            slideWrapper.style.cssText = "position:relative; transform:none; opacity:1; pointer-events:auto; top:auto; height:auto; min-height:100%;";
            const contentWrapper = document.createElement("div");
            contentWrapper.className = "slide-content";
            contentWrapper.style.cssText = "display:flex; flex-direction:column; width:100%; height:100%; flex:1;";
            contentWrapper.appendChild(template.content);
            slideWrapper.appendChild(contentWrapper);
            shadow.appendChild(slideWrapper);

            let mathJaxChecks = 0;
            const maxMathJaxChecks = 100;
            const checkMathJax = setInterval(() => {
                mathJaxChecks += 1;
                if (window.MathJax && window.MathJax.typesetPromise) {
                    clearInterval(checkMathJax);
                    window.MathJax.typesetPromise([shadow]).then(async () => {
                        const mjxStyle = document.getElementById("MJX-CHTML-styles");
                        if (mjxStyle) {
                            const ms = document.createElement("style");
                            ms.textContent = mjxStyle.textContent;
                            shadow.appendChild(ms);
                        }
                    }).catch(err => console.error("MathJax preview typeset failed:", err));
                } else if (mathJaxChecks >= maxMathJaxChecks) {
                    clearInterval(checkMathJax);
                    console.warn("MathJax preview load timeout");
                }
            }, 100);
        })();
    </script>
</body>
</html>`;
}

// 全局阻止浏览器默认的拖拽行为，防止不小心把文件拖到外面导致浏览器新开标签页跳转
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

function showCustomPrompt(title, defaultValue = '') {
    return new Promise((resolve) => {
        customPromptTitle.textContent = title;
        customPromptInput.value = defaultValue;
        customPromptModal.classList.add('show');
        customPromptModal.setAttribute('aria-hidden', 'false');
        customPromptInput.focus();
        customPromptInput.select();

        const cleanup = () => {
            customPromptModal.classList.remove('show');
            customPromptModal.setAttribute('aria-hidden', 'true');
            customPromptConfirmBtn.removeEventListener('click', onConfirm);
            customPromptCancelBtn.removeEventListener('click', onCancel);
            customPromptInput.removeEventListener('keydown', onKeydown);
        };

        const onConfirm = () => {
            cleanup();
            resolve(customPromptInput.value.trim() || null);
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        const onKeydown = (e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        };

        customPromptConfirmBtn.addEventListener('click', onConfirm);
        customPromptCancelBtn.addEventListener('click', onCancel);
        customPromptInput.addEventListener('keydown', onKeydown);
    });
}

function showCustomConfirm(title, message, isDanger = true) {
    return new Promise((resolve) => {
        customConfirmTitle.textContent = title;
        customConfirmMessage.textContent = message;
        customConfirmModal.classList.add('show');
        customConfirmModal.setAttribute('aria-hidden', 'false');
        
        if(isDanger) {
            customConfirmConfirmBtn.style.background = '#ef4444';
            customConfirmConfirmBtn.style.borderColor = '#ef4444';
            customConfirmConfirmBtn.textContent = '确认彻底删除';
        } else {
            customConfirmConfirmBtn.style.background = 'var(--accent-color)';
            customConfirmConfirmBtn.style.borderColor = 'var(--accent-color)';
            customConfirmConfirmBtn.textContent = '确认执行';
        }

        const cleanup = () => {
            customConfirmModal.classList.remove('show');
            customConfirmModal.setAttribute('aria-hidden', 'true');
            customConfirmConfirmBtn.removeEventListener('click', onConfirm);
            customConfirmCancelBtn.removeEventListener('click', onCancel);
        };

        const onConfirm = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        customConfirmConfirmBtn.addEventListener('click', onConfirm);
        customConfirmCancelBtn.addEventListener('click', onCancel);
    });
}

function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

async function postJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return res.json();
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return html;
}

function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let listItems = [];
    let listType = null;
    let inCodeBlock = false;
    let codeLines = [];

    function flushParagraph() {
        if (!paragraph.length) return;
        html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
        paragraph = [];
    }

    function flushList() {
        if (!listItems.length) return;
        const tag = listType === 'ol' ? 'ol' : 'ul';
        html.push(`<${tag}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
        listItems = [];
        listType = null;
    }

    function flushCodeBlock() {
        if (!inCodeBlock) return;
        const rawCode = codeLines.join('\n');
        const encodedCode = encodeURIComponent(rawCode).replace(/'/g, "%27");
        const copyBtn = `<button class="copy-code-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedCode}')).then(() => { const old = this.innerText; this.innerText = '✅ 已复制!'; setTimeout(() => this.innerText = old, 2000); })" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s; backdrop-filter: blur(4px);" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">📋 一键复制</button>`;
        html.push(`<div style="position: relative; margin: 1em 0;">${copyBtn}<pre style="margin: 0;"><code>${escapeHtml(rawCode)}</code></pre></div>`);
        inCodeBlock = false;
        codeLines = [];
    }

    for (const line of lines) {
        if (line.startsWith('```')) {
            flushParagraph();
            flushList();
            if (inCodeBlock) flushCodeBlock();
            else inCodeBlock = true;
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        if (/^---+$/.test(trimmed)) {
            flushParagraph();
            flushList();
            html.push('<hr>');
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
            continue;
        }

        const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            flushParagraph();
            if (listType && listType !== 'ol') flushList();
            listType = 'ol';
            listItems.push(orderedMatch[1]);
            continue;
        }

        const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (unorderedMatch) {
            flushParagraph();
            if (listType && listType !== 'ul') flushList();
            listType = 'ul';
            listItems.push(unorderedMatch[1]);
            continue;
        }

        flushList();
        paragraph.push(trimmed);
    }

    flushParagraph();
    flushList();
    flushCodeBlock();
    return html.join('\n');
}

function openReadmeModal(html) {
    readmeBody.innerHTML = html;
    readmeModal.classList.add('show');
    readmeModal.setAttribute('aria-hidden', 'false');
}

function closeReadmeModal() {
    readmeModal.classList.remove('show');
    readmeModal.setAttribute('aria-hidden', 'true');
}

function setActiveFolder(card, folderName) {
    document.querySelectorAll('.folder-card').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.sub-item').forEach(item => item.classList.remove('active'));
    card.classList.add('active');
    currentActiveFolder = folderName;
    targetFolderDisplay.textContent = `当前选中：${folderName}`;
    dropzone.classList.remove('disabled');
    dropzone.style.display = 'flex';
    if (previewIframe) previewIframe.style.display = 'none';
}

function buildFolderActions(folder) {
    return `
        <div class="item-actions">
            <button class="add-page-btn rename-folder-btn" type="button" title="重命名章节" style="padding:4px 8px;">✏️</button>
            <button class="add-page-btn" type="button" title="新建页面">➕</button>
            <button class="import-image-btn" type="button" title="导入图片到当前章节（可拖拽图片到此按钮）">📷 导入图片</button>
            <button class="visibility-toggle ${folder.hideNav ? 'is-off' : 'is-on'} slide-nav-mode-btn" type="button" title="隐藏后：该章不在导航栏中显示，且播放时隐藏顶部导航栏">
                ${folder.hideNav ? '已隐藏' : '导航可见'}
            </button>
            <button class="delete-btn" type="button">删除</button>
        </div>
    `;
}

function buildFileActions(file) {
    return `
        <div class="item-actions">
            <button class="edit-file-btn" type="button" title="编辑 HTML 代码" style="padding:4px 8px;">&#9998; 编辑</button>
            <button class="add-page-btn rename-file-btn" type="button" title="重命名页面" style="padding:4px 8px;">✏️</button>
            <button class="visibility-toggle ${file.visible ? 'is-on' : 'is-off'}" type="button">
                ${file.visible ? '页面显示' : '页面隐藏'}
            </button>
            <button class="delete-btn" type="button">删除</button>
        </div>
    `;
}

async function loadFolders() {
    try {
        const res = await fetch('/api/list');
        const data = await res.json();
        folderListEl.innerHTML = '';

        data.folders.forEach(folder => {
            const card = document.createElement('div');
            card.className = 'folder-card' + (folder.name === currentActiveFolder ? ' active' : '');
            card.dataset.name = folder.name;

            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `
                <div class="folder-name">${folder.name}</div>
                ${buildFolderActions(folder)}
            `;

            header.querySelector('.rename-folder-btn').onclick = async event => {
                event.stopPropagation();
                const newName = await showCustomPrompt('重命名章节', folder.name);
                if (newName) renameItem(folder.name, newName);
            };

            header.querySelector('.add-page-btn[title="新建页面"]').onclick = event => {
                event.stopPropagation();
                currentAddPageFolder = folder.name;
                addPageFolderSpan.textContent = folder.name;
                addPageName.value = '';
                if (window.htmlEditor) {
                    window.htmlEditor.setValue('');
                }
                addPageModal.classList.add('show');
                addPageModal.setAttribute('aria-hidden', 'false');
            };

            header.querySelector('.slide-nav-mode-btn').onclick = async event => {
                event.stopPropagation();
                const newHideNav = !folder.hideNav;
                const result = await postJson('/api/toggle-folder-hidenav', {
                    folder: folder.name,
                    hideNav: newHideNav
                });

                if (result.success) {
                    const title = folder.title || folder.name;
                    showToast(newHideNav ? `已隐藏「${title}」：导航栏不显示此章，播放时无顶栏` : `已恢复「${title}」：导航栏显示此章，播放时保留顶栏`);
                    loadFolders();
                } else {
                    showToast(`切换显示模式失败：${result.error || '未知错误'}`, true);
                }
            };

            header.querySelector('.delete-btn').onclick = event => {
                event.stopPropagation();
                deleteFolder(folder.name, folder.title || folder.name);
            };

            // --- 导入图片按钮 ---
            const importImageBtn = header.querySelector('.import-image-btn');
            if (importImageBtn) {
                // 点击打开文件选择器
                importImageBtn.onclick = event => {
                    event.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = () => {
                        if (input.files.length > 0) {
                            handleImageFiles(input.files, folder.name);
                        }
                    };
                    input.click();
                };

                // 拖拽图片到按钮
                importImageBtn.addEventListener('dragover', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    importImageBtn.classList.add('drag-hover');
                });

                importImageBtn.addEventListener('dragleave', event => {
                    event.stopPropagation();
                    importImageBtn.classList.remove('drag-hover');
                });

                importImageBtn.addEventListener('drop', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    importImageBtn.classList.remove('drag-hover');
                    const files = event.dataTransfer.files;
                    if (files.length > 0) {
                        // Filter image files only
                        const imageFiles = [...files].filter(f => f.type.startsWith('image/'));
                        if (imageFiles.length > 0) {
                            handleImageFiles(imageFiles, folder.name);
                        } else {
                            showToast('请拖入图片文件（PNG/JPG/GIF/SVG/WebP）', true);
                        }
                    }
                });
            }

            card.appendChild(header);

            if (folder.files?.length) {
                const subs = document.createElement('div');
                subs.className = 'sub-items';

                folder.files.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'sub-item';
                    item.draggable = true;
                    item.dataset.filename = file.filename;
                    item.innerHTML = `
                        <span class="sub-item-label">${(file.title || file.filename).replace(/\.html$/i, '')}</span>
                        ${buildFileActions(file)}
                    `;

                    item.onclick = event => {
                        if (event.target.closest('.item-actions')) return;
                        event.stopPropagation();
                        document.querySelectorAll('.folder-card').forEach(c => c.classList.remove('active'));
                        document.querySelectorAll('.sub-item').forEach(c => c.classList.remove('active'));
                        item.classList.add('active');
                        
                        currentActiveFolder = folder.name;
                        targetFolderDisplay.textContent = `预览页面：${folder.name} / ${file.filename}`;
                        
                        dropzone.style.display = 'none';
                        if (previewIframe) {
                            previewIframe.style.display = 'block';
                            previewIframe.removeAttribute('sandbox');
                            Promise.all([
                                fetch(`slides/${encodeURIComponent(folder.name)}/${encodeURIComponent(file.filename)}`).then(res => {
                                    if (!res.ok) {
                                        throw new Error(`HTTP ${res.status}`);
                                    }
                                    return res.text();
                                }),
                                loadPreviewGlobalCss()
                            ])
                                .then(([html, globalCssText]) => {
                                    const isFullBleed = shouldRenderInIframe(html, file.isFullBleed);
                                    const baseHref = createSlideBaseUrl(folder.name).toString();
                                    
                                    previewIframe.onload = () => {
                                        try {
                                            previewIframe.contentWindow.addEventListener('click', () => {
                                                window.focus();
                                            });
                                        } catch (e) {}
                                    };

                                    if (isFullBleed) {
                                        previewIframe.srcdoc = buildIframeSrcdoc(html, {
                                            baseHref,
                                            overrideCssText: FULL_DOC_OVERRIDE_CSS
                                        });
                                    } else {
                                        previewIframe.srcdoc = buildFragmentPreviewSrcdoc(html, folder.name, globalCssText);
                                    }
                                })
                                .catch(err => {
                                    console.error('Failed to load preview:', err);
                                    previewIframe.srcdoc = `<div style="padding:20px; color:red;">预览加载失败</div>`;
                                });
                        }
                    };

                    item.querySelector('.edit-file-btn').onclick = async event => {
                        event.stopPropagation();
                        openEditPageModal(folder.name, file.filename, file.title || file.filename);
                    };

                    item.querySelector('.rename-file-btn').onclick = async event => {
                        event.stopPropagation();
                        // 去掉可能带来的.html后缀作为默认提醒
                        const cleanName = file.filename.replace(/\.html$/i, '');
                        let newName = await showCustomPrompt('重命名页面文件', cleanName);
                        if (newName) {
                            if (!newName.toLowerCase().endsWith('.html')) {
                                newName += '.html';
                            }
                            renameItem(file.filename, newName, folder.name);
                        }
                    };

                    item.querySelector('.visibility-toggle').onclick = async event => {
                        event.stopPropagation();
                        const result = await postJson('/api/toggle-file-visibility', {
                            folder: folder.name,
                            filename: file.filename,
                            visible: !file.visible
                        });

                        if (result.success) {
                            showToast(!file.visible ? `已显示页面：${file.title || file.filename}` : `已隐藏页面：${file.title || file.filename}`);
                            loadFolders();
                        } else {
                            showToast(`切换页面显示失败：${result.error || '未知错误'}`, true);
                        }
                    };

                    item.querySelector('.delete-btn').onclick = event => {
                        event.stopPropagation();
                        deleteFile(folder.name, file.filename, file.title || file.filename);
                    };

                    item.addEventListener('dragstart', event => {
                        event.stopPropagation();
                        item.classList.add('dragging-file');
                    });

                    item.addEventListener('dragend', event => {
                        event.stopPropagation();
                        item.classList.remove('dragging-file');
                        saveNewOrder(folder.name);
                    });

                    subs.appendChild(item);
                });

                subs.addEventListener('dragover', event => {
                    const dragging = document.querySelector('.dragging-file');
                    if (!dragging || !subs.contains(dragging)) return;
                    event.preventDefault();
                    const siblings = [...subs.querySelectorAll('.sub-item:not(.dragging-file)')];
                    const next = siblings.find(item => event.clientY <= item.getBoundingClientRect().top + item.offsetHeight / 2);
                    subs.insertBefore(dragging, next);
                });

                card.appendChild(subs);
            }

            card.draggable = true;
            card.addEventListener('dragstart', event => {
                if (!event.target.classList.contains('sub-item') && !event.target.closest('.item-actions')) {
                    card.classList.add('dragging');
                }
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                saveNewOrder();
            });

            card.addEventListener('click', () => setActiveFolder(card, folder.name));
            folderListEl.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        showToast('加载章节失败', true);
    }
}

async function renameItem(oldName, newName, parentFolder = null) {
    await postJson('/api/rename', { oldName, newName, parentFolder });
    loadFolders();
}

async function deleteFolder(folderName, folderTitle) {
    const confirmed = await showCustomConfirm('确认删除大章节', `确定删除由 [${folderTitle}] 统领的整个章节吗？\n\n该操作会剥离连带删除下方所有的展示页面和配置，落子无悔。`);
    if (!confirmed) return;

    const result = await postJson('/api/delete-folder', { folder: folderName });
    if (result.success) {
        if (currentActiveFolder === folderName) {
            currentActiveFolder = null;
            targetFolderDisplay.textContent = '请先在左侧选择一个章节';
            dropzone.classList.add('disabled');
        }
        showToast(`已删除章节：${folderTitle}`);
        const card = [...folderListEl.querySelectorAll('.folder-card')].find(item => item.dataset.name === folderName);
        if (card) card.remove();
        await saveNewOrder();
    } else {
        showToast(`删除章节失败：${result.error || '未知错误'}`, true);
    }
}

async function deleteFile(folderName, filename, fileTitle) {
    const confirmed = await showCustomConfirm('确认删除幻灯片', `确定彻底移除分支小页 “${fileTitle}” 吗？\n\n该 HTML 文件将被从本地强行剔除，不可恢复。`);
    if (!confirmed) return;

    const result = await postJson('/api/delete-file', { folder: folderName, filename });
    if (result.success) {
        showToast(`已删除页面：${fileTitle}`);
        const card = [...folderListEl.querySelectorAll('.folder-card')].find(item => item.dataset.name === folderName);
        if (card) {
            const subItem = [...card.querySelectorAll('.sub-item')].find(item => item.dataset.filename === filename);
            if (subItem) subItem.remove();
        }
        await saveNewOrder(folderName);
    } else {
        showToast(`删除页面失败：${result.error || '未知错误'}`, true);
    }
}

async function saveNewOrder(parent = null) {
    let items = [];

    if (parent) {
        const card = [...folderListEl.querySelectorAll('.folder-card')].find(item => item.dataset.name === parent);
        items = [...card.querySelectorAll('.sub-item')].map(item => item.dataset.filename);
    } else {
        items = [...folderListEl.querySelectorAll('.folder-card')].map(item => item.dataset.name);
    }

    await postJson('/api/reorder', { items, parent });
    loadFolders();
}

saveStandaloneBtn.addEventListener('click', async () => {
    const projectName = await showCustomPrompt('命名您的离线工程 (交付包名称)', 'WebDeck_Export');
    if (!projectName) return;

    showToast('正在导出离线项目...');

    try {
        const res = await fetch('/api/export-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`导出成功：dist/${projectName}/index.html`);
        } else {
            showToast(`导出失败：${data.error}`, true);
        }
    } catch {
        showToast('导出失败，请检查本地服务', true);
    }
});

importProjectBtn.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';

    input.onchange = async () => {
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        showToast('正在读取文件...');
        const htmlContent = await file.text();

        // Basic validation
        if (!htmlContent.includes('presentationData')) {
            showToast('此文件不是 WebDeck 导出的 HTML 文件', true);
            return;
        }

        // Ask about clear mode
        const clearExisting = await showCustomConfirm(
            '选择导入模式',
            `即将从「${file.name}」导入项目。\n\n选择「确认执行」→ 清空现有章节后导入（适合恢复/替换整个项目）\n选择「取消」→ 保留现有章节，追加导入内容`,
            false
        );

        showToast('正在导入项目...');

        try {
            const res = await fetch('/api/import-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: htmlContent, clearExisting })
            });
            const data = await res.json();

            if (data.success) {
                showToast(`✅ 导入成功！已恢复 ${data.chapters} 个章节、${data.slides} 个页面`);
                currentActiveFolder = null;
                targetFolderDisplay.textContent = '请先在左侧选择一个章节';
                dropzone.classList.add('disabled');
                if (previewIframe) previewIframe.style.display = 'none';
                dropzone.style.display = 'flex';
                loadFolders();
            } else {
                showToast(`导入失败：${data.error}`, true);
            }
        } catch {
            showToast('导入失败，请检查本地服务', true);
        }
    };

    input.click();
});

clearDistBtn.addEventListener('click', async () => {
    if (!await showCustomConfirm('清理产物垃圾夹', '确定要将以往堆积的旧导出包全部撕碎清空吗？\n(这将会抹除 dist 里的所有工程)')) return;

    const res = await fetch('/api/clear-dist', { method: 'POST' });
    if ((await res.json()).success) {
        showToast('dist 已清理');
    }
});

resetProjectBtn.addEventListener('click', async () => {
    if (!await showCustomConfirm('重置项目', '确定要清空所有幻灯片内容吗？\n\n这将删除 slides 文件夹下的所有章节、页面和资源文件，仅保留一个空的「封面」章节。\n\n⚠️ 此操作不可逆，请确认。')) return;

    try {
        const res = await fetch('/api/reset-project', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('项目已重置，仅保留封面章节');
            currentActiveFolder = null;
            targetFolderDisplay.textContent = '请先在左侧选择一个章节';
            dropzone.classList.add('disabled');
            if (previewIframe) previewIframe.style.display = 'none';
            dropzone.style.display = 'flex';
            loadFolders();
        } else {
            showToast(`重置失败：${data.error || '未知错误'}`, true);
        }
    } catch {
        showToast('重置失败，请检查服务', true);
    }
});

openDistBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/open-dist', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('已打开 dist 文件夹');
        } else {
            showToast(`打开 dist 失败：${data.error || '未知错误'}`, true);
        }
    } catch {
        showToast('打开 dist 失败', true);
    }
});

const shutdownBtn = document.getElementById('shutdownBtn');
if (shutdownBtn) {
    shutdownBtn.addEventListener('click', async () => {
        const confirmed = await showCustomConfirm('关闭控制台', '确定要彻底退出 WebDeck 背景服务吗？\n\n关闭后你需要重新双击 start.bat 才能再次进入。', true);
        if (confirmed) {
            try {
                await fetch('/api/shutdown', { method: 'POST' });
                document.body.innerHTML = `
                    <div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;">
                        <h1 style="color:#10b981; font-size: 2.5rem; margin-bottom: 20px;">✅ 控制台服务已安全关闭</h1>
                        <p style="color:#64748b; font-size: 1.2rem;">您可以直接关闭此浏览器标签页了。</p>
                    </div>
                `;
            } catch {
                showToast('关闭请求发送失败', true);
            }
        }
    });
}

openReadmeBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/readme');
        const data = await res.json();
        if (data.success) {
            openReadmeModal(markdownToHtml(data.content || ''));
        } else {
            showToast(`读取 README 失败：${data.error || '未知错误'}`, true);
        }
    } catch {
        showToast('读取 README 失败', true);
    }
});

closeReadmeBtn.addEventListener('click', closeReadmeModal);

readmeModal.addEventListener('click', event => {
    if (event.target === readmeModal) {
        closeReadmeModal();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && readmeModal.classList.contains('show')) {
        closeReadmeModal();
    }
});

createFolderBtn.onclick = async () => {
    const name = newFolderNameInput.value.trim();
    if (!name) return;

    await postJson('/api/create', { name });
    newFolderNameInput.value = '';
    loadFolders();
};

dropzone.ondragover = event => {
    if (!currentActiveFolder) return;
    event.preventDefault();
    dropzone.classList.add('dragover');
};

dropzone.ondragleave = () => dropzone.classList.remove('dragover');

dropzone.ondrop = async event => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    if (!currentActiveFolder) return;

    for (const file of event.dataTransfer.files) {
        if (!file.name.endsWith('.html')) continue;
        const content = await file.text();
        await postJson('/api/upload', {
            filename: file.name,
            content,
            folder: currentActiveFolder
        });
    }

    loadFolders();
};

if (!folderListEl.dataset.dragBound) {
    folderListEl.addEventListener('dragover', event => {
        const dragging = document.querySelector('.folder-card.dragging');
        if (!dragging) return;
        event.preventDefault();
        const siblings = [...folderListEl.querySelectorAll('.folder-card:not(.dragging)')];
        const next = siblings.find(item => event.clientY <= item.getBoundingClientRect().top + item.offsetHeight / 2);
        folderListEl.insertBefore(dragging, next);
    });
    folderListEl.dataset.dragBound = '1';
}

function closeAddPageModal() {
    addPageModal.classList.remove('show');
    addPageModal.setAttribute('aria-hidden', 'true');
    currentAddPageFolder = null;
}

closeAddPageBtn.addEventListener('click', closeAddPageModal);
cancelAddPageBtn.addEventListener('click', closeAddPageModal);

confirmAddPageBtn.addEventListener('click', async () => {
    if (!currentAddPageFolder) return;
    
    const content = window.htmlEditor ? window.htmlEditor.getValue() : '';
    let filename = addPageName.value.trim();
    
    if (!filename) {
        // 自动从粘贴的 HTML 中提取 <title> 标签作为默认页面名称
        const titleMatch = content.match(/<title>(.*?)<\/title>/i);
        let extractedTitle = titleMatch ? titleMatch[1].trim() : '';
        // 清理操作系统文件名中不合规的字符
        extractedTitle = extractedTitle.replace(/[\\\/:\*\?"<>\|]/g, '_').trim();
        if (extractedTitle.length > 50) {
            extractedTitle = extractedTitle.substring(0, 50).trim();
        }
        
        if (extractedTitle) {
            filename = extractedTitle;
        } else {
            showToast('未输入页面名称且未在 HTML 中检测到 <title> 标签，请手动输入名称', true);
            return;
        }
    }
    
    if (!filename.toLowerCase().endsWith('.html')) {
        filename += '.html';
    }

    const result = await postJson('/api/upload', {
        filename,
        content,
        folder: currentAddPageFolder
    });

    if (result.success) {
        showToast(`已新建页面：${filename}`);
        closeAddPageModal();
        loadFolders();
    } else {
        showToast(`新建页面失败：${result.error || '未知错误'}`, true);
    }
});

addPageModal.addEventListener('click', event => {
    if (event.target === addPageModal) {
        closeAddPageModal();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && addPageModal.classList.contains('show')) {
        closeAddPageModal();
    }
});

// --- 图片导入逻辑 ---
async function handleImageFiles(files, folderName) {
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            showToast(`跳过非图片文件：${file.name}`, true);
            continue;
        }

        // 提取原文件名（不带扩展名）和扩展名
        const lastDot = file.name.lastIndexOf('.');
        const originalBaseName = lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
        const extension = lastDot > 0 ? file.name.substring(lastDot) : '';

        // 弹出重命名对话框
        const newBaseName = await showCustomPrompt(
            `为图片命名 (将保存到 ${folderName})`,
            originalBaseName
        );

        if (!newBaseName) continue; // 用户取消

        const finalFilename = newBaseName + extension;

        // 读取文件为 base64
        const base64 = await fileToBase64(file);

        try {
            const result = await postJson('/api/upload-image', {
                folder: folderName,
                filename: finalFilename,
                data: base64
            });

            if (result.success) {
                showToast(`✅ 图片已保存：${result.filename} → ${folderName}/`);
            } else {
                showToast(`图片保存失败：${result.error || '未知错误'}`, true);
            }
        } catch {
            showToast('图片上传失败，请检查服务', true);
        }
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // reader.result is like "data:image/png;base64,XXXXX"
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

loadFolders();

// --- 编辑 HTML 弹窗逻辑 ---
async function openEditPageModal(folderName, filename, displayName) {
    currentEditFolder = folderName;
    currentEditFilename = filename;
    editPageTitleSpan.textContent = `${folderName} / ${displayName.replace(/\.html$/i, '')}`;

    editPageModal.classList.add('show');
    editPageModal.setAttribute('aria-hidden', 'false');

    // 读取文件内容
    try {
        const res = await fetch(`/api/get-file?folder=${encodeURIComponent(folderName)}&filename=${encodeURIComponent(filename)}`);
        const data = await res.json();
        if (data.success) {
            if (window.editPageEditor) {
                window.editPageEditor.setValue(data.content);
                // 将光标移到文件首行
                window.editPageEditor.setPosition({ lineNumber: 1, column: 1 });
                window.editPageEditor.focus();
            }
        } else {
            showToast(`读取文件失败：${data.error || '未知错误'}`, true);
            closeEditPageModal();
        }
    } catch (err) {
        showToast('读取文件失败', true);
        closeEditPageModal();
    }
}

function closeEditPageModal() {
    editPageModal.classList.remove('show');
    editPageModal.setAttribute('aria-hidden', 'true');
    currentEditFolder = null;
    currentEditFilename = null;
}

closeEditPageBtn.addEventListener('click', closeEditPageModal);
cancelEditPageBtn.addEventListener('click', closeEditPageModal);

confirmEditPageBtn.addEventListener('click', async () => {
    if (!currentEditFolder || !currentEditFilename) return;

    const content = window.editPageEditor ? window.editPageEditor.getValue() : '';

    try {
        const result = await postJson('/api/save-file', {
            folder: currentEditFolder,
            filename: currentEditFilename,
            content
        });

        if (result.success) {
            const savedFilename = currentEditFilename;
            showToast(`已保存：${savedFilename}`);
            closeEditPageModal();
            // 如果该文件正在预览中，刷新预览 iframe
            const activeSubItem = document.querySelector('.sub-item.active');
            if (activeSubItem && activeSubItem.dataset.filename === savedFilename) {
                activeSubItem.click();
            }
        } else {
            showToast(`保存失败：${result.error || '未知错误'}`, true);
        }
    } catch {
        showToast('保存失败，请检查服务', true);
    }
});

editPageModal.addEventListener('click', event => {
    if (event.target === editPageModal) {
        closeEditPageModal();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && editPageModal.classList.contains('show')) {
        closeEditPageModal();
    }
});

// --- 心跳上报逻辑：每2秒告知后端页面仍处于活跃状态 ---
setInterval(() => {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
}, 2000);

document.addEventListener('mouseup', () => {
    if (typeof isLaser !== 'undefined') isLaser = false;
    if (typeof isDrawing !== 'undefined') isDrawing = false;
});
