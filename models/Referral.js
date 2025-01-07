const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Referral = sequelize.define('Referral', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    referrer_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    referred_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending'
    },
    points_awarded: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'points_awarded'
    }
  }, {
    tableName: 'referrals',
    underscored: true,
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  Referral.associate = (models) => {
    Referral.belongsTo(models.User, {
      foreignKey: 'referrer_id',
      as: 'referrer'
    });
    Referral.belongsTo(models.User, {
      foreignKey: 'referred_id',
      as: 'referred'
    });
  };

  return Referral;
};
