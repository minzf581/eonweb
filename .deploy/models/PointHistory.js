const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class PointHistory extends Model {
        static associate(models) {
            // Define associations here if needed
            PointHistory.belongsTo(models.User, {
                foreignKey: 'userid',
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
        userid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            field: 'user_id'
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
        modelName: 'PointHistory',
        tableName: 'point_histories',
        underscored: false,
        timestamps: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    return PointHistory;
};
