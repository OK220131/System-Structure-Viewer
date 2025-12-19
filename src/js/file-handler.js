// File Handler - Manages file associations and modal
const FileHandler = {
    currentArea: null,
    modal: null,

    init() {
        this.modal = document.getElementById('fileAssociationModal');

        // Modal controls
        document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveAssociationBtn').addEventListener('click', () => this.saveAssociation());
        document.getElementById('deleteAreaBtn').addEventListener('click', () => this.deleteArea());

        // Type selector
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchType(e.target.dataset.type));
        });

        // Browse buttons
        document.getElementById('browseFileBtn').addEventListener('click', () => this.browseFile());
        document.getElementById('browseFolderBtn').addEventListener('click', () => this.browseFolder());

        // Close modal on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    },

    openAssociationModal(area) {
        this.currentArea = area;

        // Fill in existing data
        document.getElementById('areaLabel').value = area.label || '';
        document.getElementById('filePath').value = area.type === 'file' ? area.path : '';
        document.getElementById('urlPath').value = area.type === 'url' ? area.path : '';

        // Set type
        this.switchType(area.type || 'file');

        // Show modal
        this.modal.classList.add('active');
    },

    closeModal() {
        this.modal.classList.remove('active');
        this.currentArea = null;
    },

    switchType(type) {
        // Update buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Show/hide inputs
        document.getElementById('fileInputGroup').style.display = type === 'file' ? 'block' : 'none';
        document.getElementById('urlInputGroup').style.display = type === 'url' ? 'block' : 'none';
    },

    async browseFile() {
        try {
            const result = await window.electronAPI.openFileDialog({
                title: 'リンクするファイルを選択',
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }

            const filePath = result.filePaths[0];
            document.getElementById('filePath').value = filePath;
            this.handleAutoLabel(filePath);
        } catch (error) {
            console.error('Error browsing file:', error);
            window.showAlert('ファイル選択中にエラーが発生しました');
        }
    },

    async browseFolder() {
        try {
            const result = await window.electronAPI.openFileDialog({
                properties: ['openDirectory']
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }

            const folderPath = result.filePaths[0];
            document.getElementById('filePath').value = folderPath;
            this.handleAutoLabel(folderPath);
        } catch (error) {
            console.error('Error browsing folder:', error);
            window.showAlert('フォルダ選択中にエラーが発生しました');
        }
    },

    handleAutoLabel(path) {
        if (document.getElementById('autoLabelCheck').checked) {
            // Get basename using the exposed path module
            const basename = window.electronAPI.path.basename(path);
            document.getElementById('areaLabel').value = basename;
        }
    },

    saveAssociation() {
        if (!this.currentArea) return;

        // Get values
        const label = document.getElementById('areaLabel').value.trim();
        const activeType = document.querySelector('.type-btn.active').dataset.type;

        let path = '';
        if (activeType === 'file') {
            path = document.getElementById('filePath').value.trim();
        } else {
            path = document.getElementById('urlPath').value.trim();
        }

        if (!label) {
            window.showAlert('ラベルを入力してください');
            return;
        }

        if (!path) {
            window.showAlert(activeType === 'file' ? 'ファイルを選択してください' : 'URLを入力してください');
            return;
        }

        // Update area
        this.currentArea.label = label;
        this.currentArea.type = activeType;
        this.currentArea.path = path;

        // Redraw
        if (window.CanvasManager) {
            window.CanvasManager.redrawAreas();
        }

        window.updateStatus(`エリア「${label}」を設定しました`);
        this.closeModal();
    },

    deleteArea() {
        if (!this.currentArea) return;

        if (!confirm('このエリアを削除しますか？')) {
            return;
        }

        // Find and remove area
        const index = window.AppState.areas.findIndex(a => a.id === this.currentArea.id);
        if (index !== -1) {
            window.AppState.areas.splice(index, 1);
        }

        // Redraw
        if (window.CanvasManager) {
            window.CanvasManager.redrawAreas();
        }

        window.updateStatus('エリアを削除しました');
        this.closeModal();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    FileHandler.init();
});

// Export
window.FileHandler = FileHandler;
