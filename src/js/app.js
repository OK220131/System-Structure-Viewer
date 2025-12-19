// Application state
const AppState = {
    currentProject: null,
    projectName: null,
    diagramImage: null,
    areas: [],
    mode: 'edit', // 'edit' or 'view'
    savesPath: null,
    selectedArea: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    AppState.savesPath = await window.electronAPI.getAppPath();
    console.log('Saves path:', AppState.savesPath);

    // Initialize UI
    initializeUI();
    loadRecentProjects();
    updateStatus('準備完了');
});

// Initialize UI event listeners
function initializeUI() {
    // Project buttons
    document.getElementById('newProjectBtn').addEventListener('click', showProjectNameModal);
    document.getElementById('openProjectBtn').addEventListener('click', openProject);
    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);

    // Mode toggle
    document.getElementById('editModeBtn').addEventListener('click', () => setMode('edit'));
    document.getElementById('viewModeBtn').addEventListener('click', () => setMode('view'));

    // Toolbar
    document.getElementById('uploadImageBtn').addEventListener('click', uploadImage);
    const clearBtn = document.getElementById('clearAreasBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllAreas);
    }

    // Project name modal
    document.getElementById('closeProjectModalBtn').addEventListener('click', hideProjectNameModal);
    document.getElementById('cancelProjectBtn').addEventListener('click', hideProjectNameModal);
    document.getElementById('createProjectBtn').addEventListener('click', createNewProjectFromModal);
    document.getElementById('projectNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createNewProjectFromModal();
        }
    });

    // Project list modal
    document.getElementById('closeProjectListBtn').addEventListener('click', () => {
        document.getElementById('projectListModal').classList.remove('active');
    });
}

// Show project name modal
function showProjectNameModal() {
    const modal = document.getElementById('projectNameModal');
    const input = document.getElementById('projectNameInput');
    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 100);
}

// Hide project name modal
function hideProjectNameModal() {
    const modal = document.getElementById('projectNameModal');
    modal.classList.remove('active');
}

// Create new project from modal
async function createNewProjectFromModal() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) {
        alert('プロジェクト名を入力してください');
        return;
    }

    AppState.projectName = name;
    AppState.areas = [];
    AppState.diagramImage = null;
    AppState.currentProject = null;

    updateProjectDisplay();
    updateStatus(`新規プロジェクト「${name}」を作成しました`);
    document.getElementById('saveProjectBtn').disabled = false;

    // Clear canvas
    if (window.CanvasManager) {
        window.CanvasManager.clearCanvas();
    }

    hideProjectNameModal();
}

// Open existing project
async function openProject() {
    try {
        const result = await window.electronAPI.readDirectory(AppState.savesPath);

        if (!result.success) {
            alert('プロジェクトフォルダの読み込みに失敗しました');
            return;
        }

        if (result.files.length === 0) {
            alert('保存されたプロジェクトがありません');
            return;
        }

        // Show project selection dialog
        const projectName = await showProjectSelectionDialog(result.files);
        if (!projectName) return;

        await loadProjectByName(projectName);
    } catch (error) {
        console.error('Error opening project:', error);
        alert('プロジェクトを開く際にエラーが発生しました');
    }
}

// Show project selection dialog
function showProjectSelectionDialog(projects) {
    return new Promise((resolve) => {
        const modal = document.getElementById('projectListModal');
        const container = document.getElementById('projectListContainer');
        const closeBtn = document.getElementById('closeProjectListBtn');

        // Clear container
        container.innerHTML = '';

        // Create list items
        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.innerHTML = `
                <span class="icon">📁</span>
                <span class="name">${project}</span>
            `;
            item.style.marginBottom = '8px';

            item.addEventListener('click', () => {
                modal.classList.remove('active');
                resolve(project);
            });

            container.appendChild(item);
        });

        // Handle close
        const closeHandler = () => {
            modal.classList.remove('active');
            resolve(null);
            closeBtn.removeEventListener('click', closeHandler);
        };
        closeBtn.addEventListener('click', closeHandler);

        // Show modal
        modal.classList.add('active');
    });
}

