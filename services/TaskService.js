const db = require('../config/database');

class TaskService {
    // 获取所有任务（管理员用）
    static async getAllTasks() {
        const [tasks] = await db.execute(
            'SELECT * FROM tasks ORDER BY created_at DESC'
        );
        return tasks;
    }

    // 获取可用任务（用户用）
    static async getAvailableTasks() {
        const [tasks] = await db.execute(
            'SELECT * FROM tasks WHERE status = "active"'
        );
        return tasks;
    }

    // 创建新任务
    static async createTask(taskData) {
        const { task_id, name, description, status = 'active' } = taskData;
        const [result] = await db.execute(
            'INSERT INTO tasks (task_id, name, description, status) VALUES (?, ?, ?, ?)',
            [task_id, name, description, status]
        );
        return result.insertId;
    }

    // 更新任务
    static async updateTask(taskId, taskData) {
        const { name, description, status } = taskData;
        const [result] = await db.execute(
            'UPDATE tasks SET name = ?, description = ?, status = ? WHERE id = ?',
            [name, description, status, taskId]
        );
        return result.affectedRows > 0;
    }

    // 删除任务
    static async deleteTask(taskId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 先删除用户任务关联
            await connection.execute(
                'DELETE FROM user_tasks WHERE task_id = ?',
                [taskId]
            );

            // 再删除积分历史
            await connection.execute(
                'DELETE FROM point_history WHERE task_id = ?',
                [taskId]
            );

            // 最后删除任务
            await connection.execute(
                'DELETE FROM tasks WHERE id = ?',
                [taskId]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 获取任务统计信息
    static async getTaskStats(taskId) {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(DISTINCT user_id) as total_users,
                SUM(points_earned) as total_points,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running_count
            FROM user_tasks
            WHERE task_id = ?
        `, [taskId]);
        return stats[0];
    }

    // 开始任务
    static async startTask(userId, taskId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 检查任务是否已经开始
            const [existing] = await connection.execute(
                'SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?',
                [userId, taskId]
            );

            if (existing.length === 0) {
                await connection.execute(
                    'INSERT INTO user_tasks (user_id, task_id, status, start_time) VALUES (?, ?, "running", NOW())',
                    [userId, taskId]
                );
            } else {
                await connection.execute(
                    'UPDATE user_tasks SET status = "running", last_update = NOW() WHERE user_id = ? AND task_id = ?',
                    [userId, taskId]
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 完成任务
    static async completeTask(userId, taskId, pointsEarned) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 更新用户任务状态
            await connection.execute(
                'UPDATE user_tasks SET status = "completed", points_earned = ?, last_update = NOW() WHERE user_id = ? AND task_id = ?',
                [pointsEarned, userId, taskId]
            );

            // 更新用户积分
            await connection.execute(
                'UPDATE users SET points = points + ? WHERE id = ?',
                [pointsEarned, userId]
            );

            // 记录积分历史
            await connection.execute(
                'INSERT INTO point_history (user_id, task_id, points, type, description) VALUES (?, ?, ?, "earned", "Task completion reward")',
                [userId, taskId, pointsEarned]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 获取用户的任务历史
    static async getUserTaskHistory(userId) {
        const [history] = await db.execute(`
            SELECT 
                t.name as task_name,
                ut.status,
                ut.points_earned,
                ut.start_time,
                ut.last_update
            FROM user_tasks ut
            JOIN tasks t ON ut.task_id = t.id
            WHERE ut.user_id = ?
            ORDER BY ut.last_update DESC
        `, [userId]);
        return history;
    }
}

module.exports = TaskService;