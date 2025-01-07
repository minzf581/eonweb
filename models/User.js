const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    credits: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    referral_code: {
      type: DataTypes.STRING,
      unique: true
    },
    referred_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE
    },
    updated_at: {
      type: DataTypes.DATE
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    underscored: true,  // Use snake_case for auto-generated fields
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
        if (!user.referral_code) {
          user.referral_code = crypto.randomBytes(4).toString('hex');
        }
      }
    }
  });

  User.prototype.comparePassword = async function(password) {
    try {
      console.log('Comparing passwords...');
      console.log('Stored password hash:', this.password);
      const isMatch = await bcrypt.compare(password, this.password);
      console.log('Password match result:', isMatch);
      return isMatch;
    } catch (error) {
      console.error('Password comparison error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  };

  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password;
    return values;
  };

  User.associate = (models) => {
    // User's tasks
    User.hasMany(models.UserTask, {
      foreignKey: 'userid',
      as: 'userTasks'
    });
    
    // User's point history
    User.hasMany(models.PointHistory, {
      foreignKey: 'userid',
      as: 'pointHistory'
    });

    // Referral relationships
    User.hasMany(models.Referral, {
      foreignKey: 'referrer_id',
      as: 'referrals'  // Users I have referred
    });
    User.hasMany(models.Referral, {
      foreignKey: 'referred_id',
      as: 'referredUsers'  // Changed from referredBy to avoid naming collision
    });

    // Node status
    User.hasMany(models.NodeStatus, {
      foreignKey: 'userid',
      as: 'nodes'
    });
  };

  return User;
};