// Load project by name
async function loadProjectByName(projectName) {
    try {
        const configPath = window.electronAPI.path.join(AppState.savesPath, projectName, 'config.json');
        const result = await window.electronAPI.readFile(configPath);

        if (!result.success) {
            alert('設定ファイルの読み込みに失敗しました');
            return;
        }

        const config = JSON.parse(result.content);
        AppState.projectName = config.projectName;
        AppState.diagramImage = config.diagramImage;
        AppState.areas = config.areas || [];
        AppState.currentProject = configPath;

        updateProjectDisplay();
        updateStatus(`プロジェクト「${projectName}」を読み込みました`);
        document.getElementById('saveProjectBtn').disabled = false;

        // Load diagram image
        if (config.diagramImage && window.CanvasManager) {
            await window.CanvasManager.loadImage(config.diagramImage);
        }

        // Redraw areas
        if (window.CanvasManager) {
            window.CanvasManager.redrawAreas();
        }
    } catch (error) {
        console.error('Error loading project:', error);
        alert('プロジェクトの読み込み中にエラーが発生しました');
    }
}

// Save project
async function saveProject() {
    if (!AppState.projectName) {
        alert('プロジェクト名が設定されていません');
        return;
    }

    if (!AppState.diagramImage) {
        alert('構造図がアップロードされていません');
        return;
    }

    try {
        const config = {
            projectName: AppState.projectName,
            diagramImage: AppState.diagramImage,
            areas: AppState.areas
        };

        const projectPath = window.electronAPI.path.join(AppState.savesPath, AppState.projectName);
        const configPath = window.electronAPI.path.join(projectPath, 'config.json');

        const result = await window.electronAPI.writeFile(configPath, JSON.stringify(config, null, 2));

        if (result.success) {
            AppState.currentProject = configPath;
            updateStatus(`プロジェクト「${AppState.projectName}」を保存しました`);
            loadRecentProjects();
        } else {
            alert('保存に失敗しました: ' + result.error);
        }
    } catch (error) {
        console.error('Error saving project:', error);
        alert('保存中にエラーが発生しました');
    }
}

// Upload diagram image
async function uploadImage() {
    try {
        const result = await window.electronAPI.openFileDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
            ]
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return;
        }

        const imagePath = result.filePaths[0];
        AppState.diagramImage = imagePath;

        if (window.CanvasManager) {
            await window.CanvasManager.loadImage(imagePath);
        }

        updateStatus('構造図を読み込みました');
        document.getElementById('saveProjectBtn').disabled = false;

        // Hide instructions
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.style.display = 'none';
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('画像の読み込み中にエラーが発生しました');
    }
}

// Set mode (edit/view)
function setMode(mode) {
    AppState.mode = mode;

    document.getElementById('editModeBtn').classList.toggle('active', mode === 'edit');
    document.getElementById('viewModeBtn').classList.toggle('active', mode === 'view');

    const canvasContainer = document.getElementById('canvasContainer');
    canvasContainer.classList.toggle('view-mode', mode === 'view');

    updateStatus(mode === 'edit' ? '編集モード' : '閲覧モード');

    if (window.CanvasManager) {
        window.CanvasManager.setMode(mode);
    }
}

// Clear all areas
function clearAllAreas() {
    if (!confirm('すべてのエリアを削除しますか？')) {
        return;
    }

    AppState.areas = [];
    updateAreaCount();

    if (window.CanvasManager) {
        window.CanvasManager.redrawAreas();
    }

    updateStatus('すべてのエリアを削除しました');
}

// Update project display
function updateProjectDisplay() {
    const nameEl = document.getElementById('currentProjectName');
    if (nameEl) {
        nameEl.textContent = AppState.projectName || '未選択';
    }
}

// Load recent projects
async function loadRecentProjects() {
    try {
        const result = await window.electronAPI.readDirectory(AppState.savesPath);

        if (!result.success || !result.files) {
            return;
        }

        const listEl = document.getElementById('recentProjectsList');
        if (!listEl) return;

        listEl.innerHTML = '';

        result.files.slice(0, 5).forEach(projectName => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.textContent = projectName;
            item.addEventListener('click', () => loadProjectByName(projectName));
            listEl.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading recent projects:', error);
    }
}

// Update area count
function updateAreaCount() {
    const countEl = document.getElementById('areaCount');
    if (countEl) {
        countEl.textContent = `エリア数: ${AppState.areas.length}`;
    }

    const clearBtn = document.getElementById('clearAreasBtn');
    if (clearBtn) {
        clearBtn.style.display = AppState.areas.length > 0 ? 'inline-flex' : 'none';
    }
}

// Update status message
function updateStatus(message) {
    const statusEl = document.getElementById('statusInfo');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

// Export for use in other modules
window.AppState = AppState;
window.updateAreaCount = updateAreaCount;
window.updateStatus = updateStatus;
