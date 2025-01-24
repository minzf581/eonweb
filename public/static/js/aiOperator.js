// AI Operator Dashboard Functionality
class AiOperatorDashboard {
    constructor() {
        this.initializeWebSocket();
        this.initializeEventListeners();
        this.loadDashboardData();
        this.currentBalance = 0;
        this.notifications = [];
    }

    // WebSocket连接初始化
    initializeWebSocket() {
        this.ws = new WebSocket('wss://your-websocket-server/ws');
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch(data.type) {
                case 'TASK_UPDATE':
                    this.handleTaskUpdate(data.payload);
                    break;
                case 'BALANCE_UPDATE':
                    this.updateBalance(data.payload);
                    break;
                case 'NOTIFICATION':
                    this.addNotification(data.payload);
                    break;
            }
        };
    }

    // 事件监听器初始化
    initializeEventListeners() {
        // 任务提交
        document.getElementById('submitTaskBtn').addEventListener('click', () => this.submitTask());
        
        // 数据集搜索
        document.getElementById('searchDataset').addEventListener('input', (e) => this.searchDatasets(e.target.value));
        
        // 充值按钮
        document.getElementById('topUpBtn').addEventListener('click', () => this.showTopUpModal());
        
        // 通知中心
        document.getElementById('notificationBtn').addEventListener('click', () => this.toggleNotifications());
        
        // 任务过滤器
        document.querySelectorAll('.task-filter').forEach(filter => {
            filter.addEventListener('change', () => this.filterTasks());
        });
    }

    // 加载仪表盘数据
    async loadDashboardData() {
        try {
            const [accountData, taskData, datasetData] = await Promise.all([
                this.fetchAccountData(),
                this.fetchTaskData(),
                this.fetchDatasetData()
            ]);

            this.updateDashboardUI(accountData, taskData, datasetData);
        } catch (error) {
            this.showError('Failed to load dashboard data');
        }
    }

    // 提交计算任务
    async submitTask() {
        const taskForm = document.getElementById('taskForm');
        const formData = new FormData(taskForm);
        
        const taskData = {
            datasetId: formData.get('datasetId'),
            computationType: formData.get('computationType'),
            privacyTech: formData.get('privacyTech'),
            priority: formData.get('priority'),
            parameters: JSON.parse(formData.get('parameters'))
        };

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess('Task submitted successfully');
                this.updateTaskList(result.task);
            } else {
                throw new Error('Failed to submit task');
            }
        } catch (error) {
            this.showError('Failed to submit task: ' + error.message);
        }
    }

    // 搜索数据集
    async searchDatasets(query) {
        try {
            const response = await fetch(`/api/datasets/search?q=${encodeURIComponent(query)}`);
            const datasets = await response.json();
            this.updateDatasetList(datasets);
        } catch (error) {
            this.showError('Failed to search datasets');
        }
    }

    // 更新任务状态
    handleTaskUpdate(task) {
        const taskElement = document.querySelector(`#task-${task.id}`);
        if (taskElement) {
            taskElement.querySelector('.status').textContent = task.status;
            taskElement.querySelector('.progress').style.width = `${task.progress}%`;
            
            if (task.status === 'completed') {
                this.showSuccess(`Task ${task.id} completed`);
                this.loadTaskResults(task.id);
            } else if (task.status === 'failed') {
                this.showError(`Task ${task.id} failed`);
            }
        }
    }

    // 加载任务结果
    async loadTaskResults(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/results`);
            const results = await response.json();
            this.updateResultsUI(results);
        } catch (error) {
            this.showError('Failed to load task results');
        }
    }

    // 更新余额显示
    updateBalance(balance) {
        this.currentBalance = balance;
        document.getElementById('accountBalance').textContent = `${balance} Credits`;
    }

    // 显示充值模态框
    showTopUpModal() {
        const modal = document.getElementById('topUpModal');
        modal.style.display = 'block';
    }

    // 处理支付
    async processPayment(amount, method) {
        try {
            const response = await fetch('/api/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount,
                    method
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (method === 'google_pay') {
                    // 处理Google Pay支付
                    await this.handleGooglePay(result.paymentData);
                } else if (method === 'crypto') {
                    // 显示加密货币支付信息
                    this.showCryptoPayment(result.paymentAddress);
                }
            }
        } catch (error) {
            this.showError('Payment failed');
        }
    }

    // 添加通知
    addNotification(notification) {
        this.notifications.unshift(notification);
        this.updateNotificationUI();
        
        // 显示通知提示
        this.showToast(notification.message);
    }

    // 更新通知UI
    updateNotificationUI() {
        const container = document.getElementById('notificationList');
        container.innerHTML = this.notifications
            .map(n => `
                <div class="notification-item ${n.read ? '' : 'unread'}">
                    <div class="notification-content">
                        <span class="notification-title">${n.title}</span>
                        <span class="notification-message">${n.message}</span>
                        <span class="notification-time">${new Date(n.time).toLocaleString()}</span>
                    </div>
                </div>
            `).join('');
    }

    // UI辅助方法
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    // 更新仪表盘UI
    updateDashboardUI(accountData, taskData, datasetData) {
        // 更新账户信息
        this.updateBalance(accountData.balance);
        document.getElementById('activeTasksCount').textContent = taskData.activeTasks;
        document.getElementById('completedTasksCount').textContent = taskData.completedTasks;
        
        // 更新收藏的数据集
        const favoritesList = document.getElementById('favoriteDatasets');
        favoritesList.innerHTML = datasetData.favorites
            .map(dataset => `
                <div class="dataset-card">
                    <h3>${dataset.name}</h3>
                    <p>${dataset.description}</p>
                    <div class="dataset-meta">
                        <span>${dataset.size}</span>
                        <span>${dataset.price} Credits</span>
                    </div>
                </div>
            `).join('');
        
        // 更新最近的任务
        const recentTasks = document.getElementById('recentTasks');
        recentTasks.innerHTML = taskData.recent
            .map(task => `
                <div class="task-item">
                    <div class="task-info">
                        <span class="task-name">${task.name}</span>
                        <span class="task-status ${task.status}">${task.status}</span>
                    </div>
                    <div class="task-progress">
                        <div class="progress-bar">
                            <div class="progress" style="width: ${task.progress}%"></div>
                        </div>
                    </div>
                </div>
            `).join('');
    }
}

// 初始化仪表盘
const dashboard = new AiOperatorDashboard();
