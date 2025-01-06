const { Model, DataTypes } = require('sequelize');

class Referral extends Model {
    static associate(models) {
        // Define associations here if needed
        // This method will be called in models/index.js
        Referral.belongsTo(models.User, {
            as: 'referrer',
            foreignKey: 'referrer_id'
        });
        Referral.belongsTo(models.User, {
            as: 'referred',
            foreignKey: 'referred_id'
        });
    }
}

const initReferral = (sequelize) => {
    Referral.init({
        referrer_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        referred_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        points_earned: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed'),
            defaultValue: 'pending'
        }
    }, {
        sequelize,
        modelName: 'Referral',
        tableName: 'referrals',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['referrer_id']
            },
            {
                fields: ['referred_id'],
                unique: true
            }
        ]
    });

    return Referral;
};

module.exports = initReferral;
