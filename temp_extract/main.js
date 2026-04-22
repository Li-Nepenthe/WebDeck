import './style.css';

// 本地存放海大 PNG 图标的路径
// 请将图片文件放置于项目根目录新创建的 `public` 文件夹下
export const LOGO_BADGE_URL = "logo-badge.png";
export const LOGO_TEXT_URL = "logo-text.png";

// 批量扫描加载所有的 HTML 幻灯片和它们所在目录的 config.json
const slidesHtml = import.meta.glob('./slides/**/*.html', { as: 'raw', eager: true });
const configs = import.meta.glob('./slides/**/config.json', { eager: true });

const slidesData = [];
let globalSlideIndex = 0;

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
            startIndex: -1,
            count: 0
        });
    }

    const chapterInfo = chaptersMap.get(folderName);
    if (chapterInfo.startIndex === -1) {
        chapterInfo.startIndex = globalSlideIndex;
    }
    chapterInfo.count++;

    slidesData.push({
        html: slidesHtml[key],
        chapterPrefix: folderName,
        chapterTitle: chapterInfo.title,
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
        ${orderedChapters.filter(ch => ch.showInNav).map(ch => {
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
    
    ${slidesData.map((data) => `
      <section class="slide ${data.globalIndex === 0 ? 'active' : 'next'}" data-index="${data.globalIndex}" data-prefix="${data.chapterPrefix}">
        <canvas class="annotation-canvas"></canvas>
        <div class="slide-content">
            ${data.html}
        </div>
      </section>
    `).join('')}
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

  <div id="controls" style="transition: opacity 0.5s ease;">
    <button id="eraserBtn" title="Eraser Tool">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>
    </button>
    <button id="penBtn" title="Toggle Annotation Pen">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
    </button>
    <button id="prevBtn" title="Previous Slide">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <button id="nextBtn" title="Next Slide">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  </div>
  <div id="progress" style="transition: opacity 0.5s ease;">
    <div id="progress-bar"></div>
  </div>
`;

// Logic
let currentSlideIndex = 0;
const totalSlides = slidesData.length;
const slideElements = document.querySelectorAll('.slide');
const progressBar = document.getElementById('progress-bar');
const navItems = document.querySelectorAll('.nav-item');
const topNav = document.getElementById('top-nav');
const progressBlock = document.getElementById('progress');

function updateViteSlides() {
    if (totalSlides === 0) return;
    
    slideElements.forEach((el, index) => {
        el.classList.remove('active', 'prev', 'next');
        if (index === currentSlideIndex) {
            el.classList.add('active');
        } else if (index < currentSlideIndex) {
            el.classList.add('prev');
        } else {
            el.classList.add('next');
        }
    });

    // Handle Cover Page conditional visibility (hide if folder name is 00_首页)
    const currentPrefix = slidesData[currentSlideIndex]?.chapterPrefix;
    if (currentPrefix === '00_首页' || currentSlideIndex === 0) {
        topNav.style.opacity = '0';
        topNav.style.transform = 'translateY(-20px)';
        topNav.style.pointerEvents = 'none';
        progressBlock.style.opacity = '0';
    } else {
        topNav.style.opacity = '1';
        topNav.style.transform = 'translateY(0)';
        topNav.style.pointerEvents = 'auto';
        progressBlock.style.opacity = '1';
    }

    const progressPercentage = totalSlides > 1 ? (currentSlideIndex / (totalSlides - 1)) * 100 : 100;
    progressBar.style.width = `${progressPercentage || 0}%`;

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

// Event Listeners for slide controls
document.getElementById('nextBtn')?.addEventListener('click', nextSlide);
document.getElementById('prevBtn')?.addEventListener('click', prevSlide);

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Space' || e.code === 'Space') {
        nextSlide();
    } else if (e.key === 'ArrowLeft') {
        prevSlide();
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
setTimeout(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise()
            .then(() => console.log('MathJax typeset complete'))
            .catch((err) => console.log('MathJax typeset failed: ' + err.message));
    }
}, 100);

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
    if (e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
        isDrawing = false;
    }
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
