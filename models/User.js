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
            foreignKey: 'userid'
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
            allowNull: false,
            set(value) {
                if (!value) {
                    throw new Error('Password cannot be null');
                }
                console.log('Hashing password...');
                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync(value, salt);
                console.log('Password hashed successfully');
                this.setDataValue('password', hash);
            }
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'user'
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'active'
        },
        balance: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        referral_code: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
        },
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        is_admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        hooks: {
            beforeCreate: async (user) => {
                try {
                    console.log('Generating referral code...');
                    if (!user.referral_code) {
                        const randomBytes = crypto.randomBytes(4);
                        const referralCode = randomBytes.toString('hex').toUpperCase();
                        console.log('Generated referral code:', referralCode);
                        user.referral_code = referralCode;
                    }
                    // Generate username from email if not provided
                    if (!user.username) {
                        user.username = user.email.split('@')[0];
                    }
                } catch (error) {
                    console.error('Error in beforeCreate hook:', error);
                    throw error;
                }
            }
        }
    });

    return User;
};

module.exports = initUser;
