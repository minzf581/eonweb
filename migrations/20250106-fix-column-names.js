'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 修改 UserTasks 表中的列名大小写
    await queryInterface.renameColumn('UserTasks', 'taskId', 'TaskId');
    await queryInterface.renameColumn('UserTasks', 'userId', 'UserId');

    // 修改 NodeStatus 表中的列名大小写
    await queryInterface.renameColumn('NodeStatus', 'userId', 'UserId');
    await queryInterface.renameColumn('NodeStatus', 'proxyBackendId', 'ProxyBackendId');
  },

  down: async (queryInterface, Sequelize) => {
    // 恢复 UserTasks 表中的列名大小写
    await queryInterface.renameColumn('UserTasks', 'TaskId', 'taskId');
    await queryInterface.renameColumn('UserTasks', 'UserId', 'userId');

    // 恢复 NodeStatus 表中的列名大小写
    await queryInterface.renameColumn('NodeStatus', 'UserId', 'userId');
    await queryInterface.renameColumn('NodeStatus', 'ProxyBackendId', 'proxyBackendId');
  }
};
