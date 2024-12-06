const db = pool;

class TaskService {
    static async getAvailableTasks() {
        const [tasks] = await db.execute(
            'SELECT * FROM tasks WHERE status = "active"'
        );
        return tasks;
    }

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
}

module.exports = TaskService; 