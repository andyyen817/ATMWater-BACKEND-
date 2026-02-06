require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const RenrenCard = require('./src/models/RenrenCard');
const User = require('./src/models/User');

async function rebindCard() {
    try {
        await connectDB();

        // 查找用户 +868888
        const user = await User.findOne({ phoneNumber: '+868888' });
        if (!user) {
            console.error('User +868888 not found!');
            return;
        }
        console.log('Found user:', user._id);

        // 更新卡片绑定
        const card = await RenrenCard.findOne({ cardNo: 'B60590417' });
        if (!card) {
            console.error('Card B60590417 not found!');
            return;
        }

        console.log('Old localUserId:', card.localUserId);
        card.localUserId = user._id;
        await card.save();
        console.log('New localUserId:', card.localUserId);
        console.log('Card B60590417 has been rebound to user +868888');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

rebindCard();
