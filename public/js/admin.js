// API Configuration
const API_BASE_URL = window.location.hostname.includes('appspot.com')
    ? 'https://eonhome-445809.et.r.appspot.com'
    : 'http://localhost:8081';

const authService = new AuthService();

async function initializeAdmin() {
    console.log('[Admin] Initializing admin interface');
    
    const user = await authService.getUser();
    if (!user || !user.isAdmin) {
        console.error('[Admin] Access denied: User is not admin');
        window.location.href = '/';
        return;
    }

    // Update UI with user info
    document.querySelector('.user-email').textContent = user.email;

    // Setup headers with auth token
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
    };

    // Load all admin data
    await loadAdminData(headers);
}

async function loadAdminData(headers) {
    try {
        console.log('[Admin] Loading admin data');
        await Promise.all([
            loadStats(headers),
            loadUsers(headers),
            loadTasks(headers),
            loadSettings(headers)
        ]);
        console.log('[Admin] Admin data loaded successfully');
    } catch (error) {
        console.error('[Admin] Error loading admin data:', error);
        if (error.status === 403) {
            console.log('[Admin] Access denied, redirecting to home');
            window.location.href = '/';
        }
    }
}

async function loadStats(headers) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers });
        if (!response.ok) throw response;
        const stats = await response.json();
        updateStats(stats);
    } catch (error) {
        console.error('[Admin] Error loading stats:', error);
        throw error;
    }
}

async function loadUsers(headers) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, { headers });
        if (!response.ok) throw response;
        const users = await response.json();
        updateUsers(users);
    } catch (error) {
        console.error('[Admin] Error loading users:', error);
        throw error;
    }
}

async function loadTasks(headers) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/tasks`, { headers });
        if (!response.ok) throw response;
        const tasks = await response.json();
        updateTasks(tasks);
    } catch (error) {
        console.error('[Admin] Error loading tasks:', error);
        throw error;
    }
}

async function loadSettings(headers) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/settings`, { headers });
        if (!response.ok) throw response;
        const settings = await response.json();
        updateSettings(settings);
    } catch (error) {
        console.error('[Admin] Error loading settings:', error);
        throw error;
    }
}

function refreshUsers() {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
    };
    loadUsers(headers);
}

function refreshTasks() {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
    };
    loadTasks(headers);
}

async function saveSettings() {
    const settings = {
        referralPoints: parseInt(document.getElementById('referralPoints').value),
        taskPoints: parseInt(document.getElementById('taskPoints').value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authService.getToken()}`
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');
        
        alert('设置已保存');
    } catch (error) {
        console.error('[Admin] Error saving settings:', error);
        alert('保存设置失败');
    }
}

function logout() {
    authService.logout();
}

async function addUser() {
    const email = prompt('请输入用户邮箱:');
    if (!email) return;

    const password = prompt('请输入用户密码:');
    if (!password) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authService.getToken()}`
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) throw new Error('Failed to add user');

        refreshUsers();
    } catch (error) {
        console.error('[Admin] Error adding user:', error);
        alert('添加用户失败');
    }
}

async function updateUser(userId, field, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authService.getToken()}`
            },
            body: JSON.stringify({ [field]: value })
        });

        if (!response.ok) throw new Error('Failed to update user');

        refreshUsers();
    } catch (error) {
        console.error('[Admin] Error updating user:', error);
        alert('更新用户失败');
    }
}

async function deleteUser(userId) {
    if (!confirm('确定要删除此用户吗？')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authService.getToken()}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete user');

        refreshUsers();
    } catch (error) {
        console.error('[Admin] Error deleting user:', error);
        alert('删除用户失败');
    }
}

async function updateTask(taskId, field, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authService.getToken()}`
            },
            body: JSON.stringify({ [field]: value })
        });

        if (!response.ok) throw new Error('Failed to update task');

        refreshTasks();
    } catch (error) {
        console.error('[Admin] Error updating task:', error);
        alert('更新任务失败');
    }
}

async function toggleTask(taskId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/tasks/${taskId}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authService.getToken()}`
            }
        });

        if (!response.ok) throw new Error('Failed to toggle task');

        refreshTasks();
    } catch (error) {
        console.error('[Admin] Error toggling task:', error);
        alert('切换任务状态失败');
    }
}

function updateStats(stats) {
    document.getElementById('totalUsers').textContent = stats.totalUsers;
    document.getElementById('activeUsers').textContent = stats.activeUsers;
    document.getElementById('totalTasks').textContent = stats.totalTasks;
    document.getElementById('completedTasks').textContent = stats.completedTasks;
}

function updateUsers(users) {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.email}</td>
            <td>${user.points}</td>
            <td>${user.referralCode}</td>
            <td>${user.isAdmin ? '是' : '否'}</td>
            <td>${new Date(user.createdAt).toLocaleString()}</td>
            <td>
                <button onclick="updateUser(${user.id}, 'points', prompt('输入新的积分:'))">
                    修改积分
                </button>
                <button onclick="updateUser(${user.id}, 'isAdmin', !${user.isAdmin})">
                    ${user.isAdmin ? '取消管理员' : '设为管理员'}
                </button>
                <button onclick="deleteUser(${user.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

function updateTasks(tasks) {
    const tbody = document.querySelector('#tasksTable tbody');
    tbody.innerHTML = tasks.map(task => `
        <tr>
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.points}</td>
            <td>${task.type}</td>
            <td>${task.verificationMethod}</td>
            <td>${task.status}</td>
            <td>
                <button onclick="updateTask(${task.id}, 'points', prompt('输入新的积分:'))">
                    修改积分
                </button>
                <button onclick="toggleTask(${task.id})">
                    ${task.status === 'active' ? '禁用' : '启用'}
                </button>
            </td>
        </tr>
    `).join('');
}

function updateSettings(settings) {
    document.getElementById('referralPoints').value = settings.referralPoints || 0;
    document.getElementById('taskPoints').value = settings.taskPoints || 0;
}

// Initialize admin interface when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAdmin);
