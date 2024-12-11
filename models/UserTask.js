const mongoose = require('mongoose');

const userTaskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    status: {
        type: String,
        enum: ['started', 'completed', 'failed'],
        default: 'started'
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    }
});

// 复合索引确保用户不能多次开始同一个任务
userTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.model('UserTask', userTaskSchema);
