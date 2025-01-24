module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 检查并添加 created_at 列
      const hasCreatedAt = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'created_at'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (hasCreatedAt.length === 0) {
        await queryInterface.addColumn('user_tasks', 'created_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }, { transaction });
      }

      // 检查并添加 updated_at 列
      const hasUpdatedAt = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'updated_at'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (hasUpdatedAt.length === 0) {
        await queryInterface.addColumn('user_tasks', 'updated_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }, { transaction });
      }

      await transaction.commit();
      console.log('[Migration] Successfully added timestamp columns to user_tasks table');
    } catch (error) {
      await transaction.rollback();
      console.error('[Migration] Failed to add timestamp columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 我们不删除这些列，因为它们是必需的
      console.log('[Migration] Skipping removal of timestamp columns as they are required');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}; 