const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProxyNode extends Model {
    static associate(models) {
      ProxyNode.belongsTo(models.User, {
        foreignKey: 'userId'
      });
    }
  }

  ProxyNode.init({
    nodeId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: false
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('online', 'offline'),
      defaultValue: 'offline'
    },
    bandwidth: {
      type: DataTypes.BIGINT,
      defaultValue: 0
    },
    lastOnline: {
      type: DataTypes.DATE
    },
    lastOffline: {
      type: DataTypes.DATE
    },
    lastReport: {
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    modelName: 'ProxyNode',
    tableName: 'proxy_nodes',
    underscored: true,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return ProxyNode;
};
