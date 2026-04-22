(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function t(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(a){if(a.ep)return;a.ep=!0;const r=t(a);fetch(a.href,r)}})();const f=document.getElementById("folderList"),Y=document.getElementById("createFolderBtn"),F=document.getElementById("newFolderName"),g=document.getElementById("dropzone"),v=document.getElementById("previewIframe"),R=document.getElementById("targetFolderDisplay"),B=document.getElementById("toast"),X=document.getElementById("saveStandaloneBtn"),K=document.getElementById("clearDistBtn"),Q=document.getElementById("openDistBtn"),Z=document.getElementById("openReadmeBtn"),x=document.getElementById("readmeModal"),ee=document.getElementById("closeReadmeBtn"),te=document.getElementById("readmeBody"),C=document.getElementById("addPageModal"),ne=document.getElementById("closeAddPageBtn"),ae=document.getElementById("cancelAddPageBtn"),oe=document.getElementById("confirmAddPageBtn"),z=document.getElementById("addPageName"),se=document.getElementById("addPageFolderSpan"),I=document.getElementById("customPromptModal"),re=document.getElementById("customPromptTitle"),L=document.getElementById("customPromptInput"),D=document.getElementById("customPromptCancelBtn"),V=document.getElementById("customPromptConfirmBtn"),k=document.getElementById("customConfirmModal"),ie=document.getElementById("customConfirmTitle"),ce=document.getElementById("customConfirmMessage"),O=document.getElementById("customConfirmCancelBtn"),y=document.getElementById("customConfirmConfirmBtn");let w=null,A=null;const le=/<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]|<link[\s>]|<meta[\s>]|<base[\s>]|<title[\s>]/i,de=/\son[a-z][\w:-]*\s*=/i,me=/\b(?:href|src|xlink:href)\s*=\s*["']?\s*javascript:/i,ue=["src","href","poster","data","action","formaction","xlink:href"],pe=["srcset","imagesrcset"],fe=`
    html, body { width: 100% !important; height: auto !important; min-height: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: auto !important; background-color: transparent !important; }
    body { display: flex !important; flex-direction: column !important; justify-content: flex-start !important; align-items: center !important; }
    .slide-container { width: 100% !important; height: auto !important; min-height: 100vh !important; max-width: none !important; max-height: none !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; padding: 40px 60px !important; transform: none !important; }
    canvas, iframe, video, img { display: block !important; }
    * { box-sizing: border-box !important; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-thumb { background: rgba(0, 94, 170, 0.2); border-radius: 4px; }
`;let T=null;function he(e,n=!1){const t=e||"";return n===!0||le.test(t)||de.test(t)||me.test(t)}function G(e){return new URL(`slides/${encodeURIComponent(e)}/`,window.location.href)}function ge(e,{baseHref:n,overrideCssText:t}){const a=new DOMParser().parseFromString(e||"","text/html"),r=a.head||a.getElementsByTagName("head")[0]||a.documentElement.insertBefore(a.createElement("head"),a.body||null);a.documentElement.getAttribute("lang")||a.documentElement.setAttribute("lang","zh-CN");let o=r.querySelector("base");o||(o=a.createElement("base"),r.prepend(o)),o.setAttribute("href",n);const s=a.createElement("style");return s.setAttribute("data-webdeck-injected","true"),s.textContent=t,r.appendChild(s),`<!DOCTYPE html>
`+a.documentElement.outerHTML}function be(){return T||(T=fetch("/style.css").then(e=>e.ok?e.text():"").catch(()=>"")),T}function ye(e){return JSON.stringify(e).replace(/</g,"\\u003c")}function ve(e,n,t){return`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async><\/script>
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
            const payload = ${ye({rawHtml:e,baseHref:G(n).toString(),globalCssText:t||"",rebasedUrlAttributes:ue,rebasedSrcsetAttributes:pe})};

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
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(payload.globalCssText);
            shadow.adoptedStyleSheets = [sheet];

            const template = document.createElement("template");
            template.innerHTML = payload.rawHtml || "";
            rebaseFragmentAssetUrls(template.content, payload.baseHref);
            shadow.appendChild(template.content);

            let mathJaxChecks = 0;
            const maxMathJaxChecks = 100;
            const checkMathJax = setInterval(() => {
                mathJaxChecks += 1;
                if (window.MathJax && window.MathJax.typesetPromise) {
                    clearInterval(checkMathJax);
                    window.MathJax.typesetPromise([shadow]).then(() => {
                        const mjxStyle = document.getElementById("MJX-CHTML-styles");
                        if (mjxStyle) {
                            const mjxSheet = new CSSStyleSheet();
                            mjxSheet.replaceSync(mjxStyle.textContent);
                            shadow.adoptedStyleSheets = [sheet, mjxSheet];
                        }
                    }).catch(err => console.error("MathJax preview typeset failed:", err));
                } else if (mathJaxChecks >= maxMathJaxChecks) {
                    clearInterval(checkMathJax);
                    console.warn("MathJax preview load timeout");
                }
            }, 100);
        })();
    <\/script>
