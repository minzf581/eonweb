const Task = require('../models/Task');
const UserTask = require('../models/UserTask');
const PointHistory = require('../models/PointHistory');

class TaskService {
    // 获取所有任务（管理员用）
    static async getAllTasks() {
        return await Task.find({}).sort({ createdAt: -1 });
    }

    // 获取可用任务（用户用）
    static async getAvailableTasks() {
        return await Task.find({ status: 'Active' }).sort({ createdAt: -1 });
    }

    // 切换任务状态
    static async toggleTaskStatus(taskId) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        task.status = task.status === 'Active' ? 'Coming Soon' : 'Active';
        await task.save();
        return task;
    }

    // 获取用户任务历史
    static async getUserTaskHistory(userId) {
        return await UserTask.find({ userId }).sort({ createdAt: -1 });
    }

    // 创建任务
    static async createTask(taskData) {
        const task = new Task(taskData);
        await task.save();
        return task;
    }

    // 更新任务
    static async updateTask(taskId, updates) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        Object.assign(task, updates);
        await task.save();
        return task;
    }

    // 删除任务
    static async deleteTask(taskId) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        await Task.deleteOne({ _id: taskId });
        // 清理相关数据
        await UserTask.deleteMany({ taskId });
        await PointHistory.deleteMany({ taskId });
    }
}

module.exports = TaskService;