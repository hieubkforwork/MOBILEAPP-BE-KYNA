const express = require('express');
const app = express();
// const http = require('http'); // Not needed without socket.io
// const server = http.createServer(app);
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const cors = require('cors');
const connectDB = require('./db/connect');
require('dotenv').config();

const User = require('./models/User');
const job = require('./cron');
job.start();

const mongoose = require('mongoose');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Save Push Token Endpoint
app.post('/api/save-token', async (req, res) => {
    const { username, token } = req.body;
    try {
        if (!Expo.isExpoPushToken(token)) {
            console.error(`Push token ${token} is not valid Expo push token`);
            // return res.status(400).send('Invalid token'); // Be lenient
        }

        const user = await User.findOneAndUpdate(
            { username },
            { pushToken: token },
            { new: true }
        );
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Users (for counts)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        const counts = {};
        users.forEach(u => counts[u.username] = u.heartCount);
        res.json(counts);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Heart Action Endpoint
app.post('/api/heart', async (req, res) => {
    const { username } = req.body; // Username of SENDER
    try {
        // 1. Increment heart for sender
        const user = await User.findOneAndUpdate(
            { username },
            { $inc: { heartCount: 1 } },
            { new: true }
        );

        // 2. Find Partner to notify
        const partnerName = username === 'minhhieu' ? 'ngochuyen' : 'minhhieu';
        const partner = await User.findOne({ username: partnerName });

        if (partner && partner.pushToken && Expo.isExpoPushToken(partner.pushToken)) {

            // CHECK THRESHOLD: 5 minutes = 5 * 60 * 1000 ms
            const now = new Date();
            const lastSent = user.lastHeartNotificationSentAt ? new Date(user.lastHeartNotificationSentAt) : new Date(0);
            const timeDiff = now - lastSent;
            const threshold = 5 * 60 * 1000;

            if (timeDiff > threshold) {
                // 3. Send Push Notification
                const messages = [{
                    to: partner.pushToken,
                    sound: 'default',
                    title: '❤️ I miss you!',
                    body: `${user.displayName} đã thả tim!`,
                    data: {
                        type: 'HEART_UPDATE',
                        sender: user.username,
                        newCount: user.heartCount
                    },
                }];

                try {
                    let chunks = expo.chunkPushNotifications(messages);
                    for (let chunk of chunks) {
                        await expo.sendPushNotificationsAsync(chunk);
                    }
                    // Update user's last sent time
                    await User.findOneAndUpdate({ username }, { $set: { lastHeartNotificationSentAt: now } });
                    console.log(`Notification sent for ${username}`);
                } catch (error) {
                    console.error('Error sending push:', error);
                }
            } else {
                console.log(`Notification throttled for ${username}. Wait ${Math.ceil((threshold - timeDiff) / 1000)}s`);
            }
        }

        res.json({
            success: true,
            heartCount: user.heartCount,
            username: user.username
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/test-db', (req, res) => {
    const state = mongoose.connection.readyState;
    const status = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };
    res.json({
        state,
        status: status[state] || 'unknown',
        host: mongoose.connection.host,
        db: mongoose.connection.name
    });
});

// Seed Data & Start Server
const start = async () => {
    try {
        await connectDB(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Seed Users
        const usersToSeed = [
            { username: 'minhhieu', displayName: 'Minh Hiếu' },
            { username: 'ngochuyen', displayName: 'Ngọc Huyền' }
        ];

        for (const u of usersToSeed) {
            const exists = await User.findOne({ username: u.username });
            if (!exists) {
                await User.create(u);
                console.log(`Created user: ${u.username}`);
            }
        }

    } catch (error) {
        console.log('Failed to connect to DB');
        console.log(error);
    }
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
};

start();
// Socket.io removed
