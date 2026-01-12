const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const verifyUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB for verification');

        const users = await User.find({});
        console.log('Users found:', users.map(u => u.username));

        const required = ['minhhieu', 'ngochuyen'];
        const missing = required.filter(u => !users.find(dbU => dbU.username === u));

        if (missing.length === 0) {
            console.log('All required users exist!');
        } else {
            console.log('Missing users:', missing);
            // We can try to seed them here if missing, but server.js should do it.
            // This script just checks.
            console.log('Please restart server.js to seed them.');
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

verifyUsers();
