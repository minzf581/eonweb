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
        referrerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            field: 'referrer_id'
        },
        referredId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id'
            },
            field: 'referred_id'
        },
        pointsEarned: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'points_earned'
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed'),
            defaultValue: 'pending'
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
        modelName: 'Referral',
        tableName: 'referrals',
        underscored: false,
        timestamps: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    return Referral;
};

module.exports = initReferral;
