const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class PointHistory extends Model {
        static associate(models) {
            // Define associations here if needed
            PointHistory.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'user'
            });
        }
    }

    PointHistory.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        points: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('referral', 'task', 'bonus', 'bandwidth_sharing'),
            allowNull: false
        },
        metadata: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed'),
            defaultValue: 'completed'
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'PointHistory',
        tableName: 'PointHistories'
    });

    return PointHistory;
};
