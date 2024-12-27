const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class User extends Model {
    async comparePassword(password) {
        try {
            console.log('Comparing passwords...');
            console.log('Stored password hash:', this.password);
            const isMatch = await bcrypt.compare(password, this.password);
            console.log('Password match result:', isMatch);
            return isMatch;
        } catch (error) {
            console.error('Password comparison error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            throw error;
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
            try {
                if (value) {
                    console.log('Hashing password...');
                    const salt = bcrypt.genSaltSync(10);
                    const hashedPassword = bcrypt.hashSync(value, salt);
                    console.log('Password hashed successfully');
                    this.setDataValue('password', hashedPassword);
                }
            } catch (error) {
                console.error('Error hashing password:', error);
                throw error;
            }
        }
    },
    referralCode: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    referredBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
            try {
                console.log('Before create hook...');
                if (!user.referralCode) {
                    user.referralCode = crypto.randomBytes(4).toString('hex');
                    console.log('Generated referral code:', user.referralCode);
                }
            } catch (error) {
                console.error('Error in beforeCreate hook:', error);
                throw error;
            }
        }
    }
});

module.exports = User;
