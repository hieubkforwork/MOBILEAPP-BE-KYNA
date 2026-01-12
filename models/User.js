const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    heartCount: {
        type: Number,
        default: 0
    },
    pushToken: {
        type: String,
        default: null
    },
    lastHeartNotificationSentAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('User', UserSchema);
