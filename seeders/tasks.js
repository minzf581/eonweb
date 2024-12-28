const { Task } = require('../models');

async function seedTasks() {
    try {
        console.log('Seeding tasks...');

        const tasks = [
            {
                title: 'Referral Reward',
                description: 'Earn 100 points for each new user you refer to join our platform. Share your referral code and help grow our community!',
                points: 100,
                type: 'one-time',
                requirements: ['New user signs up using your referral code'],
                verificationMethod: 'automatic',
                isActive: true,
                status: 'active',
                startDate: new Date()
            },
            {
                title: 'Share Bandwidth',
                description: 'Share your bandwidth to support the network and earn 20 points daily. Help maintain network stability while earning rewards!',
                points: 20,
                type: 'daily',
                requirements: ['Keep the application running', 'Share bandwidth'],
                verificationMethod: 'automatic',
                isActive: true,
                status: 'active',
                startDate: new Date()
            }
        ];

        // Clear existing tasks
        await Task.destroy({ where: {} });

        // Create new tasks
        for (const task of tasks) {
            await Task.create(task);
            console.log(`Created task: ${task.title}`);
        }

        console.log('Tasks seeded successfully');
    } catch (error) {
        console.error('Error seeding tasks:', error);
        throw error;
    }
}

module.exports = seedTasks;
