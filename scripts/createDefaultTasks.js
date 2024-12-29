const mongoose = require('mongoose');
require('dotenv').config();

const Task = require('../models/Task');

const defaultTasks = [
    {
        title: 'Referral Reward',
        description: 'Successfully refer a new user who registers and completes tasks',
        points: 100,
        type: 'one-time',
        isActive: true,
        requirements: ['Valid referral registration'],
        verificationMethod: 'automatic'
    },
    {
        title: 'Share Bandwidth',
        description: 'Share your network bandwidth resources',
        points: 50,
        type: 'daily',
        isActive: true,
        requirements: ['Active network connection'],
        verificationMethod: 'automatic'
    }
];

async function createDefaultTasks() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if tasks already exist
        const existingTasks = await Task.find({});
        if (existingTasks.length === 0) {
            // Create default tasks
            await Task.insertMany(defaultTasks);
            console.log('Default tasks created successfully');
        } else {
            // Update existing tasks
            for (const task of defaultTasks) {
                await Task.findOneAndUpdate(
                    { title: task.title },
                    { ...task },
                    { upsert: true, new: true }
                );
                console.log(`Default task updated: ${task.title}`);
            }
        }
    } catch (error) {
        console.error('Error creating default tasks:', error);
    } finally {
        mongoose.disconnect();
    }
}

createDefaultTasks();
