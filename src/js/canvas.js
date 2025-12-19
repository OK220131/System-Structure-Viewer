// Canvas Manager for drawing and interaction
const CanvasManager = {
    canvas: null,
    ctx: null,
    image: null,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragEnd: { x: 0, y: 0 },
    hoveredArea: null,
    canvasOffset: { x: 0, y: 0 },

    init() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Event listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    },

    async loadImage(imagePath) {
        try {
            const result = await window.electronAPI.readFileBinary(imagePath);

            if (!result.success) {
                alert('画像の読み込みに失敗しました');
                return;
            }

            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.image = img;
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.draw();
                    this.updateCanvasOffset();
                    resolve();
                };
                img.onerror = reject;
                img.src = `data:image/png;base64,${result.content}`;
            });
        } catch (error) {
            console.error('Error loading image:', error);
            alert('画像の読み込み中にエラーが発生しました');
        }
    },

    draw() {
        if (!this.image) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.image, 0, 0);

        // Draw areas
        window.AppState.areas.forEach(area => {
            this.drawArea(area, area === this.hoveredArea);
        });
    },

    drawArea(area, isHovered) {
        const ctx = this.ctx;

        // Draw rectangle
        ctx.strokeStyle = isHovered ? '#00d9ff' : 'rgba(0, 217, 255, 0.6)';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.strokeRect(area.x, area.y, area.width, area.height);

        // Draw fill
        ctx.fillStyle = isHovered ? 'rgba(0, 217, 255, 0.15)' : 'rgba(0, 217, 255, 0.08)';
        ctx.fillRect(area.x, area.y, area.width, area.height);

        // Draw label if exists
        if (area.label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw background for label
            const textMetrics = ctx.measureText(area.label);
            const textWidth = textMetrics.width;
            const textHeight = 20;
            const textX = area.x + area.width / 2;
            const textY = area.y + area.height / 2;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(
                textX - textWidth / 2 - 8,
                textY - textHeight / 2,
                textWidth + 16,
                textHeight
            );

            ctx.fillStyle = '#ffffff';
            ctx.fillText(area.label, textX, textY);
        }
    },

    handleMouseDown(e) {
        if (window.AppState.mode !== 'edit' || !this.image) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.isDragging = true;
        this.dragStart = { x, y };
        this.dragEnd = { x, y };
    },

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (window.AppState.mode === 'edit' && this.isDragging) {
            // Update drag end position
            this.dragEnd = { x, y };

            // Show selection box
            const selectionBox = document.getElementById('selectionBox');
            const canvasRect = this.canvas.getBoundingClientRect();

            const minX = Math.min(this.dragStart.x, this.dragEnd.x);
            const minY = Math.min(this.dragStart.y, this.dragEnd.y);
            const width = Math.abs(this.dragEnd.x - this.dragStart.x);
            const height = Math.abs(this.dragEnd.y - this.dragStart.y);

            selectionBox.style.display = 'block';
            selectionBox.style.left = (canvasRect.left + minX) + 'px';
            selectionBox.style.top = (canvasRect.top + minY) + 'px';
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
        } else if (window.AppState.mode === 'view') {
            // Check hover for preview
            const hoveredArea = this.getAreaAtPosition(x, y);

            if (hoveredArea !== this.hoveredArea) {
                this.hoveredArea = hoveredArea;
                this.draw();

                if (hoveredArea && window.PreviewManager) {
                    window.PreviewManager.show(hoveredArea, e.clientX, e.clientY);
                } else if (window.PreviewManager) {
                    window.PreviewManager.hide();
                }
            }

            // Update preview position
            if (hoveredArea && window.PreviewManager) {
                window.PreviewManager.updatePosition(e.clientX, e.clientY);
            }
        }
    },

    handleMouseUp(e) {
        if (window.AppState.mode !== 'edit' || !this.isDragging) return;

        this.isDragging = false;

        // Hide selection box
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.display = 'none';

        // Calculate area bounds
        const minX = Math.min(this.dragStart.x, this.dragEnd.x);
        const minY = Math.min(this.dragStart.y, this.dragEnd.y);
        const width = Math.abs(this.dragEnd.x - this.dragStart.x);
        const height = Math.abs(this.dragEnd.y - this.dragStart.y);

        // Only create area if size is significant
        if (width > 10 && height > 10) {
            const newArea = {
                id: 'area_' + Date.now(),
                x: minX,
                y: minY,
                width: width,
                height: height,
                label: '',
                type: 'file',
                path: ''
            };

            window.AppState.areas.push(newArea);
            window.updateAreaCount();
            this.draw();

            // Open file association modal
            if (window.FileHandler) {
                window.FileHandler.openAssociationModal(newArea);
            }
        }
    },

    handleClick(e) {
        if (window.AppState.mode === 'view' && !this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const area = this.getAreaAtPosition(x, y);
            if (area && area.path) {
                this.openAreaTarget(area);
            }
        } else if (window.AppState.mode === 'edit' && !this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const area = this.getAreaAtPosition(x, y);
            if (area && window.FileHandler) {
                window.FileHandler.openAssociationModal(area);
            }
        }
    },

    handleMouseLeave() {
        if (this.hoveredArea) {
            this.hoveredArea = null;
            this.draw();

            if (window.PreviewManager) {
                window.PreviewManager.hide();
            }
        }
    },

    getAreaAtPosition(x, y) {
        // Check in reverse order (top areas first)
        for (let i = window.AppState.areas.length - 1; i >= 0; i--) {
            const area = window.AppState.areas[i];
            if (x >= area.x && x <= area.x + area.width &&
                y >= area.y && y <= area.y + area.height) {
                return area;
            }
        }
        return null;
    },

    async openAreaTarget(area) {
        if (area.type === 'url') {
            // Open URL in default browser
            await window.electronAPI.openExternal(area.path);
        } else if (area.type === 'file') {
            // Open file in default application
            await window.electronAPI.openExternal(area.path);
        }
    },

    updateCanvasOffset() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvasOffset = { x: rect.left, y: rect.top };
    },

    redrawAreas() {
        this.draw();
        window.updateAreaCount();
    },

    clearCanvas() {
        this.image = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        window.AppState.areas = [];
        window.updateAreaCount();
    },

    setMode(mode) {
        if (mode === 'view' && this.isDragging) {
            this.isDragging = false;
            const selectionBox = document.getElementById('selectionBox');
            selectionBox.style.display = 'none';
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    CanvasManager.init();
});

// Export
window.CanvasManager = CanvasManager;
