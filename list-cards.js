const mongoose = require('mongoose');
const RenrenCard = require('./src/models/RenrenCard');

const MONGODB_URI = 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

async function listCards() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到数据库\n');

        // 列出所有卡片
        const allCards = await RenrenCard.find({});
        console.log(`=== 所有卡片 (共 ${allCards.length} 张) ===`);
        for (const card of allCards) {
            console.log(`\n卡号: ${card.cardNo}`);
            console.log(`  用户手机: ${card.userPhone || '无'}`);
            console.log(`  用户名: ${card.userName || '无'}`);
            console.log(`  余额: ${card.balance}`);
            console.log(`  localUserId: ${card.localUserId || '无'}`);
            if (card.boundPhysicalCards && card.boundPhysicalCards.length > 0) {
                console.log(`  绑定的实物卡:`);
                for (const bound of card.boundPhysicalCards) {
                    console.log(`    - ${bound.cardNo} (${bound.nickname || '无昵称'}, ${bound.status})`);
                }
            }
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

listCards();
