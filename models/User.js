const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'company'
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    wechat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    whatsapp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 推荐码功能
    referral_code: {
        type: DataTypes.STRING(12),
        allowNull: true,
        unique: true
    },
    referred_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    referral_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_priority: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // 临时密码功能
    temp_password: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否正在使用临时密码'
    },
    temp_password_expires: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '临时密码过期时间'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});

// 验证密码
User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

// 返回安全的用户信息（不包含密码）
User.prototype.toSafeObject = function() {
    return {
        id: this.id,
        email: this.email,
        role: this.role,
        status: this.status,
        name: this.name,
        referral_code: this.referral_code,
        referral_count: this.referral_count,
        is_priority: this.is_priority,
        temp_password: this.temp_password,
        created_at: this.created_at
    };
};

// 生成推荐码
function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 生成临时密码
function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// 添加为模型的静态方法
User.generateReferralCode = generateReferralCode;
User.generateTempPassword = generateTempPassword;

module.exports = User;
module.exports.generateReferralCode = generateReferralCode;
module.exports.generateTempPassword = generateTempPassword;
