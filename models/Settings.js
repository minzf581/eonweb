const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String
    },
    referralPoints: {
        type: Number,
        default: 100,  // 有推荐码时的积分奖励
        required: true
    },
    baseReferralPoints: {
        type: Number,
        default: 50,   // 无推荐码时的基础积分
        required: true
    },
    dailyReferralLimit: {
        type: Number,
        default: 10,   // 每日推荐人数限制
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
