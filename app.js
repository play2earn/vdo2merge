/**
 * Video Merger App
 * Merge multiple MP4 videos into one using FFmpeg.wasm
 */

// Global state
const state = {
    files: [],
    ffmpeg: null,
    isLoaded: false,
    isProcessing: false,
    mergedBlob: null
};

// DOM Elements
const elements = {
    dropZone: document.getElementById('dropZone'),
    browseBtn: document.getElementById('browseBtn'),
    fileInput: document.getElementById('fileInput'),
    fileListContainer: document.getElementById('fileListContainer'),
    fileList: document.getElementById('fileList'),
    fileCount: document.getElementById('fileCount'),
    clearBtn: document.getElementById('clearBtn'),
    actionsContainer: document.getElementById('actionsContainer'),
    mergeBtn: document.getElementById('mergeBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressTitle: document.getElementById('progressTitle'),
    progressStatus: document.getElementById('progressStatus'),
    progressBar: document.getElementById('progressBar'),
    progressPercent: document.getElementById('progressPercent'),
    previewContainer: document.getElementById('previewContainer'),
    previewVideo: document.getElementById('previewVideo'),
    downloadBtn: document.getElementById('downloadBtn'),
    newMergeBtn: document.getElementById('newMergeBtn')
};

// Initialize app
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupDropZone();
    setupFileInput();
    setupButtons();
    setupDragSort();
}

// ============================================
// Drop Zone Setup
// ============================================

function setupDropZone() {
    const { dropZone } = elements;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('active');
        }, false);
    });

    // Handle drop
    dropZone.addEventListener('drop', handleDrop, false);

    // Click to browse
    dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// ============================================
// File Input Setup
// ============================================

function setupFileInput() {
    const { fileInput, browseBtn } = elements;

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // Reset input
    });

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
}

async function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(file => {
        const isMP4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
        if (!isMP4) {
            showToast(`ไฟล์ "${file.name}" ไม่ใช่ไฟล์ MP4`, 'error');
        }
        return isMP4;
    });

    if (validFiles.length > 0) {
        // Wait for all files to be added (including thumbnail generation)
        await Promise.all(validFiles.map(file => addFile(file)));
        updateUI();
    }
}

async function addFile(file) {
    const fileData = {
        id: Date.now() + Math.random(),
        file: file,
        name: file.name,
        size: file.size,
        duration: null,
        thumbnail: null
    };

    // Get video metadata
    try {
        const metadata = await getVideoMetadata(file);
        fileData.duration = metadata.duration;
        fileData.thumbnail = metadata.thumbnail;
    } catch (error) {
        console.warn('Could not get video metadata:', error);
    }

    state.files.push(fileData);
}

function getVideoMetadata(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;

        const cleanup = () => {
            URL.revokeObjectURL(video.src);
            video.remove();
        };

        video.onloadedmetadata = () => {
            const duration = video.duration;

            // Seek to get thumbnail
            video.currentTime = Math.min(1, duration / 2);
        };

        video.onseeked = () => {
            // Create thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 80;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

            cleanup();
            resolve({
                duration: video.duration,
                thumbnail: thumbnail
            });
        };

        video.onerror = () => {
            cleanup();
            reject(new Error('Could not load video'));
        };

        video.src = URL.createObjectURL(file);
    });
}

// ============================================
// UI Updates
// ============================================

function updateUI() {
    const { files } = state;
    const hasFiles = files.length > 0;

    // Update file count
    elements.fileCount.textContent = files.length;

    // Show/hide sections
    elements.fileListContainer.classList.toggle('visible', hasFiles);
    elements.actionsContainer.classList.toggle('visible', hasFiles);

    // Enable/disable merge button
    elements.mergeBtn.disabled = files.length < 2;

    // Render file list
    renderFileList();
}

function renderFileList() {
    const { fileList } = elements;
    fileList.innerHTML = '';

    state.files.forEach((fileData, index) => {
        const item = createFileItem(fileData, index);
        fileList.appendChild(item);
    });
}

