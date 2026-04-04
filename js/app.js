document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements - Prompts
    const promptListEl = document.getElementById('promptList');
    const addPromptBtn = document.getElementById('addPromptBtn');
    const promptModal = document.getElementById('promptModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const promptForm = document.getElementById('promptForm');
    const modalTitle = document.getElementById('modalTitle');
    const searchInput = document.getElementById('searchInput');
    const toast = document.getElementById('toast');
    const storageInfoEl = document.getElementById('storageInfo');

    // DOM Elements - Folders & Tags
    const folderTreeEl = document.getElementById('folderTree');
    const tagCloudEl = document.getElementById('tagCloud');
    const currentViewTitleEl = document.getElementById('currentViewTitle');
    const activeFiltersEl = document.getElementById('activeFilters');
    
    // DOM Elements - Theme & Variables
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const variableModal = document.getElementById('variableModal');
    const closeVariableModalBtn = document.getElementById('closeVariableModalBtn');
    const cancelVariableBtn = document.getElementById('cancelVariableBtn');
    const variableForm = document.getElementById('variableForm');
    const variableInputsContainer = document.getElementById('variableInputs');
    const promptPreview = document.getElementById('promptPreview');

    // ── Dark Mode Init ──
    const savedTheme = localStorage.getItem('promptbook-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.textContent = '☀️';
    }
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            themeToggleBtn.textContent = '🌙';
            localStorage.setItem('promptbook-theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggleBtn.textContent = '☀️';
            localStorage.setItem('promptbook-theme', 'dark');
        }
    });

    // DOM Elements - Folder Modal
    const addFolderBtn = document.getElementById('addFolderBtn');
    const folderModal = document.getElementById('folderModal');
    const closeFolderModalBtn = document.getElementById('closeFolderModalBtn');
    const cancelFolderBtn = document.getElementById('cancelFolderBtn');
    const folderForm = document.getElementById('folderForm');
    const folderModalTitle = document.getElementById('folderModalTitle');
    
    // Form inputs - Prompt
    const promptIdInput = document.getElementById('promptId');
    const promptTitleInput = document.getElementById('promptTitle');
    const promptContentInput = document.getElementById('promptContent');
    const promptTagsInput = document.getElementById('promptTags');
    const promptFolderInput = document.getElementById('promptFolder');

    // Form inputs - Folder
    const folderIdInput = document.getElementById('folderId');
    const folderNameInput = document.getElementById('folderName');
    const folderParentInput = document.getElementById('folderParent');

    // State
    let allPrompts = [];
    let allFolders = [];
    let currentFolderId = 'all'; // 'all', 'unassigned', or specific folder ID
    let activeTags = [];
    let searchQuery = '';

    // Initialize Database
    try {
        await window.db.initDB();
        await loadData();
    } catch (error) {
        console.error("Failed to initialize app:", error);
        alert("資料庫初始化失敗，請確保您的瀏覽器支援 IndexedDB。");
    }

    async function loadData() {
        try {
            const [promptsData, foldersData] = await Promise.all([
                window.db.getAllPrompts(),
                window.db.getAllFolders()
            ]);
            
            allPrompts = promptsData;
            allFolders = foldersData;
            
            updateStorageInfo();
            renderFolderTree();
            updateFolderSelects();
            renderTagCloud();
            applyFiltersAndRender();
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    // --- Folder Rendering & Logic ---
    function renderFolderTree() {
        // Keep fixed items
        const fixedItems = `
            <div class="folder-item ${currentFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
                <span class="folder-icon">📚</span>
                <span class="folder-name">所有提示詞</span>
            </div>
            <div class="folder-item ${currentFolderId === 'unassigned' ? 'active' : ''}" data-folder-id="unassigned">
                <span class="folder-icon">📁</span>
                <span class="folder-name">未分類</span>
            </div>
        `;
        
        folderTreeEl.innerHTML = fixedItems;

        // Build tree structure
        const rootFolders = allFolders.filter(f => !f.parentId);
        
        rootFolders.forEach(folder => {
            const folderHtml = buildFolderHtml(folder);
            folderTreeEl.insertAdjacentHTML('beforeend', folderHtml);
        });

        // Attach event listeners
        document.querySelectorAll('.folder-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if(e.target.closest('.folder-actions')) return; // Ignore clicks on action buttons
                
                document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                currentFolderId = item.getAttribute('data-folder-id');
                
                // Update title
                if (currentFolderId === 'all') currentViewTitleEl.textContent = '所有提示詞';
                else if (currentFolderId === 'unassigned') currentViewTitleEl.textContent = '未分類';
                else {
                    const folder = allFolders.find(f => f.id === parseInt(currentFolderId));
                    currentViewTitleEl.textContent = folder ? folder.name : '未知資料夾';
                }
                
                applyFiltersAndRender();
            });
        });

        document.querySelectorAll('.edit-folder-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.closest('.folder-item').getAttribute('data-folder-id'));
                const folder = allFolders.find(f => f.id === id);
                if (folder) openFolderModal(folder);
            });
        });

        document.querySelectorAll('.delete-folder-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.closest('.folder-item').getAttribute('data-folder-id'));
                // Check if folder has prompts or subfolders
                const hasPrompts = allPrompts.some(p => parseInt(p.folderId) === id);
                const hasSubfolders = allFolders.some(f => parseInt(f.parentId) === id);
                
                if (hasSubfolders) {
                    alert('請先刪除或移動此資料夾下的所有子資料夾。');
                    return;
                }
                
                if (hasPrompts) {
                    if(!confirm('此資料夾內包含提示詞。刪除後，這些提示詞將被移至「未分類」。確定要刪除嗎？')) return;
                    
                    // Move prompts to unassigned
                    const promptsToUpdate = allPrompts.filter(p => parseInt(p.folderId) === id);
                    for (const p of promptsToUpdate) {
                        await window.db.updatePrompt(p.id, { folderId: 'unassigned' });
                    }
                } else {
                    if(!confirm('確定要刪除這個資料夾嗎？')) return;
                }

                try {
                    await window.db.deleteFolder(id);
                    if (currentFolderId == id) currentFolderId = 'all';
                    await loadData();
                    showToast('已刪除資料夾');
                } catch(err) {
                    console.error(err);
                    alert('刪除資料夾失敗');
                }
            });
        });
    }

    function buildFolderHtml(folder, depth = 0) {
        const subFolders = allFolders.filter(f => parseInt(f.parentId) === folder.id);
        const isActive = currentFolderId == folder.id ? 'active' : '';
        
        let html = `
            <div class="folder-item ${isActive}" data-folder-id="${folder.id}">
                <span class="folder-icon">📂</span>
                <span class="folder-name">${escapeHTML(folder.name)}</span>
                <div class="folder-actions">
                    <button class="folder-action-btn edit-folder-btn" title="編輯">✏️</button>
                    <button class="folder-action-btn delete-folder-btn" title="刪除">❌</button>
                </div>
            </div>
        `;
        
        if (subFolders.length > 0) {
            html += `<div class="sub-folders">`;
            subFolders.forEach(sub => {
                html += buildFolderHtml(sub, depth + 1);
            });
            html += `</div>`;
        }
        
        return html;
    }

    function updateFolderSelects() {
        let optionsHtml = '<option value="unassigned">未分類</option>';
        
        function buildOptions(folders, prefix = '') {
            folders.forEach(f => {
                optionsHtml += `<option value="${f.id}">${prefix}${escapeHTML(f.name)}</option>`;
                const sub = allFolders.filter(subF => parseInt(subF.parentId) === f.id);
                if(sub.length > 0) buildOptions(sub, prefix + '— ');
            });
        }
        
        const rootFolders = allFolders.filter(f => !f.parentId);
        buildOptions(rootFolders);
        
        promptFolderInput.innerHTML = optionsHtml;
        
        // For folder parent select, we add a "None" option
        let parentOptionsHtml = '<option value="">無 (最上層)</option>';
        function buildParentOptions(folders, prefix = '', currentFolderId = null) {
            folders.forEach(f => {
                // Prevent selecting itself or its children as parent
                if (f.id === currentFolderId) return; 
                parentOptionsHtml += `<option value="${f.id}">${prefix}${escapeHTML(f.name)}</option>`;
                const sub = allFolders.filter(subF => parseInt(subF.parentId) === f.id);
                if(sub.length > 0) buildParentOptions(sub, prefix + '— ', currentFolderId);
            });
        }
        
        // This needs to be called dynamically when editing a folder to pass the current ID
        folderParentInput.innerHTML = parentOptionsHtml; 
    }

    // --- Tag Logic ---
    function renderTagCloud() {
        const tagCounts = {};
        allPrompts.forEach(p => {
            if (p.tags) {
                const tags = p.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                tags.forEach(t => {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            }
        });

        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .map(entry => entry[0]);

        if (sortedTags.length === 0) {
            tagCloudEl.innerHTML = '<p class="empty-text">尚無標籤</p>';
            return;
        }

        tagCloudEl.innerHTML = sortedTags.map(tag => {
            const isActive = activeTags.includes(tag) ? 'active' : '';
            return `<span class="cloud-tag ${isActive}" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)} <small>(${tagCounts[tag]})</small></span>`;
        }).join('');

        document.querySelectorAll('.cloud-tag').forEach(tagEl => {
            tagEl.addEventListener('click', (e) => {
                const tag = e.currentTarget.getAttribute('data-tag');
                if (activeTags.includes(tag)) {
                    activeTags = activeTags.filter(t => t !== tag);
                } else {
                    activeTags.push(tag);
                }
                renderTagCloud(); // Re-render to update active states
                renderActiveFilters();
                applyFiltersAndRender();
            });
        });
    }

    function renderActiveFilters() {
        if (activeTags.length === 0) {
            activeFiltersEl.innerHTML = '';
            return;
        }
        
        activeFiltersEl.innerHTML = activeTags.map(tag => `
            <span class="filter-badge">
                #${escapeHTML(tag)} 
                <span class="filter-remove" data-tag="${escapeHTML(tag)}">&times;</span>
            </span>
        `).join('');

        document.querySelectorAll('.filter-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tag = e.target.getAttribute('data-tag');
                activeTags = activeTags.filter(t => t !== tag);
                renderTagCloud();
                renderActiveFilters();
                applyFiltersAndRender();
            });
        });
    }

    // --- Filtering & Rendering Prompts ---
    function applyFiltersAndRender() {
        let filtered = allPrompts;

        // 1. Folder Filter
        if (currentFolderId !== 'all') {
            filtered = filtered.filter(p => {
                // If unassigned, match 'unassigned' string or undefined/null
                if (currentFolderId === 'unassigned') {
                    return !p.folderId || p.folderId === 'unassigned';
                }
                // Otherwise match exact folder ID
                return parseInt(p.folderId) === parseInt(currentFolderId);
            });
        }

        // 2. Tag Filter
        if (activeTags.length > 0) {
            filtered = filtered.filter(p => {
                if (!p.tags) return false;
                const promptTags = p.tags.split(',').map(t => t.trim().toLowerCase());
                // Check if prompt has ALL active tags
                return activeTags.every(activeTag => promptTags.includes(activeTag));
            });
        }

        // 3. Search Query Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            // Handle #tag syntax in search bar
            if (query.startsWith('#') && query.length > 1) {
                 const searchTag = query.substring(1).trim();
                 filtered = filtered.filter(p => {
                    if (!p.tags) return false;
                    const promptTags = p.tags.split(',').map(t => t.trim().toLowerCase());
                    return promptTags.some(t => t.includes(searchTag));
                });
            } else {
                filtered = filtered.filter(prompt => {
                    const titleMatch = prompt.title.toLowerCase().includes(query);
                    const contentMatch = prompt.content.toLowerCase().includes(query);
                    return titleMatch || contentMatch;
                });
            }
        }

        // Sort: Pinned first, then by updatedAt descending
        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.updatedAt - a.updatedAt;
        });

        renderPrompts(filtered);
    }

    function renderPrompts(prompts) {
        promptListEl.innerHTML = '';
        
        if (prompts.length === 0) {
            promptListEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 40px; background: var(--white); border-radius: 8px;">
                    <p style="font-size: 48px; margin-bottom: 10px;">📭</p>
                    <p>沒有找到符合條件的提示詞。</p>
                </div>
            `;
            return;
        }

        prompts.forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            
            const tagsArray = prompt.tags ? prompt.tags.split(',').map(t => t.trim()).filter(t => t) : [];
            const tagsHtml = tagsArray.map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join('');
            
            const pinnedClass = prompt.isPinned ? 'pinned' : '';
            const pinIcon = prompt.isPinned ? '★' : '☆';

            const contentHtml = window.marked ? window.marked.parse(prompt.content) : escapeHTML(prompt.content);

            card.innerHTML = `
                <div class="prompt-card-header">
                    <h3>${escapeHTML(prompt.title)}</h3>
                    <button class="pin-btn ${pinnedClass}" data-id="${prompt.id}" title="${prompt.isPinned ? '取消釘選' : '釘選至頂部'}">${pinIcon}</button>
                </div>
                <div class="prompt-tags">${tagsHtml}</div>
                <div class="prompt-content">${contentHtml}</div>
                <div class="prompt-actions">
                    <button class="btn btn-secondary btn-small copy-btn" data-id="${prompt.id}">複製</button>
                    <button class="btn btn-magenta btn-small edit-btn" data-id="${prompt.id}">編輯</button>
                    <button class="btn btn-danger btn-small delete-btn" data-id="${prompt.id}">刪除</button>
                </div>
            `;
            
            promptListEl.appendChild(card);
        });

        attachCardEventListeners();
    }

    // --- Search Input ---
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        applyFiltersAndRender();
    });

    // --- Live Preview ---
    promptContentInput.addEventListener('input', () => updatePreview(promptContentInput.value));

    // --- General Event Listeners ---
    function attachCardEventListeners() {
        // Copy
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const prompt = allPrompts.find(p => p.id === id);
                if (!prompt) return;

                const content = prompt.content;
                const variables = extractVariables(content);

                if (variables.length > 0) {
                    currentTemplateContent = content;
                    variableInputsContainer.innerHTML = variables.map(v => `
                        <div class="form-group">
                            <label for="var_${escapeHTML(v)}">${escapeHTML(v)}</label>
                            <input type="text" id="var_${escapeHTML(v)}" name="${escapeHTML(v)}" required placeholder="請輸入 ${escapeHTML(v)}">
                        </div>
                    `).join('');
                    variableModal.classList.add('show');
                } else {
                    copyToClipboard(content);
                }
            });
        });

        // Edit
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const prompt = allPrompts.find(p => p.id === id);
                if (prompt) openModal(prompt);
            });
        });

        // Delete
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                if (confirm('確定要刪除這個提示詞嗎？')) {
                    try {
                        await window.db.deletePrompt(id);
                        await loadData();
                        showToast('已刪除提示詞');
                    } catch (error) {
                        console.error('Failed to delete:', error);
                    }
                }
            });
        });

        // Pin/Unpin
        document.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const prompt = allPrompts.find(p => p.id === id);
                if (prompt) {
                    try {
                        await window.db.updatePrompt(id, { isPinned: !prompt.isPinned });
                        await loadData(); // Reload to update sort and UI
                    } catch (err) {
                        console.error("Error toggling pin", err);
                    }
                }
            });
        });
    }

    // --- Modal Operations (Prompt) ---
    function updatePreview(content) {
        if (!promptPreview) return;
        promptPreview.innerHTML = window.marked ? window.marked.parse(content || '') : escapeHTML(content || '');
    }

    function openModal(prompt = null) {
        updateFolderSelects(); // Ensure options are up to date
        if (prompt) {
            modalTitle.textContent = '編輯提示詞';
            promptIdInput.value = prompt.id;
            promptTitleInput.value = prompt.title;
            promptContentInput.value = prompt.content;
            promptTagsInput.value = prompt.tags || '';
            promptFolderInput.value = prompt.folderId || 'unassigned';
        } else {
            modalTitle.textContent = '新增提示詞';
            promptForm.reset();
            promptIdInput.value = '';
            promptFolderInput.value = currentFolderId !== 'all' ? currentFolderId : 'unassigned';
        }
        updatePreview(promptContentInput.value);
        promptModal.classList.add('show');
    }

    function closeModal() {
        promptModal.classList.remove('show');
    }

    promptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const promptData = {
            title: promptTitleInput.value.trim(),
            content: promptContentInput.value.trim(),
            tags: promptTagsInput.value.trim(),
            folderId: promptFolderInput.value
        };
        
        const id = promptIdInput.value;
        
        try {
            if (id) {
                await window.db.updatePrompt(parseInt(id), promptData);
                showToast('提示詞已更新');
            } else {
                await window.db.addPrompt(promptData);
                showToast('提示詞已新增');
            }
            
            closeModal();
            await loadData();
        } catch (error) {
            console.error('Failed to save prompt:', error);
            alert('儲存失敗');
        }
    });

    // --- Modal Operations (Folder) ---
    function openFolderModal(folder = null) {
        // Rebuild parent options specifically for this modal to exclude self
        let parentOptionsHtml = '<option value="">無 (最上層)</option>';
        function buildParentOptions(folders, prefix = '', excludeId = null) {
            folders.forEach(f => {
                if (f.id === excludeId) return; 
                parentOptionsHtml += `<option value="${f.id}">${prefix}${escapeHTML(f.name)}</option>`;
                const sub = allFolders.filter(subF => parseInt(subF.parentId) === f.id);
                if(sub.length > 0) buildParentOptions(sub, prefix + '— ', excludeId);
            });
        }
        const rootFolders = allFolders.filter(f => !f.parentId);
        buildParentOptions(rootFolders, '', folder ? folder.id : null);
        folderParentInput.innerHTML = parentOptionsHtml;


        if (folder) {
            folderModalTitle.textContent = '編輯資料夾';
            folderIdInput.value = folder.id;
            folderNameInput.value = folder.name;
            folderParentInput.value = folder.parentId || '';
        } else {
            folderModalTitle.textContent = '新增資料夾';
            folderForm.reset();
            folderIdInput.value = '';
        }
        folderModal.classList.add('show');
    }

    function closeFolderModal() {
        folderModal.classList.remove('show');
    }

    folderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const parentIdValue = folderParentInput.value;
        const folderData = {
            name: folderNameInput.value.trim(),
        };
        if (parentIdValue) {
            folderData.parentId = parseInt(parentIdValue);
        }
        
        const id = folderIdInput.value;
        
        try {
            if (id) {
                await window.db.updateFolder(parseInt(id), folderData);
                showToast('資料夾已更新');
            } else {
                await window.db.addFolder(folderData);
                showToast('資料夾已新增');
            }
            
            closeFolderModal();
            await loadData();
        } catch (error) {
            console.error('Failed to save folder:', error);
            alert('儲存失敗');
        }
    });

    // --- Import / Export ---
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const resetDbBtn = document.getElementById('resetDbBtn');

    // --- Reset Database ---
    resetDbBtn.addEventListener('click', async () => {
        const promptCount = allPrompts.length;
        const folderCount = allFolders.length;

        // First confirmation
        const first = confirm(
            `⚠️ 重設資料庫\n\n` +
            `此操作將刪除所有資料：\n` +
            `• ${promptCount} 個提示詞\n` +
            `• ${folderCount} 個資料夾\n\n` +
            `確定要繼續嗎？`
        );
        if (!first) return;

        // Second confirmation
        const second = confirm(
            `🚨 最後確認\n\n` +
            `此操作【無法復原】，所有資料將永久刪除。\n\n` +
            `建議先使用「匯出」備份資料。\n\n` +
            `確定要清空資料庫嗎？`
        );
        if (!second) return;

        try {
            for (const p of allPrompts) await window.db.deletePrompt(p.id);
            for (const f of allFolders) await window.db.deleteFolder(f.id);

            currentFolderId = 'all';
            activeTags = [];
            searchQuery = '';

            await loadData();
            showToast('資料庫已重設完成');
        } catch (err) {
            console.error('Reset failed:', err);
            alert('重設失敗，請重新整理頁面後再試。');
        }
    });

    exportBtn.addEventListener('click', async () => {
        try {
            const exportData = {
                version: 1,
                timestamp: new Date().toISOString(),
                prompts: allPrompts,
                folders: allFolders
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `prompt-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('資料已成功匯出');
        } catch (err) {
            console.error('Export failed:', err);
            alert('匯出失敗');
        }
    });

    importBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data.prompts) || !Array.isArray(data.folders)) {
                    throw new Error("無效的備份檔案格式");
                }
                
                if (confirm(`即將匯入 ${data.folders.length} 個資料夾與 ${data.prompts.length} 個提示詞。\n\n建議：匯入前先備份現有資料。\n確定要繼續嗎？`)) {
                    
                    const clearExisting = confirm('【選項】是否要先清除現有所有的資料？\n\n- [確定]：覆蓋並清空現有資料\n- [取消]：將匯入資料附加在現有資料之後');
                    
                    if (clearExisting) {
                        for (const p of allPrompts) await window.db.deletePrompt(p.id);
                        for (const f of allFolders) await window.db.deleteFolder(f.id);
                    }
                    
                    const folderIdMap = {};
                    data.folders.sort((a, b) => a.id - b.id); // Ensure parents are created before children
                    
                    for (const f of data.folders) {
                        const oldId = f.id;
                        delete f.id; 
                        
                        if (f.parentId && folderIdMap[f.parentId]) {
                            f.parentId = folderIdMap[f.parentId];
                        } else if (f.parentId && !clearExisting) {
                            const existing = allFolders.find(ex => ex.id === f.parentId);
                            f.parentId = existing ? existing.id : null;
                        }
                        
                        const newId = await window.db.addFolder(f);
                        folderIdMap[oldId] = newId;
                    }
                    
                    for (const p of data.prompts) {
                        delete p.id;
                        if (p.folderId && p.folderId !== 'unassigned') {
                            if (folderIdMap[p.folderId]) {
                                p.folderId = folderIdMap[p.folderId].toString();
                            }
                        }
                        await window.db.addPrompt(p);
                    }
                    
                    await loadData();
                    showToast('資料匯入成功！');
                }
            } catch (err) {
                console.error('Import failed:', err);
                alert('匯入失敗：檔案格式不正確');
            }
            importFile.value = '';
        };
        reader.readAsText(file);
    });

    // --- Event Listeners UI ---
    addPromptBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    addFolderBtn.addEventListener('click', () => openFolderModal());
    closeFolderModalBtn.addEventListener('click', closeFolderModal);
    cancelFolderBtn.addEventListener('click', closeFolderModal);

    // --- Variable Modal Logic ---
    let currentTemplateContent = '';

    function extractVariables(text) {
        // Matches {{varName}} and [varName] (but NOT markdown links [text](url))
        const doubleBraceRegex = /\{\{([^}]+)\}\}/g;
        const bracketRegex = /\[([^\]]+)\](?!\()/g;
        const seen = new Set();
        const results = [];
        for (const m of text.matchAll(doubleBraceRegex)) {
            const name = m[1].trim();
            if (!seen.has(name)) { seen.add(name); results.push(name); }
        }
        for (const m of text.matchAll(bracketRegex)) {
            const name = m[1].trim();
            if (!seen.has(name)) { seen.add(name); results.push(name); }
        }
        return results;
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('已複製到剪貼簿');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('複製失敗');
        }
    }

    variableForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let finalContent = currentTemplateContent;
        const formData = new FormData(variableForm);
        for (let [key, value] of formData.entries()) {
            // Replace {{key}} format
            const doubleBraceRegex = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
            finalContent = finalContent.replace(doubleBraceRegex, value);
            // Replace [key] format (not followed by parenthesis)
            const bracketRegex = new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\](?!\\()`, 'g');
            finalContent = finalContent.replace(bracketRegex, value);
        }
        copyToClipboard(finalContent);
        variableModal.classList.remove('show');
    });

    closeVariableModalBtn.addEventListener('click', () => variableModal.classList.remove('show'));
    cancelVariableBtn.addEventListener('click', () => variableModal.classList.remove('show'));

    // --- Help Modal ---
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');

    helpBtn.addEventListener('click', () => helpModal.classList.add('show'));
    closeHelpModalBtn.addEventListener('click', () => helpModal.classList.remove('show'));

    window.addEventListener('click', (e) => {
        if (e.target === promptModal) closeModal();
        if (e.target === folderModal) closeFolderModal();
        if (e.target === variableModal) variableModal.classList.remove('show');
        if (e.target === helpModal) helpModal.classList.remove('show');
    });

    // Utilities
    async function updateStorageInfo() {
        if (!navigator.storage || !navigator.storage.estimate) return;
        try {
            const estimate = await navigator.storage.estimate();
            const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
            const quotaMB = estimate.quota
                ? (estimate.quota / (1024 * 1024)).toFixed(0)
                : null;
            const percent = estimate.quota
                ? ((estimate.usage / estimate.quota) * 100).toFixed(1)
                : null;
            storageInfoEl.textContent = quotaMB
                ? `已使用: ${usageMB} / ${quotaMB} MB (${percent}%)`
                : `已使用: ${usageMB} MB`;
        } catch (error) {
            console.warn(error);
        }
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});