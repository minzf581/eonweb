const { Model, DataTypes } = require('sequelize');

class Referral extends Model {
    static associate(models) {
        // Define associations here if needed
        // This method will be called in models/index.js
    }
}

const initReferral = (sequelize) => {
    Referral.init({
        referrerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        referredId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        pointsEarned: {
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
        indexes: [
            {
                fields: ['referrerId']
            },
            {
                fields: ['referredId'],
                unique: true
            }
        ]
    });

    return Referral;
};

module.exports = initReferral;
