class Dashboard {
    constructor() {
        this.authService = window.authService;
        this.init();
    }

    async init() {
        // 检查用户是否已登录
        if (!this.authService.isAuthenticated()) {
            window.location.href = '/eonweb/public/auth/login.html';
            return;
        }
        
        await this.loadUserInfo();
        this.setupEventListeners();
        this.showDashboard();
    }

    async loadUserInfo() {
        const { user } = this.authService.getAuth();
        if (user) {
            document.querySelector('.username').textContent = user.email;
        }
    }

    showDashboard() {
        // 获取用户和管理员界面元素
        const userContent = document.querySelector('.dashboard-content');
        const adminContent = document.querySelector('.admin-section');

        if (this.authService.isAdmin()) {
            // 显示管理员界面，隐藏用户界面
            if (userContent) userContent.style.display = 'none';
            if (adminContent) adminContent.style.display = 'block';
        } else {
            // 显示用户界面，隐藏管理员界面
            if (userContent) userContent.style.display = 'block';
            if (adminContent) adminContent.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Task management
        document.getElementById('userSearch')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });
    }

    filterUsers(query) {
        // 实现用户筛选逻辑
    }
}

// Admin action functions
function openNewTaskModal() {
    const modalHtml = `
        <div class="modal" id="newTaskModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Create New Task</h2>
                    <button class="modal-close" onclick="closeModal('newTaskModal')">×</button>
                </div>
                <div class="form-group">
                    <label>Task ID</label>
                    <input type="number" id="taskId" min="1" placeholder="Enter task ID (positive integer)">
                    <span class="error-message" id="taskIdError"></span>
                </div>
                <div class="form-group">
                    <label>Task Name</label>
                    <input type="text" id="taskName" placeholder="Enter task name">
                    <span class="error-message" id="taskNameError"></span>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="taskDescription" placeholder="Enter task description"></textarea>
                    <span class="error-message" id="taskDescriptionError"></span>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="closeModal('newTaskModal')">Cancel</button>
                    <button class="btn-primary" onclick="validateAndSaveTask()">Create Task</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('newTaskModal').style.display = 'block';
}

function validateAndSaveTask() {
    // 重置所有错误消息
    clearErrors();

    let hasError = false;
    const taskId = document.getElementById('taskId').value;
    const taskName = document.getElementById('taskName').value.trim();
    const taskDescription = document.getElementById('taskDescription').value.trim();

    // 验证 Task ID
    if (!taskId) {
        showError('taskIdError', 'Task ID is required');
        hasError = true;
    } else if (!Number.isInteger(Number(taskId)) || Number(taskId) <= 0) {
        showError('taskIdError', 'Task ID must be a positive integer');
        hasError = true;
    }

    // 验证 Task Name
    if (!taskName) {
        showError('taskNameError', 'Task name is required');
        hasError = true;
    }

    // 验证 Description
    if (!taskDescription) {
        showError('taskDescriptionError', 'Description is required');
        hasError = true;
    }

    // 如果没有错误，保存任务
    if (!hasError) {
        saveNewTask();
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
}

function editTask(taskId) {
    // 编辑任务的模态框
    const modalHtml = `
        <div class="modal" id="editTaskModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Task</h2>
                    <button class="modal-close" onclick="closeModal('editTaskModal')">×</button>
                </div>
                <div class="form-group">
                    <label>Task Name</label>
                    <input type="text" id="editTaskName" value="Bandwidth Sharing">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="editTaskDescription">Share bandwidth to support AI data collection</textarea>
                </div>
                <div class="form-group">
                    <label>Points Rate</label>
                    <input type="number" id="editPointsRate" value="10">
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="closeModal('editTaskModal')">Cancel</button>
                    <button class="btn-primary" onclick="saveTaskEdit('${taskId}')">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('editTaskModal').style.display = 'block';
}

