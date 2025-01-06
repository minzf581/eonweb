const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProxyNode extends Model {
    static associate(models) {
      ProxyNode.belongsTo(models.User, {
        foreignKey: 'userid'
      });
    }
  }

  ProxyNode.init({
    nodeId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'node_id'
    },
    userid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      field: 'userid'
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
      type: DataTypes.DATE,
      field: 'last_online'
    },
    lastOffline: {
      type: DataTypes.DATE,
      field: 'last_offline'
    },
    lastReport: {
      type: DataTypes.DATE,
      field: 'last_report'
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
    modelName: 'ProxyNode',
    tableName: 'proxy_nodes',
    underscored: false,
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  return ProxyNode;
};
