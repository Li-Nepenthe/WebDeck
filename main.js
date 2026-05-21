import './style.css';

// 本地存放海大 PNG 图标的路径
// 请将图片文件放置于项目根目录新创建的 `public` 文件夹下
export const LOGO_BADGE_URL = "logo-badge.png";
export const LOGO_TEXT_URL = "logo-text.png";

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

// Vite 的 as:'raw' 会抽取 <style> 标签走 CSS 管线，导致客户端拿到的字符串
// 失去 <style> 文本，无法可靠检测完整文档。因此不再在客户端做隔离检测。
// 所有检测和原始 HTML 获取都走服务端 API（见下方 fetch 流程）。

// 批量扫描加载所有的 HTML 幻灯片和它们所在目录的 config.json
const slidesHtml = import.meta.glob('./slides/**/*.html', { as: 'raw', eager: true });
const configs = import.meta.glob('./slides/**/config.json', { eager: true });

const slidesData = [];
let globalSlideIndex = 0;

function shouldRenderInIframe(rawHtml, explicit = false) {
    const html = rawHtml || '';
    return explicit === true
        || IFRAME_RENDER_HINT_REGEX.test(html)
        || INLINE_HANDLER_HINT_REGEX.test(html)
        || JAVASCRIPT_URL_HINT_REGEX.test(html);
}

function createSlideBaseUrl(chapterPrefix) {
    return new URL(`slides/${encodeURIComponent(chapterPrefix)}/`, window.location.href);
}

function rebaseAssetUrl(urlValue, baseUrl) {
    const trimmed = (urlValue || '').trim();
    if (!trimmed || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(trimmed)) {
        return urlValue;
    }

    try {
        return new URL(trimmed, baseUrl).toString();
    } catch {
        return urlValue;
    }
}

function rewriteCssUrls(cssText, baseUrl) {
    return (cssText || '').replace(/url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi, (match, quote, assetPath) => {
        const rebasedUrl = rebaseAssetUrl(assetPath, baseUrl);
        if (rebasedUrl === assetPath) {
            return match;
        }
        return `url("${rebasedUrl}")`;
    });
}

function rebaseSrcsetValue(srcsetValue, baseUrl) {
    return (srcsetValue || '').split(',').map(candidate => {
        const trimmedCandidate = candidate.trim();
        if (!trimmedCandidate) {
            return trimmedCandidate;
        }

        const parts = trimmedCandidate.split(/\s+/);
        const assetPath = parts.shift();
        const descriptor = parts.join(' ');
        const rebasedUrl = rebaseAssetUrl(assetPath, baseUrl);
        return descriptor ? `${rebasedUrl} ${descriptor}` : rebasedUrl;
    }).join(', ');
}

function rebaseFragmentAssetUrls(fragmentRoot, baseUrl) {
    fragmentRoot.querySelectorAll('*').forEach(node => {
        REBASED_URL_ATTRIBUTES.forEach(attributeName => {
            if (!node.hasAttribute(attributeName)) {
                return;
            }

            const originalValue = node.getAttribute(attributeName);
            const rebasedValue = rebaseAssetUrl(originalValue, baseUrl);
            if (rebasedValue !== originalValue) {
                node.setAttribute(attributeName, rebasedValue);
            }
        });

        REBASED_SRCSET_ATTRIBUTES.forEach(attributeName => {
            if (!node.hasAttribute(attributeName)) {
                return;
            }

            const originalValue = node.getAttribute(attributeName);
            const rebasedValue = rebaseSrcsetValue(originalValue, baseUrl);
            if (rebasedValue !== originalValue) {
                node.setAttribute(attributeName, rebasedValue);
            }
        });

        if (node.hasAttribute('style')) {
            node.setAttribute('style', rewriteCssUrls(node.getAttribute('style'), baseUrl));
        }
    });

    fragmentRoot.querySelectorAll('style').forEach(styleNode => {
        styleNode.textContent = rewriteCssUrls(styleNode.textContent, baseUrl);
    });
}

