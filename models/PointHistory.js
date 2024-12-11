const mongoose = require('mongoose');

const pointHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    points: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['earned', 'referral', 'bonus', 'deducted'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PointHistory', pointHistorySchema);
