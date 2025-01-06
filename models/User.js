const { Model, DataTypes } = require('sequelize');
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

    static associate(models) {
        User.hasMany(models.UserTask, {
            foreignKey: 'userid',
            as: 'tasks'
        });
    }
}

const initUser = (sequelize) => {
    User.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
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
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        credits: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        isAdmin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_admin'
        },
        referralCode: {
            type: DataTypes.STRING,
            unique: true,
            field: 'referral_code'
        },
        referredBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'referred_by'
        },
        lastLoginAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login_at'
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'deleted_at'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        underscored: false,
        timestamps: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
                if (!user.referralCode) {
                    user.referralCode = crypto.randomBytes(4).toString('hex');
                }
            }
        }
    });

    return User;
};

module.exports = initUser;