function buildFragmentContent(rawHtml, baseUrl) {
    const template = document.createElement('template');
    template.innerHTML = rawHtml || '';
    rebaseFragmentAssetUrls(template.content, baseUrl);
    return template.content;
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

function waitForMathJaxTypeset(targets, options = {}) {
    const { interval = 100, maxAttempts = 100, onReady } = options;
    let attempts = 0;
    const checkMathJax = setInterval(() => {
        attempts += 1;
        if (window.MathJax && window.MathJax.typesetPromise) {
            clearInterval(checkMathJax);
            const typesetTask = Array.isArray(targets)
                ? window.MathJax.typesetPromise(targets)
                : window.MathJax.typesetPromise();
            typesetTask
                .then(() => {
                    if (typeof onReady === 'function') {
                        onReady();
                    }
                })
                .catch(err => console.error('MathJax Error:', err));
        } else if (attempts >= maxAttempts) {
            clearInterval(checkMathJax);
            console.warn('[WebDeck] MathJax load timeout');
        }
    }, interval);
}

// 用于建立导航栏的章节数据，先跑一遍 configs，保证没有内容的文件夹也能上榜
const chaptersMap = new Map();

Object.keys(configs).forEach(configKey => {
    const parts = configKey.split('/');
    if (parts.length < 4) return;
    const folderName = parts[2];
    const folderConfig = configs[configKey]?.default || { showInNav: true };

    let displayTitle = folderName;
    const match = folderName.match(/^\d+_(.+)$/);
    if (match) {
        displayTitle = match[1];
    }

    chaptersMap.set(folderName, {
        folderName: folderName,
        title: displayTitle,
        showInNav: folderConfig.showInNav,
        hideNav: folderConfig.hideNav === true,
        startIndex: -1,
        count: 0
    });
});

// 再处理真正的幻灯片页面
const keys = Object.keys(slidesHtml).sort();
keys.forEach(key => {
    const parts = key.split('/');
    if (parts.length < 4) return; // Ignore files directly in slides/

    const folderName = parts[2]; // e.g. "01", "00_首页", "02_方法"
    
    if (!chaptersMap.has(folderName)) {
        let displayTitle = folderName;
        const match = folderName.match(/^\d+_(.+)$/);
        if (match) {
            displayTitle = match[1];
        }
        chaptersMap.set(folderName, {
            folderName: folderName,
            title: displayTitle,
            showInNav: true,
            hideNav: false,
            startIndex: -1,
            count: 0
        });
    }

    const chapterInfo = chaptersMap.get(folderName);
    if (chapterInfo.startIndex === -1) {
        chapterInfo.startIndex = globalSlideIndex;
    }
    chapterInfo.count++;

    const sanitized = slidesHtml[key];
    slidesData.push({
        html: sanitized,
        chapterPrefix: folderName,
        chapterTitle: chapterInfo.title,
        hideNav: chapterInfo.hideNav,
        globalIndex: globalSlideIndex
    });
    
    globalSlideIndex++;
});

// Convert chaptersMap to Array for rendering
const orderedChapters = Array.from(chaptersMap.values());

// Layout
document.querySelector('#app').innerHTML = `
  <nav id="top-nav" style="transition: opacity 0.5s ease, transform 0.5s ease;">
    <div class="nav-links">
        ${orderedChapters.filter(ch => ch.showInNav && !ch.hideNav).map(ch => {
            const targetIndex = ch.startIndex !== -1 ? ch.startIndex : 0;
            return `
                <div class="nav-item" data-prefix="${ch.folderName}" data-target-index="${targetIndex}">
                    ${ch.title}
                </div>
            `;
        }).join('')}
    </div>
    
    <div id="global-logo">
        <img src="${LOGO_BADGE_URL}" class="logo-badge" alt="徽标" onerror="this.style.display='none'">
        <img src="${LOGO_TEXT_URL}" class="logo-text" alt="文字标" onerror="this.outerHTML='<span style=\\'font-size:1.35rem;font-weight:800;letter-spacing:2px;\\'>海南大学</span>'">
    </div>
  </nav>

  <div id="presentation">
    ${slidesData.length === 0 ? '<div style="color:var(--text-secondary); text-align:center; margin-top:200px;">没有找到幻灯片，请在 slides 文件夹中放入 HTML 文件</div>' : ''}
    
    ${slidesData.map((data) => {
      const isCover = data.chapterPrefix === '01_封面' || data.chapterPrefix === '00_首页' || data.globalIndex === 0 || data.hideNav;
      const coverAttr = isCover ? ' data-cover="true"' : '';
      return `
      <section class="slide ${data.globalIndex === 0 ? 'active' : 'next'} is-full-bleed" data-index="${data.globalIndex}" data-prefix="${data.chapterPrefix}"${coverAttr}>
        <canvas class="annotation-canvas"></canvas>
        <div class="slide-content" id="dev-slide-content-${data.globalIndex}">
            </div>
      </section>
    `;
    }).join('')}
  </div>

  <div id="eraser-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; justify-content:center; align-items:center;">
    <div style="background:var(--glass-bg); padding:30px 40px; border-radius:15px; border:1px solid var(--glass-border); text-align:center; box-shadow:0 15px 35px var(--shadow-color); backdrop-filter:blur(20px);">
        <h3 style="margin-bottom:15px; font-weight:800; color:var(--accent-color); font-size:1.5rem;">清理批注</h3>
        <p style="margin-bottom:25px; color:var(--text-secondary); font-size:1.1rem;">请选择橡皮擦的擦除范围：</p>
        <div style="display:flex; gap:15px; justify-content:center;">
            <button id="clearCurrentBtn" style="padding:10px 20px; font-weight:600; border:none; background:var(--accent-color); color:white; border-radius:8px; cursor:pointer;">仅擦当前页</button>
            <button id="clearAllBtn" style="padding:10px 20px; font-weight:600; border:none; background:#ef4444; color:white; border-radius:8px; cursor:pointer;">擦除全部页</button>
            <button id="cancelClearBtn" style="padding:10px 20px; font-weight:600; border:none; background:transparent; color:var(--text-secondary); border-radius:8px; cursor:pointer;">取消</button>
        </div>
    </div>
  </div>

  <div id="controls" class="hidden">
    <button id="eraserBtn" title="Eraser Tool">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>
    </button>
    <button id="penBtn" title="Toggle Annotation Pen">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
    </button>

  </div>
`;

// Logic
let currentSlideIndex = 0;
const totalSlides = slidesData.length;
const slideElements = document.querySelectorAll('.slide');
const navItems = document.querySelectorAll('.nav-item');
const topNav = document.getElementById('top-nav');

function updateViteSlides() {
    if (totalSlides === 0) return;
    
    slideElements.forEach((el, index) => {
        el.classList.remove('active', 'prev', 'next');
        if (index === currentSlideIndex) {
            el.classList.add('active');
            // Reset horizontal scroll to prevent left-truncation after direction change
            const content = el.querySelector('.slide-content');
            if (content) {
                content.scrollLeft = 0;
            }
        } else if (index < currentSlideIndex) {
            el.classList.add('prev');
        } else {
            el.classList.add('next');
        }
    });

    // Handle Cover Page conditional visibility (hide if folder name is 01_封面 or index 0 or configured to hide Nav)
    const currentSlide = slidesData[currentSlideIndex];
    const currentPrefix = currentSlide?.chapterPrefix;
    const isNavHidden = currentPrefix === '01_封面' || currentPrefix === '00_首页' || currentSlideIndex === 0 || currentSlide?.hideNav;

    if (isNavHidden) {
        topNav.style.opacity = '0';
        topNav.style.transform = 'translateY(-20px)';
        topNav.style.pointerEvents = 'none';
        document.getElementById('presentation').classList.add('no-nav');
    } else {
        topNav.style.opacity = '1';
        topNav.style.transform = 'translateY(0)';
        topNav.style.pointerEvents = 'auto';
        document.getElementById('presentation').classList.remove('no-nav');
    }

    navItems.forEach(item => {
        if (item.dataset.prefix === currentPrefix) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const activeSlide = slideElements[currentSlideIndex];
    if (activeSlide) {
        const event = new CustomEvent('slideChanged', { detail: { index: currentSlideIndex } });
        activeSlide.dispatchEvent(event);
    }
}

function nextSlide() {
    if (currentSlideIndex < totalSlides - 1) {
        currentSlideIndex++;
        updateViteSlides();
    }
}

function prevSlide() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        updateViteSlides();
    }
}

function jumpToSlide(index) {
    if (index >= 0 && index < totalSlides) {
        currentSlideIndex = index;
        updateViteSlides();
    }
}

// Event Listeners for slide controls (keyboard-only, arrow buttons removed)

// Elegant startup notification for keyboard shortcut to toggle toolbox visibility
const controlsElement = document.getElementById('controls');
if (controlsElement) {
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.85); color:white; padding:10px 24px; border-radius:30px; font-size:0.95rem; font-weight:600; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); z-index:10000; transition:opacity 0.8s ease; pointer-events:none; box-shadow: 0 10px 25px rgba(0,0,0,0.25);';
    tip.innerHTML = '💡 提示：按 <b style="color:#38bdf8;padding:0 3px;">T</b> 或 <b style="color:#38bdf8;padding:0 3px;">H</b> 键可切换工具栏的显示与隐藏';
    document.body.appendChild(tip);
    setTimeout(() => {
        tip.style.opacity = '0';
        setTimeout(() => tip.remove(), 800);
    }, 4000);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Space' || e.code === 'Space') {
        nextSlide();
    } else if (e.key === 'ArrowLeft') {
        prevSlide();
    } else if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'h') {
        const controls = document.getElementById('controls');
        if (controls) {
            controls.classList.toggle('hidden');
        }
    }
});

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetIndex = parseInt(item.dataset.targetIndex, 10);
        jumpToSlide(targetIndex);
    });
});

