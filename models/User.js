const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = sequelize.define('User', {
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
    isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    points: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    referralCode: {
        type: DataTypes.STRING,
        unique: true
    },
    referredBy: {
        type: DataTypes.STRING
    }
}, {
    hooks: {
        beforeCreate: async (user) => {
            // Hash password
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
            
            // Generate unique referral code
            if (!user.referralCode) {
                const generateCode = () => {
                    return crypto.randomBytes(3).toString('hex').toUpperCase();
                };
                user.referralCode = generateCode();
            }
        }
    }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
