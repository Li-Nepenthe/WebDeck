const folderListEl = document.getElementById('folderList');
const createFolderBtn = document.getElementById('createFolderBtn');
const newFolderNameInput = document.getElementById('newFolderName');
const dropzone = document.getElementById('dropzone');
const targetFolderDisplay = document.getElementById('targetFolderDisplay');
const toastEl = document.getElementById('toast');
const saveStandaloneBtn = document.getElementById('saveStandaloneBtn');
const clearDistBtn = document.getElementById('clearDistBtn');
const openDistBtn = document.getElementById('openDistBtn');
const openReadmeBtn = document.getElementById('openReadmeBtn');
const readmeModal = document.getElementById('readmeModal');
const closeReadmeBtn = document.getElementById('closeReadmeBtn');
const readmeBody = document.getElementById('readmeBody');

let currentActiveFolder = null;

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
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeLines = [];
    }

    for (const line of lines) {
        if (line.startsWith('```')) {
            flushParagraph();
            flushList();
            if (inCodeBlock) {
                flushCodeBlock();
            } else {
                inCodeBlock = true;
            }
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
    card.classList.add('active');
    currentActiveFolder = folderName;
    targetFolderDisplay.textContent = `当前选中：${folderName}`;
    dropzone.classList.remove('disabled');
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
                <div class="folder-name" title="点击重命名">${folder.name}</div>
                <button class="visibility-toggle ${folder.showInNav ? 'is-on' : 'is-off'}" type="button">
                    ${folder.showInNav ? '导航显示' : '导航隐藏'}
                </button>
            `;

            header.querySelector('.folder-name').onclick = event => {
                event.stopPropagation();
                const newName = prompt('重命名章节', folder.name);
                if (newName) renameItem(folder.name, newName);
            };

            header.querySelector('.visibility-toggle').onclick = async event => {
                event.stopPropagation();
                const result = await postJson('/api/toggle-folder-nav', {
                    folder: folder.name,
                    showInNav: !folder.showInNav
                });
                if (result.success) {
                    showToast(!folder.showInNav ? `已显示章节：${folder.title || folder.name}` : `已隐藏章节：${folder.title || folder.name}`);
                    loadFolders();
                } else {
                    showToast(`切换章节显示失败：${result.error || '未知错误'}`, true);
                }
            };

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
                        <span class="sub-item-label">${file.title || file.filename}</span>
                        <button class="visibility-toggle ${file.visible ? 'is-on' : 'is-off'}" type="button">
                            ${file.visible ? '页面显示' : '页面隐藏'}
                        </button>
                    `;
                    item.onclick = event => {
                        if (event.target.closest('.visibility-toggle')) return;
                        event.stopPropagation();
                        const newName = prompt('重命名文件', file.filename);
                        if (newName) renameItem(file.filename, newName, folder.name);
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
                if (!event.target.classList.contains('sub-item')) {
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
    const projectName = prompt('请输入导出项目文件夹名', 'Final_Project');
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

clearDistBtn.addEventListener('click', async () => {
    if (!confirm('确定要清空 dist 文件夹吗？')) return;

    const res = await fetch('/api/clear-dist', { method: 'POST' });
    if ((await res.json()).success) {
        showToast('dist 已清理');
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

loadFolders();
