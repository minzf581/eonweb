const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    points: {
        type: Number,
        default: 0
    },
    referralCode: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// 生成唯一的推荐码
userSchema.pre('save', async function(next) {
    if (!this.referralCode) {
        // 生成6位随机字母数字组合
        const generateCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        // 确保推荐码唯一
        let isUnique = false;
        let code;
        while (!isUnique) {
            code = generateCode();
            const existingUser = await this.constructor.findOne({ referralCode: code });
            if (!existingUser) {
                isUnique = true;
            }
        }
        this.referralCode = code;
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
