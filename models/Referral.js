const { Model, DataTypes } = require('sequelize');

class Referral extends Model {
    static associate(models) {
        // Define associations here if needed
        // This method will be called in models/index.js
        Referral.belongsTo(models.User, {
            as: 'referrer',
            foreignKey: 'referrerid'
        });
        Referral.belongsTo(models.User, {
            as: 'referred',
            foreignKey: 'referredid'
        });
    }
}

const initReferral = (sequelize) => {
    Referral.init({
        referrerid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        referredid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        pointsearned: {
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
        createdAt: 'createdat',
        updatedAt: 'updatedat',
        indexes: [
            {
                fields: ['referrerid']
            },
            {
                fields: ['referredid'],
                unique: true
            }
        ]
    });

    return Referral;
};

module.exports = initReferral;
