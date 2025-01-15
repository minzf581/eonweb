// 数据管理功能模块
class DataManagement {
    constructor() {
        this.encryptionKey = null;
        this.initializeEventListeners();
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 文件上传相关
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // 初始化加密模块
        this.initializeEncryption();
    }

    // 初始化加密模块
    async initializeEncryption() {
        try {
            // 生成AES-256密钥
            const key = await window.crypto.subtle.generateKey(
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
            this.encryptionKey = key;
            this.showToast('Encryption module initialized', 'success');
        } catch (error) {
            console.error('Error initializing encryption:', error);
            this.showToast('Failed to initialize encryption', 'error');
        }
    }

    // 处理文件上传
    async handleFiles(files) {
        for (const file of files) {
            try {
                // 显示上传进度
                this.addToUploadQueue(file);
                
                // 加密文件
                const encryptedData = await this.encryptFile(file);
                
                // 上传到服务器
                await this.uploadToServer(encryptedData, file.name);
                
                // 更新UI
                this.updateUploadStatus(file.name, 'completed');
                
                // 添加到数据集列表
                this.addDatasetToList({
                    name: file.name,
                    size: file.size,
                    uploadDate: new Date(),
                    status: 'active'
                });
            } catch (error) {
                console.error('Error handling file:', error);
                this.updateUploadStatus(file.name, 'failed');
                this.showToast(`Failed to upload ${file.name}`, 'error');
            }
        }
    }

    // 加密文件
    async encryptFile(file) {
        try {
            const fileBuffer = await file.arrayBuffer();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                this.encryptionKey,
                fileBuffer
            );

            // 组合IV和加密数据
            const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
            combinedData.set(iv, 0);
            combinedData.set(new Uint8Array(encryptedData), iv.length);
            
            return combinedData;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt file');
        }
    }

    // 上传到服务器
    async uploadToServer(encryptedData, filename) {
        const formData = new FormData();
        formData.append('file', new Blob([encryptedData]), filename);
        formData.append('metadata', JSON.stringify({
            filename: filename,
            uploadDate: new Date(),
            encryptionType: 'AES-256-GCM'
        }));

        const response = await fetch('/api/data/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        return await response.json();
    }

    // UI更新方法
    addToUploadQueue(file) {
        const queueItem = document.createElement('div');
        queueItem.className = 'upload-item';
        queueItem.innerHTML = `
            <span>${file.name}</span>
            <div class="progress-bar">
                <div class="progress" style="width: 0%"></div>
            </div>
            <span class="status">Preparing...</span>
        `;
        document.getElementById('uploadQueue').appendChild(queueItem);
    }

    updateUploadStatus(filename, status) {
        const uploadItems = document.querySelectorAll('.upload-item');
        for (const item of uploadItems) {
            if (item.querySelector('span').textContent === filename) {
                item.querySelector('.status').textContent = status;
                item.querySelector('.progress').style.width = status === 'completed' ? '100%' : '0%';
                break;
            }
        }
    }

    addDatasetToList(dataset) {
        const dataList = document.getElementById('dataFiles');
        const dataItem = document.createElement('div');
        dataItem.className = 'data-item';
        dataItem.innerHTML = `
            <div class="data-info">
                <span class="data-name">${dataset.name}</span>
                <span class="data-size">${this.formatSize(dataset.size)}</span>
                <span class="data-date">${dataset.uploadDate.toLocaleDateString()}</span>
                <span class="data-status ${dataset.status}">${dataset.status}</span>
            </div>
            <div class="data-actions">
                <button onclick="dataManager.toggleDatasetStatus('${dataset.name}')">
                    <i class="fas fa-power-off"></i>
                </button>
                <button onclick="dataManager.editDataset('${dataset.name}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="dataManager.deleteDataset('${dataset.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        dataList.appendChild(dataItem);
    }

    // 辅助方法
    formatSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    // 数据集管理方法
    async toggleDatasetStatus(datasetName) {
        try {
            const response = await fetch(`/api/data/${datasetName}/toggle`, {
                method: 'POST'
            });
            if (response.ok) {
                this.showToast(`Dataset ${datasetName} status updated`, 'success');
                // 更新UI
            }
        } catch (error) {
            this.showToast('Failed to update dataset status', 'error');
        }
    }

    async editDataset(datasetName) {
        // 实现编辑数据集功能
    }

    async deleteDataset(datasetName) {
        if (confirm(`Are you sure you want to delete ${datasetName}?`)) {
            try {
                const response = await fetch(`/api/data/${datasetName}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    this.showToast(`Dataset ${datasetName} deleted`, 'success');
                    // 更新UI
                }
            } catch (error) {
                this.showToast('Failed to delete dataset', 'error');
            }
        }
    }
}

// 初始化数据管理器
const dataManager = new DataManagement();