document.addEventListener('click', (e) => {
    // 只在非画笔模式下抢夺焦点，避免打断画画
    if(!isPenMode && (e.target === document.body || e.target.id === 'app' || e.target.id === 'presentation')) {
        window.focus();
    }
});

updateViteSlides();

// ==========================================
// 从服务端 API 获取真实原始 HTML，绕过 Vite 的 CSS 抽取
// 对需要隔离的幻灯片（含 <style> 的完整文档）替换为 <iframe>
// ==========================================
fetch('/api/presentation-data')
    .then(r => r.json())
    .then(async serverData => {
        const globalSheet = new CSSStyleSheet();
        let fallbackCss = null;
        if (serverData.globalCss) {
            try {
                await globalSheet.replace(serverData.globalCss);
            } catch(e) {
                fallbackCss = serverData.globalCss;
            }
        }
        const mathjaxRoots = [document.body];

        (serverData.slides || []).forEach((serverSlide, index) => {
            const slideEl = document.querySelector(`.slide[data-index="${index}"]`);
            if (!slideEl) return;

            const content = slideEl.querySelector('.slide-content');
            content.innerHTML = ''; 

            const rawHtml = serverSlide.rawHtml || serverSlide.html || '';
            const isFullBleed = shouldRenderInIframe(rawHtml, serverSlide.isFullBleed);
            const baseUrl = createSlideBaseUrl(serverSlide.chapterPrefix);

            if (isFullBleed) {
                const iframe = document.createElement('iframe');
                iframe.className = 'slide-iframe';
                iframe.setAttribute('sandbox', 'allow-scripts');
                iframe.onload = () => {
                    try {
                        iframe.contentWindow.addEventListener('click', () => window.focus());
                    } catch(e) {}
                };
                iframe.srcdoc = buildIframeSrcdoc(rawHtml, {
                    baseHref: baseUrl.toString(),
                    overrideCssText: FULL_DOC_OVERRIDE_CSS
                });
                content.appendChild(iframe);
            } else {
                content.style.display = 'flex';
                content.style.flexDirection = 'column';
                content.style.width = '100%';
                content.style.height = '100%';
                content.style.flex = '1';
                
                const host = document.createElement('div');
                host.className = 'shadow-host';
                host.style.cssText = 'width:100%; height:100%; display:flex; flex-direction:column; flex:1;';
                content.appendChild(host);
                
                const shadow = host.attachShadow({ mode: 'open' });
                if (fallbackCss) {
                    const style = document.createElement('style');
                    style.textContent = fallbackCss;
                    shadow.appendChild(style);
                } else {
                    shadow.adoptedStyleSheets = [globalSheet];
                }

                shadow.appendChild(buildFragmentContent(rawHtml, baseUrl));
                
                mathjaxRoots.push(shadow);
            }
        });

        // MathJax MutationObserver
        const mjxSheet = new CSSStyleSheet();
        function observeMathJax() {
            const mjxStyle = document.getElementById('MJX-CHTML-styles');
            if (mjxStyle) {
                try { mjxSheet.replace(mjxStyle.textContent); } catch(e) {}
                const observer = new MutationObserver(() => {
                    try { mjxSheet.replace(mjxStyle.textContent); } catch(e) {}
                });
                observer.observe(mjxStyle, { childList: true, characterData: true, subtree: true });
                
                mathjaxRoots.forEach(root => {
                    if (root !== document.body && !root.adoptedStyleSheets.includes(mjxSheet)) {
                        root.adoptedStyleSheets = [...root.adoptedStyleSheets, mjxSheet];
                    }
                });
            } else {
                const headObserver = new MutationObserver(() => {
                    if (document.getElementById('MJX-CHTML-styles')) {
                        headObserver.disconnect();
                        observeMathJax();
                    }
                });
                headObserver.observe(document.head, { childList: true });
            }
        }
        observeMathJax();
        waitForMathJaxTypeset(mathjaxRoots);
    })
    .catch(err => console.warn('[WebDeck] slide initialization error:', err));

