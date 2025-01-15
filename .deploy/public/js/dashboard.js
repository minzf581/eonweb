class Dashboard {
    constructor() {
        this.authService = window.authService;
        this.init();
    }

    async init() {
        try {
            // 检查用户是否已登录
            if (!this.authService.isAuthenticated()) {
                this.authService.handleAuthRedirect();
                return;
            }
            
            await this.loadUserInfo();
            await Promise.all([
                this.loadTasks(),
                this.loadReferralData()
            ]);
            this.setupEventListeners();
            this.showDashboard();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
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
        // 用户搜索
        document.getElementById('userSearch')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // 任务相关事件
        const taskList = document.getElementById('taskList');
        if (taskList) {
            taskList.addEventListener('click', (e) => {
                const target = e.target;
                if (target.matches('.start-task-btn')) {
                    const taskId = target.dataset.taskId;
                    this.startTask(taskId);
                }
            });
        }
    }

    async loadTasks() {
        try {
            console.log('Loading tasks...');
            const token = this.authService.getToken();
            if (!token) {
                throw new Error('No auth token available');
            }

            const response = await fetch('/api/tasks', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load tasks');
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Failed to load tasks');
            }

            const tasks = result.data;
            console.log('Tasks loaded:', tasks);

            const taskList = document.getElementById('taskList');
            if (!taskList) {
                console.warn('Task list element not found');
                return;
            }

            taskList.innerHTML = tasks.map(task => `
                <div class="task-item ${task.completed ? 'completed' : ''}">
                    <h3>${task.title}</h3>
                    <p>${task.description}</p>
                    <div class="task-meta">
                        <span class="points">🏆 ${task.points} points</span>
                        <span class="type">${task.type}</span>
                    </div>
                    ${task.completed 
                        ? `<span class="completed-badge">✅ Completed</span>`
                        : `<button class="start-task-btn" data-task-id="${task.id}">Start Task</button>`
                    }
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading tasks:', error);
            throw error;
        }
    }

    async loadReferralData() {
        try {
            console.log('Loading referral data...');
            const token = this.authService.getToken();
            if (!token) {
                throw new Error('No auth token available');
            }

            const response = await fetch('/api/referral', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load referral data');
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Failed to load referral data');
            }

            const data = result.data;
            console.log('Referral data loaded:', data);

            // 更新推荐码显示
            const referralCodeElement = document.getElementById('referralCode');
            if (referralCodeElement) {
                referralCodeElement.textContent = data.referralCode || 'Not available';
            }

            // 更新推荐统计
            const statsElement = document.getElementById('referralStats');
            if (statsElement) {
                statsElement.innerHTML = `
                    <div class="stat-item">
                        <span class="stat-label">Total Referrals</span>
                        <span class="stat-value">${data.referralCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Points</span>
                        <span class="stat-value">${data.totalPoints}</span>
                    </div>
                `;
            }

            // 更新推荐用户列表
            const userListElement = document.getElementById('referredUsers');
            if (userListElement && data.referredUsers) {
                userListElement.innerHTML = data.referredUsers.map(user => `
                    <div class="referred-user">
                        <span class="user-email">${user.email}</span>
                        <span class="join-date">Joined: ${new Date(user.joinedAt).toLocaleDateString()}</span>
                        <span class="points-earned">Points: ${user.pointsEarned}</span>
                    </div>
                `).join('') || '<p>No referrals yet</p>';
            }
        } catch (error) {
            console.error('Error loading referral data:', error);
            throw error;
        }
    }

    async startTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authService.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to start task');
            }

            const result = await response.json();
            if (result.success) {
                // 重新加载任务列表以更新状态
                await this.loadTasks();
            } else {
                throw new Error(result.message || 'Failed to start task');
            }
        } catch (error) {
            console.error('Error starting task:', error);
            // 显示错误消息给用户
            alert('Failed to start task: ' + error.message);
        }
    }
}

// Initialize dashboard
const dashboard = new Dashboard();