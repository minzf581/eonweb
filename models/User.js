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
    },
    isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'User',
    hooks: {
        async beforeCreate(user) {
            // Generate a unique referral code
            const generateReferralCode = () => {
                // Generate a 8-character random string
                return crypto.randomBytes(4).toString('hex').toUpperCase();
            };

            // Keep trying until we get a unique code
            let referralCode;
            let isUnique = false;
            while (!isUnique) {
                referralCode = generateReferralCode();
                // Check if this code already exists
                const existingUser = await User.findOne({ where: { referralCode } });
                if (!existingUser) {
                    isUnique = true;
                }
            }

            // Set the unique referral code
            user.referralCode = referralCode;
        }
    }
});

module.exports = User;
