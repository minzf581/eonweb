const Task = require('../models/Task');
const UserTask = require('../models/UserTask');
const PointHistory = require('../models/PointHistory');

class TaskService {
    // Get all tasks (admin)
    static async getAllTasks() {
        return await Task.find({}).sort({ createdAt: -1 });
    }

    // Get available tasks (user)
    static async getAvailableTasks() {
        return await Task.find({ status: 'Active' }).sort({ createdAt: -1 });
    }

    // Toggle task status
    static async toggleTaskStatus(taskId) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        task.status = task.status === 'Active' ? 'Coming Soon' : 'Active';
        await task.save();
        return task;
    }

    // Get user task history
    static async getUserTaskHistory(userId) {
        return await UserTask.find({ userId }).sort({ createdAt: -1 });
    }

    // Create task
    static async createTask(taskData) {
        const task = new Task(taskData);
        await task.save();
        return task;
    }

    // Update task
    static async updateTask(taskId, updates) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        Object.assign(task, updates);
        await task.save();
        return task;
    }

    // Delete task
    static async deleteTask(taskId) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        await Task.deleteOne({ _id: taskId });
        // Clean up related data
        await UserTask.deleteMany({ taskId });
        await PointHistory.deleteMany({ taskId });
    }
}

module.exports = TaskService;