function toggleTaskStatus(taskId) {
    const statusSpan = event.target.closest('tr').querySelector('.status');
    if (statusSpan.textContent === 'Active') {
        statusSpan.textContent = 'Paused';
        statusSpan.className = 'status paused';
        event.target.textContent = '▶️';
    } else {
        statusSpan.textContent = 'Active';
        statusSpan.className = 'status active';
        event.target.textContent = '⏸️';
    }
}

function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        event.target.closest('tr').remove();
    }
}

function editUser(userId) {
    const modalHtml = `
        <div class="modal" id="editUserModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit User</h2>
                    <button class="modal-close" onclick="closeModal('editUserModal')">×</button>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="editUserName" value="John Doe">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="editUserEmail" value="john@example.com">
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="closeModal('editUserModal')">Cancel</button>
                    <button class="btn-primary" onclick="saveUserEdit('${userId}')">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('editUserModal').style.display = 'block';
}

function adjustPoints(userId) {
    const modalHtml = `
        <div class="modal" id="adjustPointsModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Adjust Points</h2>
                    <button class="modal-close" onclick="closeModal('adjustPointsModal')">×</button>
                </div>
                <div class="form-group">
                    <label>Points Adjustment</label>
                    <input type="number" id="pointsAdjustment" placeholder="Enter points (positive or negative)">
                </div>
                <div class="form-group">
                    <label>Reason</label>
                    <textarea id="adjustmentReason" placeholder="Enter reason for adjustment"></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="closeModal('adjustPointsModal')">Cancel</button>
                    <button class="btn-primary" onclick="savePointsAdjustment('${userId}')">Save</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('adjustPointsModal').style.display = 'block';
}

// Helper functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.remove();
}

function saveNewTask() {
    const id = document.getElementById('taskId').value;
    const name = document.getElementById('taskName').value.trim();
    const description = document.getElementById('taskDescription').value.trim();

    const newRow = `
        <tr>
            <td>${id}</td>
            <td>${name}</td>
            <td>${description}</td>
            <td>0</td>
            <td><span class="status active">Active</span></td>
            <td>
                <button class="btn-icon" onclick="editTask('${id}')">✏️</button>
                <button class="btn-icon" onclick="toggleTaskStatus('${id}')">⏸️</button>
                <button class="btn-icon" onclick="deleteTask('${id}')">🗑️</button>
            </td>
        </tr>
    `;
    document.getElementById('taskManagementList').insertAdjacentHTML('beforeend', newRow);
    closeModal('newTaskModal');
}

// Logout function
function logout() {
    window.authService.logout();
}

// Initialize dashboard
const dashboard = new Dashboard();

// Add these functions for user dashboard functionality
function startTask(taskId) {
    const button = event.target;
    const statusSpan = button.closest('tr').querySelector('.status');
    
    if (statusSpan.textContent === 'Not Started') {
        statusSpan.textContent = 'Running';
        statusSpan.className = 'status active';
        button.textContent = 'Stop Task';
        
        // Add points history entry
        addPointsHistoryEntry(taskId, 'Bandwidth Sharing', 'Running');
    } else {
        statusSpan.textContent = 'Not Started';
        statusSpan.className = 'status inactive';
        button.textContent = 'Start Task';
        
        // Add points history entry
        addPointsHistoryEntry(taskId, 'Bandwidth Sharing', 'Stopped');
    }
}

function addPointsHistoryEntry(taskId, taskName, status) {
    const now = new Date();
    const dateStr = now.toLocaleString();
    const points = status === 'Running' ? '+0' : '0';
    
    const newRow = `
        <tr>
            <td>${dateStr}</td>
            <td>${taskId}</td>
            <td>${taskName}</td>
            <td>${points}</td>
            <td><span class="status ${status.toLowerCase()}">${status}</span></td>
        </tr>
    `;
    
    const historyList = document.getElementById('pointsHistoryList');
    historyList.insertAdjacentHTML('afterbegin', newRow);
}