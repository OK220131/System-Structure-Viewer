// Preview Manager - Handles file preview popup
const PreviewManager = {
    popup: null,
    titleEl: null,
    contentEl: null,
    currentArea: null,
    hideTimeout: null,

    init() {
        this.popup = document.getElementById('previewPopup');
        this.titleEl = document.getElementById('previewTitle');
        this.contentEl = document.getElementById('previewContent');

        // Add key listener for interactive mode
        document.addEventListener('keydown', (e) => {
            // Ignore if input/textarea is focused (allow copy/paste)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                this.toggleInteractiveMode();
            }
            // Escape to close if interactive
            if (e.key === 'Escape' && this.isInteractive) {
                this.toggleInteractiveMode(false);
            }
        });
    },

    isInteractive: false,

    toggleInteractiveMode(forceState = null) {
        if (!this.currentArea && !this.popup.classList.contains('active')) return;

        this.isInteractive = forceState !== null ? forceState : !this.isInteractive;

        if (this.isInteractive) {
            this.popup.classList.add('fixed');
            this.titleEl.textContent += ' (固定モード - Escで解除)';
        } else {
            this.popup.classList.remove('fixed');
            // Restore original title
            if (this.currentArea) {
                this.titleEl.textContent = this.currentArea.label || this.currentArea.path;
            }
            // If mouse is not over area anymore, hide it
            this.hide();
        }
    },

    async show(area, mouseX, mouseY) {
        if (!area || !area.path) return;

        clearTimeout(this.hideTimeout);
        this.currentArea = area;

        // Set title
        this.titleEl.textContent = area.label || area.path;

        // Set loading state
        this.contentEl.innerHTML = '<div class="preview-loading">読み込み中...</div>';

        // Position popup
        this.updatePosition(mouseX, mouseY);

        // Show popup
        this.popup.classList.add('active');

        // Load content based on type
        if (area.type === 'url') {
            await this.loadUrlPreview(area.path);
        } else {
            await this.loadFilePreview(area.path);
        }
    },

    hide() {
        if (this.isInteractive) return; // Don't hide in interactive mode

        this.hideTimeout = setTimeout(() => {
            this.popup.classList.remove('active');
            this.currentArea = null;
        }, 100);
    },

    updatePosition(mouseX, mouseY) {
        const padding = 20;
        const popupWidth = 400;
        const popupHeight = 500;

        let left = mouseX + padding;
        let top = mouseY + padding;

        // Adjust if would go off screen
        if (left + popupWidth > window.innerWidth) {
            left = mouseX - popupWidth - padding;
        }

        if (top + popupHeight > window.innerHeight) {
            top = mouseY - popupHeight - padding;
        }

        // Ensure minimum position
        left = Math.max(padding, left);
        top = Math.max(padding, top);

        this.popup.style.left = left + 'px';
        this.popup.style.top = top + 'px';
    },

    async loadFilePreview(filePath) {
        try {
            // Check file type first
            try {
                const stats = await window.electronAPI.getFileStats(filePath);
                if (stats && stats.isDirectory) {
                    await this.loadDirectoryPreview(filePath);
                    return;
                }
            } catch (statError) {
                console.warn('Could not stat file:', filePath);
                // Continue as file if stat fails (might be a permission issue or race condition)
            }

            const ext = window.electronAPI.path.extname(filePath).toLowerCase();

            // Different preview based on file type
            if (['.txt', '.md', '.log'].includes(ext)) {
                await this.loadTextPreview(filePath, ext === '.md');
            } else if (['.py', '.js', '.html', '.css', '.java', '.cpp', '.c'].includes(ext)) {
                await this.loadCodePreview(filePath, ext);
            } else if (['.json', '.csv'].includes(ext)) {
                await this.loadDataPreview(filePath, ext);
            } else if (['.xlsx', '.xls', '.xlsm'].includes(ext)) {
                await this.loadExcelPreview(filePath);
            } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'].includes(ext)) {
                await this.loadImagePreview(filePath);
            } else if (['.docx', '.doc'].includes(ext)) {
                await this.loadWordPreview(filePath);
            } else if (['.pdf'].includes(ext)) {
                await this.loadPdfPreview(filePath);
            } else {
                this.showFileInfo(filePath);
            }
        } catch (error) {
            console.error('Error loading preview:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            this.contentEl.innerHTML = `<div class="preview-error">プレビューの読み込みに失敗しました: ${error.message}</div>`;
        }
    },

    async loadTextPreview(filePath, isMarkdown = false) {
        const result = await window.electronAPI.readFile(filePath);

        if (!result.success) {
            throw new Error(result.error);
        }

        const lines = result.content.split('\n').slice(0, 15);
        const preview = lines.join('\n');

        if (isMarkdown && typeof marked !== 'undefined') {
            this.contentEl.innerHTML = marked.parse(preview);
        } else {
            this.contentEl.innerHTML = `<pre><code>${this.escapeHtml(preview)}</code></pre>`;
        }
    },

    async loadCodePreview(filePath, ext) {
        const result = await window.electronAPI.readFile(filePath);

        if (!result.success) {
            throw new Error(result.error);
        }

        const lines = result.content.split('\n').slice(0, 15);
        const preview = lines.join('\n');

        const langMap = {
            '.py': 'python',
            '.js': 'javascript',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json'
        };

        const language = langMap[ext] || 'text';

        if (typeof Prism !== 'undefined') {
            const highlighted = Prism.highlight(preview, Prism.languages[language] || Prism.languages.text, language);
            this.contentEl.innerHTML = `<pre class="language-${language}"><code>${highlighted}</code></pre>`;
        } else {
            this.contentEl.innerHTML = `<pre><code>${this.escapeHtml(preview)}</code></pre>`;
        }
    },

    async loadExcelPreview(filePath) {
        try {
            const result = await window.electronAPI.readFileBinary(filePath);

            if (!result.success) {
                throw new Error(result.error);
            }

            if (typeof XLSX === 'undefined') {
                this.contentEl.innerHTML = '<div class="preview-error">Excel プレビューライブラリが読み込まれていません</div>';
                return;
            }

            // Convert base64 to binary
            const binary = atob(result.content);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const html = XLSX.utils.sheet_to_html(firstSheet, { header: '', editable: false });

            this.contentEl.innerHTML = `
        <div style="max-height: 400px; overflow: auto;">
          <strong>シート: ${workbook.SheetNames[0]}</strong>
          ${html}
        </div>
      `;
        } catch (error) {
            console.error('Excel preview error:', error);
            this.contentEl.innerHTML = `<div class="preview-error">Excelプレビューの読み込みに失敗しました</div>`;
        }
    },

    async loadWordPreview(filePath) {
        // Word files require special libraries (mammoth.js)
        // For now, just show file info
        this.showFileInfo(filePath);
    },

    async loadPdfPreview(filePath) {
        // PDF preview requires pdf.js
        // For now, just show file info
        this.showFileInfo(filePath);
    },

    async loadImagePreview(filePath) {
        try {
            const result = await window.electronAPI.readFileBinary(filePath);
            if (!result.success) throw new Error(result.error);

            const ext = window.electronAPI.path.extname(filePath).substring(1); // remove dot
            const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
            const src = `data:${mimeType};base64,${result.content}`;

            this.contentEl.innerHTML = `<img src="${src}" class="preview-image" alt="Preview">`;
        } catch (error) {
            console.error('Image preview error:', error);
            this.contentEl.innerHTML = `<div class="preview-error">画像の読み込みに失敗しました</div>`;
        }
    },

    async loadDataPreview(filePath, ext) {
        try {
            // Use SheetJS for CSV to get easy table parsing
            // For JSON, we can also use SheetJS but pretty print is better for nested JSON

            if (ext === '.json') {
                const result = await window.electronAPI.readFile(filePath);
                if (!result.success) throw new Error(result.error);

                // Pretty print JSON
                try {
                    const json = JSON.parse(result.content);
                    const formatted = JSON.stringify(json, null, 2);

                    if (typeof Prism !== 'undefined') {
                        const highlighted = Prism.highlight(formatted, Prism.languages.json, 'json');
                        this.contentEl.innerHTML = `<pre class="language-json"><code>${highlighted}</code></pre>`;
                    } else {
                        this.contentEl.innerHTML = `<pre><code>${this.escapeHtml(formatted)}</code></pre>`;
                    }
                } catch (e) {
                    // Invalid JSON, show as text
                    this.contentEl.innerHTML = `<pre><code>${this.escapeHtml(result.content)}</code></pre>`;
                }
            } else if (ext === '.csv') {
                // Use SheetJS
                await this.loadExcelPreview(filePath);
            }
        } catch (error) {
            console.error('Data preview error:', error);
            this.contentEl.innerHTML = `<div class="preview-error">データの読み込みに失敗しました</div>`;
        }
    },

    async showFileInfo(filePath) {
        try {
            const stats = await window.electronAPI.getFileStats(filePath);
            const basename = window.electronAPI.path.basename(filePath);
            const ext = window.electronAPI.path.extname(filePath);

            if (stats.success) {
                const size = this.formatFileSize(stats.stats.size);
                const modified = new Date(stats.stats.modified).toLocaleString('ja-JP');

                this.contentEl.innerHTML = `
          <div>
            <p><strong>ファイル名:</strong> ${basename}</p>
            <p><strong>形式:</strong> ${ext}</p>
            <p><strong>サイズ:</strong> ${size}</p>
            <p><strong>更新日時:</strong> ${modified}</p>
            <p style="margin-top: 16px; color: var(--text-muted);">
              このファイル形式のプレビューは対応していません。<br>
              クリックして開いてください。
            </p>
          </div>
        `;
            } else {
                this.contentEl.innerHTML = `<div class="preview-error">ファイル情報の取得に失敗しました</div>`;
            }
        } catch (error) {
            console.error('Error showing file info:', error);
            this.contentEl.innerHTML = `<div class="preview-error">ファイル情報の取得に失敗しました</div>`;
        }
    },

    async loadUrlPreview(url) {
        this.contentEl.innerHTML = `
      <div style="width:100%; height:100%; display:flex; flex-direction:column;">
        <div style="padding-bottom:8px; border-bottom: 1px solid var(--border-color); margin-bottom: 8px;">
            <p><strong>URL:</strong> <span style="word-break: break-all; color: var(--accent-primary); font-size: 12px;">${url}</span></p>
        </div>
        <div style="flex:1; border:1px solid var(--border-color); border-radius:4px; overflow:hidden; background:white;">
            <iframe src="${url}" style="width:100%; height:100%; border:none;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        </div>
        <p style="margin-top: 8px; color: var(--text-muted); font-size: 11px; text-align: center;">
          クリックしてデフォルトブラウザで開きます
        </p>
      </div>
    `;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PreviewManager.init();
});

// Export
window.PreviewManager = PreviewManager;