// ==========================================
// 永久批注画笔交互功能 (Persistent Annotation Pen)
// ==========================================
let isPenMode = false;
const penBtn = document.getElementById('penBtn');
const annotationCanvases = document.querySelectorAll('.annotation-canvas');

// 初始化所有每一页自带的画板
function initAnnotationCanvases() {
    annotationCanvases.forEach(canvas => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const ctx = canvas.getContext('2d');
        let isDrawingPen = false;
        let lastX = 0;
        let lastY = 0;
        
        canvas.addEventListener('mousedown', e => {
            if (e.button === 0 && isPenMode) {
                isDrawingPen = true;
                lastX = e.clientX;
                lastY = e.clientY;
            }
        });

        canvas.addEventListener('mousemove', e => {
            if (!isDrawingPen) return;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.clientX, e.clientY);
            // 采用鲜亮的亮蓝色和一点荧光感，匹配学术深蓝UI的同时不被底色吃掉
            ctx.strokeStyle = '#38bdf8'; 
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#0284c7';
            ctx.stroke();
            lastX = e.clientX;
            lastY = e.clientY;
        });

        canvas.addEventListener('mouseup', e => {
            if (e.button === 0) isDrawingPen = false;
        });
        
        // 鼠标移出画布范围也停止绘制
        canvas.addEventListener('mouseout', e => {
            isDrawingPen = false;
        });
    });
}
initAnnotationCanvases();
window.addEventListener('resize', initAnnotationCanvases);