function createFileItem(fileData, index) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.id = fileData.id;
    item.draggable = true;

    const thumbnailHTML = fileData.thumbnail
        ? `<img src="${fileData.thumbnail}" alt="Thumbnail">`
        : `<div class="file-thumbnail-placeholder">🎬</div>`;

    const durationHTML = fileData.duration
        ? formatDuration(fileData.duration)
        : '--:--';

    item.innerHTML = `
        <div class="drag-handle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="16" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="8" y1="18" x2="16" y2="18"/>
            </svg>
        </div>
        <div class="file-thumbnail">${thumbnailHTML}</div>
        <div class="file-info">
            <div class="file-name">${fileData.name}</div>
            <div class="file-meta">
                <span>${formatFileSize(fileData.size)}</span>
                <span>${durationHTML}</span>
            </div>
        </div>
        <button class="file-remove" data-id="${fileData.id}" title="ลบไฟล์">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    // Remove button
    item.querySelector('.file-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(fileData.id);
    });

    return item;
}

function removeFile(id) {
    state.files = state.files.filter(f => f.id !== id);
    updateUI();
}

// ============================================
// Buttons Setup
// ============================================

function setupButtons() {
    elements.clearBtn.addEventListener('click', clearAllFiles);
    elements.mergeBtn.addEventListener('click', startMerge);
    elements.downloadBtn.addEventListener('click', downloadMergedVideo);
    elements.newMergeBtn.addEventListener('click', resetApp);
}

function clearAllFiles() {
    state.files = [];
    updateUI();
}

function resetApp() {
    state.files = [];
    state.mergedBlob = null;

    // Reset video
    elements.previewVideo.src = '';
    elements.previewVideo.load();

    // Hide sections
    elements.previewContainer.classList.remove('visible');
    elements.progressContainer.classList.remove('visible');

    // Show drop zone sections
    updateUI();
}

// ============================================
// Drag Sort
// ============================================

function setupDragSort() {
    const { fileList } = elements;
    let draggedItem = null;

    fileList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('file-item')) {
            draggedItem = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    fileList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('file-item')) {
            e.target.classList.remove('dragging');
            draggedItem = null;
        }
    });

    fileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(fileList, e.clientY);
        const draggable = document.querySelector('.dragging');

        if (draggable) {
            if (afterElement == null) {
                fileList.appendChild(draggable);
            } else {
                fileList.insertBefore(draggable, afterElement);
            }
        }
    });

    fileList.addEventListener('drop', (e) => {
        e.preventDefault();
        // Reorder state.files based on new DOM order
        const items = Array.from(fileList.querySelectorAll('.file-item'));
        const newOrder = items.map(item => item.dataset.id);

        state.files.sort((a, b) => {
            return newOrder.indexOf(String(a.id)) - newOrder.indexOf(String(b.id));
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.file-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ============================================
// Video Merging
// ============================================

async function startMerge() {
    if (state.files.length < 2) {
        showToast('กรุณาเลือกไฟล์อย่างน้อย 2 ไฟล์', 'error');
        return;
    }

    if (state.isProcessing) return;
    state.isProcessing = true;

    // Show progress
    elements.progressContainer.classList.add('visible');
    elements.actionsContainer.classList.remove('visible');
    elements.fileListContainer.classList.remove('visible');

    updateProgress('กำลังโหลด FFmpeg...', 'รอสักครู่...', 0);

    try {
        // Load FFmpeg if not already loaded
        if (!state.isLoaded) {
            await loadFFmpeg();
        }

        updateProgress('กำลังประมวลผล...', 'กำลังเตรียมไฟล์...', 10);

        // Write files to FFmpeg filesystem
        await writeFilesToFFmpeg();

        updateProgress('กำลังรวมวิดีโอ...', `รวม ${state.files.length} ไฟล์...`, 30);

        // Create concat file
        await createConcatFile();

        // Run merge
        await runMerge();

        updateProgress('เสร็จสิ้น!', 'รวมวิดีโอเสร็จแล้ว!', 100);

        // Show preview
        await showPreview();

    } catch (error) {
        console.error('Merge error:', error);
        showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        resetProgress();
    } finally {
        state.isProcessing = false;
    }
}

async function loadFFmpeg() {
    // Use global FFmpegWASM from UMD script
    const { FFmpeg } = FFmpegWASM;
    const { fetchFile } = FFmpegUtil;

    state.ffmpeg = new FFmpeg();

    state.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
    });

    state.ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100);
        updateProgress('กำลังรวมวิดีโอ...', `ประมวลผล ${percent}%`, 30 + (percent * 0.6));
    });

    // Load FFmpeg core from local files
    await state.ffmpeg.load({
        coreURL: '/lib/ffmpeg-core.js',
        wasmURL: '/lib/ffmpeg-core.wasm',
    });

    state.isLoaded = true;
}

async function writeFilesToFFmpeg() {
    const { fetchFile } = FFmpegUtil;

    for (let i = 0; i < state.files.length; i++) {
        const fileData = state.files[i];
        const inputName = `input${i}.mp4`;

        updateProgress('กำลังประมวลผล...', `กำลังโหลดไฟล์ ${i + 1}/${state.files.length}...`, 10 + (i / state.files.length * 20));

        await state.ffmpeg.writeFile(inputName, await fetchFile(fileData.file));
    }
}

async function createConcatFile() {
    // Create concat list file
    let concatList = '';
    for (let i = 0; i < state.files.length; i++) {
        concatList += `file 'input${i}.mp4'\n`;
    }

    await state.ffmpeg.writeFile('concat.txt', concatList);
}

async function runMerge() {
    // Use concat demuxer for fast concatenation
    await state.ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        '-movflags', '+faststart',
        'output.mp4'
    ]);
}

async function showPreview() {
    // Read output file
    const data = await state.ffmpeg.readFile('output.mp4');
    state.mergedBlob = new Blob([data.buffer], { type: 'video/mp4' });

    // Create preview URL
    const url = URL.createObjectURL(state.mergedBlob);
    elements.previewVideo.src = url;

    // Show preview section
    elements.progressContainer.classList.remove('visible');
    elements.previewContainer.classList.add('visible');

    showToast('รวมวิดีโอเสร็จแล้ว! 🎉', 'success');
}

function updateProgress(title, status, percent) {
    elements.progressTitle.textContent = title;
    elements.progressStatus.textContent = status;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressPercent.textContent = `${Math.round(percent)}%`;
}

function resetProgress() {
    elements.progressContainer.classList.remove('visible');
    elements.actionsContainer.classList.add('visible');
    elements.fileListContainer.classList.add('visible');
}

// ============================================
// Download
// ============================================

function downloadMergedVideo() {
    if (!state.mergedBlob) {
        showToast('ไม่มีไฟล์สำหรับดาวน์โหลด', 'error');
        return;
    }

    const url = URL.createObjectURL(state.mergedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged_video_${formatDate(new Date())}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('กำลังดาวน์โหลด...', 'success');
}

// ============================================
// Utility Functions
// ============================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}_${h}${min}`;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
