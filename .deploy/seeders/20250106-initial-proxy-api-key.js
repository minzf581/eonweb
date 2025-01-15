'use strict';

const crypto = require('crypto');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const initialKey = crypto.randomBytes(32).toString('hex');
    console.log('Generated initial API key:', initialKey);
    
    await queryInterface.bulkInsert('ProxyApiKeys', [{
      key: initialKey,
      name: 'Initial API Key',
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('ProxyApiKeys', {
      name: 'Initial API Key'
    });
  }
};
