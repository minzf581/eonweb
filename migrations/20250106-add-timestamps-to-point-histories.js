'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('PointHistories');
    
    if (!tableInfo.createdAt) {
      await queryInterface.addColumn('PointHistories', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }

    if (!tableInfo.updatedAt) {
      await queryInterface.addColumn('PointHistories', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('PointHistories');
    
    if (tableInfo.createdAt) {
      await queryInterface.removeColumn('PointHistories', 'createdAt');
    }
    
    if (tableInfo.updatedAt) {
      await queryInterface.removeColumn('PointHistories', 'updatedAt');
    }
  }
};
