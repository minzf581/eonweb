const mongoose = require('mongoose');
require('dotenv').config();

const Task = require('../models/Task');

const defaultTasks = [
    {
        title: '推荐用户',
        description: '成功推荐一个新用户注册并完成任务',
        points: 100,
        type: 'one-time',
        isActive: true,
        requirements: ['Valid referral registration'],
        verificationMethod: 'automatic'
    },
    {
        title: '共享带宽',
        description: '共享您的网络带宽资源',
        points: 50,
        type: 'daily',
        isActive: true,
        requirements: ['Active network connection'],
        verificationMethod: 'automatic'
    }
];

async function createDefaultTasks() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 检查是否已存在任务
        const existingTasks = await Task.find({});
        if (existingTasks.length === 0) {
            // 创建默认任务
            await Task.insertMany(defaultTasks);
            console.log('Default tasks created successfully');
        } else {
            // 更新现有任务
            for (const task of defaultTasks) {
                await Task.findOneAndUpdate(
                    { title: task.title },
                    { ...task },
                    { upsert: true, new: true }
                );
                console.log(`Default task updated: ${task.title}`);
            }
        }
    } catch (error) {
        console.error('Error creating default tasks:', error);
    } finally {
        await mongoose.connection.close();
    }
}

createDefaultTasks();
