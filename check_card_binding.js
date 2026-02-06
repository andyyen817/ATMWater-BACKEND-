require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const RenrenCard = require('./src/models/RenrenCard');
const User = require('./src/models/User');

async function checkBinding() {
    try {
        await connectDB();

        // 查找卡片 B60590417
        const card = await RenrenCard.findOne({ cardNo: 'B60590417' });
        console.log('=== Card B60590417 ===');
        console.log('Card found:', card ? 'YES' : 'NO');
        if (card) {
            console.log('Card details:', {
                cardNo: card.cardNo,
                localUserId: card.localUserId,
                balance: card.balance,
                realBalance: card.realBalance,
                lastSyncTime: card.lastSyncTime
            });
        }

        // 查找用户 +868888
        const user = await User.findOne({ phoneNumber: '+868888' });
        console.log('\n=== User +868888 ===');
        console.log('User found:', user ? 'YES' : 'NO');
        if (user) {
            console.log('User details:', {
                _id: user._id,
                phoneNumber: user.phoneNumber,
                name: user.name,
                balance: user.balance
            });
        }

        // 查找该用户关联的所有卡片
        if (user) {
            const cards = await RenrenCard.find({ localUserId: user._id });
            console.log('\n=== Cards bound to user +868888 ===');
            console.log('Total cards:', cards.length);
            cards.forEach(c => {
                console.log(`- ${c.cardNo}: balance=${c.balance}, realBalance=${c.realBalance}`);
            });
        }

        // 同时查询所有卡片和用户
        console.log('\n=== All RenrenCards in DB ===');
        const allCards = await RenrenCard.find({});
        console.log('Total cards in DB:', allCards.length);
        allCards.forEach(c => {
            console.log(`- ${c.cardNo}: localUserId=${c.localUserId}, balance=${c.balance}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkBinding();
