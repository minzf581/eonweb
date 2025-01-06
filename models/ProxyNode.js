const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProxyNode extends Model {
    static associate(models) {
      ProxyNode.hasMany(models.NodeStatus, {
        foreignKey: 'nodeid'
      });
    }
  }

  ProxyNode.init({
    nodeid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
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
    connections: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    uptime: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastonline: {
      type: DataTypes.DATE
    },
    lastoffline: {
      type: DataTypes.DATE
    },
    lastreport: {
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    modelName: 'ProxyNode',
    tableName: 'proxy_nodes',
    underscored: true,
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
  });

  return ProxyNode;
};
