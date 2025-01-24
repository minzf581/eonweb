const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, remove the enum constraint
    await queryInterface.sequelize.query('ALTER TABLE "Tasks" DROP CONSTRAINT IF EXISTS "Tasks_status_check"');

    // Then modify the column to use the new enum values
    await queryInterface.changeColumn('Tasks', 'status', {
      type: DataTypes.ENUM('active', 'completed', 'coming_soon'),
      defaultValue: 'coming_soon'
    });

    // Update existing records
    await queryInterface.sequelize.query(`
      UPDATE "Tasks" 
      SET status = CASE 
        WHEN status = 'Active' THEN 'active'
        WHEN status = 'Coming Soon' THEN 'coming_soon'
        ELSE status 
      END
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // First, remove the enum constraint
    await queryInterface.sequelize.query('ALTER TABLE "Tasks" DROP CONSTRAINT IF EXISTS "Tasks_status_check"');

    // Then revert back to the original enum values
    await queryInterface.changeColumn('Tasks', 'status', {
      type: DataTypes.ENUM('Active', 'Coming Soon'),
      defaultValue: 'Coming Soon'
    });

    // Update existing records back
    await queryInterface.sequelize.query(`
      UPDATE "Tasks" 
      SET status = CASE 
        WHEN status = 'active' THEN 'Active'
        WHEN status = 'coming_soon' THEN 'Coming Soon'
        ELSE status 
      END
    `);
  }
};
