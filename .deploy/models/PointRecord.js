const mongoose = require('mongoose');

const pointRecordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['REFERRAL', 'REFERRED', 'OTHER']
    },
    points: {
        type: Number,
        required: true
    },
    referralId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PointRecord', pointRecordSchema);
