const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class User extends Model {
    async comparePassword(password) {
        try {
            return await bcrypt.compare(password, this.password);
        } catch (error) {
            console.error('Password comparison error:', error);
            return false;
        }
    }

    toJSON() {
        const values = { ...this.get() };
        delete values.password;
        return values;
    }
}

User.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        allowNull: false,
        set(value) {
            // 只在密码发生变化时才进行哈希
            if (value) {
                const salt = bcrypt.genSaltSync(10);
                this.setDataValue('password', bcrypt.hashSync(value, salt));
            }
        }
    },
    referralCode: {
        type: DataTypes.STRING,
        unique: true
    },
    referredBy: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    points: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'User',
    hooks: {
        beforeCreate: async (user) => {
            // 生成唯一的推荐码
            if (!user.referralCode) {
                user.referralCode = crypto.randomBytes(4).toString('hex');
            }
        },
        beforeUpdate: async (user) => {
            // 不需要在这里进行密码哈希，因为已经在 setter 中处理了
        }
    }
});

module.exports = User;
