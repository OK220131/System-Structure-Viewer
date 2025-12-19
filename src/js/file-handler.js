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

        // Browse file button
        document.getElementById('browseFileBtn').addEventListener('click', () => this.browseFile());

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
                properties: ['openFile'],
                filters: [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'] },
                    { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx', 'pptx', 'xlsx', 'xlsm', 'csv'] },
                    { name: 'Code', extensions: ['py', 'js', 'html', 'css', 'json', 'ipynb'] }
                ]
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }

            document.getElementById('filePath').value = result.filePaths[0];
        } catch (error) {
            console.error('Error browsing file:', error);
            alert('ファイル選択中にエラーが発生しました');
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
            alert('ラベルを入力してください');
            return;
        }

        if (!path) {
            alert(activeType === 'file' ? 'ファイルを選択してください' : 'URLを入力してください');
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