</body>
</html>`}window.addEventListener("dragover",e=>e.preventDefault());window.addEventListener("drop",e=>e.preventDefault());function M(e,n=""){return new Promise(t=>{re.textContent=e,L.value=n,I.classList.add("show"),I.setAttribute("aria-hidden","false"),L.focus(),L.select();const i=()=>{I.classList.remove("show"),I.setAttribute("aria-hidden","true"),V.removeEventListener("click",a),D.removeEventListener("click",r),L.removeEventListener("keydown",o)},a=()=>{i(),t(L.value.trim()||null)},r=()=>{i(),t(null)},o=s=>{s.key==="Enter"&&a(),s.key==="Escape"&&r()};V.addEventListener("click",a),D.addEventListener("click",r),L.addEventListener("keydown",o)})}function $(e,n,t=!0){return new Promise(i=>{ie.textContent=e,ce.textContent=n,k.classList.add("show"),k.setAttribute("aria-hidden","false"),t?(y.style.background="#ef4444",y.style.borderColor="#ef4444",y.textContent="确认彻底删除"):(y.style.background="var(--accent-color)",y.style.borderColor="var(--accent-color)",y.textContent="确认执行");const a=()=>{k.classList.remove("show"),k.setAttribute("aria-hidden","true"),y.removeEventListener("click",r),O.removeEventListener("click",o)},r=()=>{a(),i(!0)},o=()=>{a(),i(!1)};y.addEventListener("click",r),O.addEventListener("click",o)})}function l(e,n=!1){B.textContent=e,B.classList.toggle("error",n),B.classList.add("show"),setTimeout(()=>B.classList.remove("show"),3e3)}async function h(e,n){return(await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)})).json()}function W(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function N(e){let n=W(e);return n=n.replace(/`([^`]+)`/g,"<code>$1</code>"),n=n.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>"),n=n.replace(/\*([^*]+)\*/g,"<em>$1</em>"),n}function we(e){const n=e.replace(/\r\n/g,`
`).split(`
`),t=[];let i=[],a=[],r=null,o=!1,s=[];function c(){i.length&&(t.push(`<p>${N(i.join(" "))}</p>`),i=[])}function m(){if(!a.length)return;const u=r==="ol"?"ol":"ul";t.push(`<${u}>${a.map(p=>`<li>${N(p)}</li>`).join("")}</${u}>`),a=[],r=null}function d(){if(!o)return;const u=s.join(`
`),E=`<button class="copy-code-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(u).replace(/'/g,"%27")}')).then(() => { const old = this.innerText; this.innerText = '✅ 已复制!'; setTimeout(() => this.innerText = old, 2000); })" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s; backdrop-filter: blur(4px);" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">📋 一键复制</button>`;t.push(`<div style="position: relative; margin: 1em 0;">${E}<pre style="margin: 0;"><code>${W(u)}</code></pre></div>`),o=!1,s=[]}for(const u of n){if(u.startsWith("```")){c(),m(),o?d():o=!0;continue}if(o){s.push(u);continue}const p=u.trim();if(!p){c(),m();continue}if(/^---+$/.test(p)){c(),m(),t.push("<hr>");continue}const E=p.match(/^(#{1,4})\s+(.*)$/);if(E){c(),m();const q=E[1].length;t.push(`<h${q}>${N(E[2])}</h${q}>`);continue}const U=p.match(/^\d+\.\s+(.*)$/);if(U){c(),r&&r!=="ol"&&m(),r="ol",a.push(U[1]);continue}const j=p.match(/^[-*]\s+(.*)$/);if(j){c(),r&&r!=="ul"&&m(),r="ul",a.push(j[1]);continue}m(),i.push(p)}return c(),m(),d(),t.join(`
`)}function Ee(e){te.innerHTML=e,x.classList.add("show"),x.setAttribute("aria-hidden","false")}function H(){x.classList.remove("show"),x.setAttribute("aria-hidden","true")}function xe(e,n){document.querySelectorAll(".folder-card").forEach(t=>t.classList.remove("active")),document.querySelectorAll(".sub-item").forEach(t=>t.classList.remove("active")),e.classList.add("active"),w=n,R.textContent=`当前选中：${n}`,g.classList.remove("disabled"),g.style.display="flex",v&&(v.style.display="none")}function Ce(e){return`
        <div class="item-actions">
            <button class="add-page-btn rename-folder-btn" type="button" title="重命名章节" style="padding:4px 8px;">✏️</button>
            <button class="add-page-btn" type="button" title="新建页面">➕</button>
            <button class="visibility-toggle ${e.showInNav?"is-on":"is-off"} nav-toggle-btn" type="button" title="是否在导航大纲中显示此章">
                ${e.showInNav?"大纲显示":"大纲隐藏"}
            </button>
            <button class="visibility-toggle ${e.hideNav?"is-off":"is-on"} slide-nav-mode-btn" type="button" title="在此章播放时，是否隐藏顶部导航栏（全屏平铺）">
                ${e.hideNav?"沉浸无顶栏":"保留顶栏"}
            </button>
            <button class="delete-btn" type="button">删除</button>
        </div>
    `}function Le(e){return`
        <div class="item-actions">
            <button class="add-page-btn rename-file-btn" type="button" title="重命名页面" style="padding:4px 8px;">✏️</button>
            <button class="visibility-toggle ${e.visible?"is-on":"is-off"}" type="button">
                ${e.visible?"页面显示":"页面隐藏"}
            </button>
            <button class="delete-btn" type="button">删除</button>
        </div>
    `}async function b(){try{const n=await(await fetch("/api/list")).json();f.innerHTML="",n.folders.forEach(t=>{var r;const i=document.createElement("div");i.className="folder-card"+(t.name===w?" active":""),i.dataset.name=t.name;const a=document.createElement("div");if(a.className="folder-header",a.innerHTML=`
                <div class="folder-name">${t.name}</div>
                ${Ce(t)}
            `,a.querySelector(".rename-folder-btn").onclick=async o=>{o.stopPropagation();const s=await M("重命名章节",t.name);s&&J(t.name,s)},a.querySelector('.add-page-btn[title="新建页面"]').onclick=o=>{o.stopPropagation(),A=t.name,se.textContent=t.name,z.value="",window.htmlEditor&&window.htmlEditor.setValue(""),C.classList.add("show"),C.setAttribute("aria-hidden","false")},a.querySelector(".nav-toggle-btn").onclick=async o=>{o.stopPropagation();const s=await h("/api/toggle-folder-nav",{folder:t.name,showInNav:!t.showInNav});s.success?(l(t.showInNav?`已在大纲隐藏章节：${t.title||t.name}`:`已在大纲显示章节：${t.title||t.name}`),b()):l(`切换大纲显示失败：${s.error||"未知错误"}`,!0)},a.querySelector(".slide-nav-mode-btn").onclick=async o=>{o.stopPropagation();const s=await h("/api/toggle-folder-hidenav",{folder:t.name,hideNav:!t.hideNav});s.success?(l(t.hideNav?"此章已切换为：保留顶栏模式":"此章已切换为：沉浸平铺模式"),b()):l(`切换顶栏模式失败：${s.error||"未知错误"}`,!0)},a.querySelector(".delete-btn").onclick=o=>{o.stopPropagation(),Se(t.name,t.title||t.name)},i.appendChild(a),(r=t.files)!=null&&r.length){const o=document.createElement("div");o.className="sub-items",t.files.forEach(s=>{const c=document.createElement("div");c.className="sub-item",c.draggable=!0,c.dataset.filename=s.filename,c.innerHTML=`
                        <span class="sub-item-label">${(s.title||s.filename).replace(/\.html$/i,"")}</span>
                        ${Le(s)}
                    `,c.onclick=m=>{m.target.closest(".item-actions")||(m.stopPropagation(),document.querySelectorAll(".folder-card").forEach(d=>d.classList.remove("active")),document.querySelectorAll(".sub-item").forEach(d=>d.classList.remove("active")),c.classList.add("active"),w=t.name,R.textContent=`预览页面：${t.name} / ${s.filename}`,g.style.display="none",v&&(v.style.display="block",v.setAttribute("sandbox","allow-scripts"),Promise.all([fetch(`slides/${encodeURIComponent(t.name)}/${encodeURIComponent(s.filename)}`).then(d=>{if(!d.ok)throw new Error(`HTTP ${d.status}`);return d.text()}),be()]).then(([d,u])=>{const p=he(d,s.isFullBleed),E=G(t.name).toString();p?v.srcdoc=ge(d,{baseHref:E,overrideCssText:fe}):v.srcdoc=ve(d,t.name,u)}).catch(d=>{console.error("Failed to load preview:",d),v.srcdoc='<div style="padding:20px; color:red;">预览加载失败</div>'})))},c.querySelector(".rename-file-btn").onclick=async m=>{m.stopPropagation();const d=s.filename.replace(/\.html$/i,""),u=await M("重命名页面文件",d);u&&J(s.filename,u,t.name)},c.querySelector(".visibility-toggle").onclick=async m=>{m.stopPropagation();const d=await h("/api/toggle-file-visibility",{folder:t.name,filename:s.filename,visible:!s.visible});d.success?(l(s.visible?`已隐藏页面：${s.title||s.filename}`:`已显示页面：${s.title||s.filename}`),b()):l(`切换页面显示失败：${d.error||"未知错误"}`,!0)},c.querySelector(".delete-btn").onclick=m=>{m.stopPropagation(),Be(t.name,s.filename,s.title||s.filename)},c.addEventListener("dragstart",m=>{m.stopPropagation(),c.classList.add("dragging-file")}),c.addEventListener("dragend",m=>{m.stopPropagation(),c.classList.remove("dragging-file"),P(t.name)}),o.appendChild(c)}),o.addEventListener("dragover",s=>{const c=document.querySelector(".dragging-file");if(!c||!o.contains(c))return;s.preventDefault();const d=[...o.querySelectorAll(".sub-item:not(.dragging-file)")].find(u=>s.clientY<=u.getBoundingClientRect().top+u.offsetHeight/2);o.insertBefore(c,d)}),i.appendChild(o)}i.draggable=!0,i.addEventListener("dragstart",o=>{!o.target.classList.contains("sub-item")&&!o.target.closest(".item-actions")&&i.classList.add("dragging")}),i.addEventListener("dragend",()=>{i.classList.remove("dragging"),P()}),i.addEventListener("click",()=>xe(i,t.name)),f.appendChild(i)})}catch(e){console.error(e),l("加载章节失败",!0)}}async function J(e,n,t=null){await h("/api/rename",{oldName:e,newName:n,parentFolder:t}),b()}async function Se(e,n){if(!await $("确认删除大章节",`确定删除由 [${n}] 统领的整个章节吗？

该操作会剥离连带删除下方所有的展示页面和配置，落子无悔。`))return;const i=await h("/api/delete-folder",{folder:e});if(i.success){w===e&&(w=null,R.textContent="请先在左侧选择一个章节",g.classList.add("disabled")),l(`已删除章节：${n}`);const a=[...f.querySelectorAll(".folder-card")].find(r=>r.dataset.name===e);a&&a.remove(),await P()}else l(`删除章节失败：${i.error||"未知错误"}`,!0)}async function Be(e,n,t){if(!await $("确认删除幻灯片",`确定彻底移除分支小页 “${t}” 吗？

该 HTML 文件将被从本地强行剔除，不可恢复。`))return;const a=await h("/api/delete-file",{folder:e,filename:n});if(a.success){l(`已删除页面：${t}`);const r=[...f.querySelectorAll(".folder-card")].find(o=>o.dataset.name===e);if(r){const o=[...r.querySelectorAll(".sub-item")].find(s=>s.dataset.filename===n);o&&o.remove()}await P(e)}else l(`删除页面失败：${a.error||"未知错误"}`,!0)}async function P(e=null){let n=[];e?n=[...[...f.querySelectorAll(".folder-card")].find(i=>i.dataset.name===e).querySelectorAll(".sub-item")].map(i=>i.dataset.filename):n=[...f.querySelectorAll(".folder-card")].map(t=>t.dataset.name),await h("/api/reorder",{items:n,parent:e}),b()}X.addEventListener("click",async()=>{const e=await M("命名您的离线工程 (交付包名称)","WebDeck_Export");if(e){l("正在导出离线项目...");try{const t=await(await fetch("/api/export-project",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectName:e})})).json();t.success?l(`导出成功：dist/${e}/index.html`):l(`导出失败：${t.error}`,!0)}catch{l("导出失败，请检查本地服务",!0)}}});K.addEventListener("click",async()=>{if(!await $("清理产物垃圾夹",`确定要将以往堆积的旧导出包全部撕碎清空吗？
(这将会抹除 dist 里的所有工程)`))return;(await(await fetch("/api/clear-dist",{method:"POST"})).json()).success&&l("dist 已清理")});Q.addEventListener("click",async()=>{try{const n=await(await fetch("/api/open-dist",{method:"POST"})).json();n.success?l("已打开 dist 文件夹"):l(`打开 dist 失败：${n.error||"未知错误"}`,!0)}catch{l("打开 dist 失败",!0)}});const _=document.getElementById("shutdownBtn");_&&_.addEventListener("click",async()=>{if(await $("关闭控制台",`确定要彻底退出 WebDeck 背景服务吗？

关闭后你需要重新双击 start.bat 才能再次进入。`,!0))try{await fetch("/api/shutdown",{method:"POST"}),document.body.innerHTML=`
                    <div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;">
                        <h1 style="color:#10b981; font-size: 2.5rem; margin-bottom: 20px;">✅ 控制台服务已安全关闭</h1>
                        <p style="color:#64748b; font-size: 1.2rem;">您可以直接关闭此浏览器标签页了。</p>
                    </div>
                `}catch{l("关闭请求发送失败",!0)}});Z.addEventListener("click",async()=>{try{const n=await(await fetch("/api/readme")).json();n.success?Ee(we(n.content||"")):l(`读取 README 失败：${n.error||"未知错误"}`,!0)}catch{l("读取 README 失败",!0)}});ee.addEventListener("click",H);x.addEventListener("click",e=>{e.target===x&&H()});document.addEventListener("keydown",e=>{e.key==="Escape"&&x.classList.contains("show")&&H()});Y.onclick=async()=>{const e=F.value.trim();e&&(await h("/api/create",{name:e}),F.value="",b())};g.ondragover=e=>{w&&(e.preventDefault(),g.classList.add("dragover"))};g.ondragleave=()=>g.classList.remove("dragover");g.ondrop=async e=>{if(e.preventDefault(),g.classList.remove("dragover"),!!w){for(const n of e.dataTransfer.files){if(!n.name.endsWith(".html"))continue;const t=await n.text();await h("/api/upload",{filename:n.name,content:t,folder:w})}b()}};f.dataset.dragBound||(f.addEventListener("dragover",e=>{const n=document.querySelector(".folder-card.dragging");if(!n)return;e.preventDefault();const i=[...f.querySelectorAll(".folder-card:not(.dragging)")].find(a=>e.clientY<=a.getBoundingClientRect().top+a.offsetHeight/2);f.insertBefore(n,i)}),f.dataset.dragBound="1");function S(){C.classList.remove("show"),C.setAttribute("aria-hidden","true"),A=null}ne.addEventListener("click",S);ae.addEventListener("click",S);oe.addEventListener("click",async()=>{if(!A)return;let e=z.value.trim();if(!e){l("请输入页面名称",!0);return}e.toLowerCase().endsWith(".html")||(e+=".html");const n=window.htmlEditor?window.htmlEditor.getValue():"",t=await h("/api/upload",{filename:e,content:n,folder:A});t.success?(l(`已新建页面：${e}`),S(),b()):l(`新建页面失败：${t.error||"未知错误"}`,!0)});C.addEventListener("click",e=>{e.target===C&&S()});document.addEventListener("keydown",e=>{e.key==="Escape"&&C.classList.contains("show")&&S()});b();setInterval(()=>{fetch("/api/heartbeat",{method:"POST"}).catch(()=>{})},2e3);