penBtn?.addEventListener('click', () => {
    isPenMode = !isPenMode;
    if (isPenMode) {
        penBtn.classList.add('active');
        annotationCanvases.forEach(c => c.style.pointerEvents = 'auto');
    } else {
        penBtn.classList.remove('active');
        annotationCanvases.forEach(c => c.style.pointerEvents = 'none');
    }
});

// ==========================================
// 橡皮擦清理功能 (Eraser Tool)
// ==========================================
const eraserBtn = document.getElementById('eraserBtn');
const eraserModal = document.getElementById('eraser-modal');
const clearCurrentBtn = document.getElementById('clearCurrentBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const cancelClearBtn = document.getElementById('cancelClearBtn');

eraserBtn?.addEventListener('click', () => {
    eraserModal.style.display = 'flex';
});

cancelClearBtn?.addEventListener('click', () => {
    eraserModal.style.display = 'none';
});

clearCurrentBtn?.addEventListener('click', () => {
    const activeSlide = slideElements[currentSlideIndex];
    const activeCanvas = activeSlide.querySelector('.annotation-canvas');
    if (activeCanvas) {
        const ctx = activeCanvas.getContext('2d');
        ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    }
    eraserModal.style.display = 'none';
});

clearAllBtn?.addEventListener('click', () => {
    annotationCanvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    eraserModal.style.display = 'none';
});

// ==========================================
// 全局触发 LaTeX 数学公式解析
// ==========================================
waitForMathJaxTypeset(undefined, {
    onReady: () => console.log('MathJax typeset complete')
});

// ==========================================
// 激光笔画笔批注交互功能 (Laser Pointer)
// ==========================================
const laserCanvas = document.createElement('canvas');
laserCanvas.id = 'laser-canvas';
laserCanvas.style.position = 'fixed';
laserCanvas.style.top = '0';
laserCanvas.style.left = '0';
laserCanvas.style.width = '100vw';
laserCanvas.style.height = '100vh';
laserCanvas.style.zIndex = '9999';
laserCanvas.style.pointerEvents = 'none'; // 确保不阻挡底层任何原本的点击操作
document.body.appendChild(laserCanvas);

const ctx = laserCanvas.getContext('2d');
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function resizeCanvas() {
    laserCanvas.width = window.innerWidth;
    laserCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 全局禁用鼠标右键默认菜单，留作激光笔专用
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousedown', e => {
    // 右键 (2) 或 Ctrl+左键 (0) 均可触发激光笔
    if (e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
        isDrawing = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }
});

document.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    
    // 渲染激光线条
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.clientX, e.clientY);
    
    // 纯粹的亮红色，最高浓度
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
    
    ctx.stroke();
    
    lastX = e.clientX;
    lastY = e.clientY;
});

document.addEventListener('mouseup', e => {
    isDrawing = false;
});

// 让激光笔的痕迹自动随时间褪色淡出
function fadeLoop() {
    // 只有在没按住右键画画时（松开后），才触发全局的淡化剥落效果
    if (!isDrawing) {
        ctx.shadowBlur = 0; // 淡化时必须关闭阴影否则残影严重
        ctx.globalCompositeOperation = 'destination-out';
        // 把消失速度保留较高值，松手后迅速消失
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; 
        ctx.fillRect(0, 0, laserCanvas.width, laserCanvas.height);
        
        ctx.globalCompositeOperation = 'source-over'; // 恢复正常的重叠渲染模式
    }
    requestAnimationFrame(fadeLoop);
}
fadeLoop();
