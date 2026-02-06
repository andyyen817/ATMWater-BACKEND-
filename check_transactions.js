require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const RenrenTransaction = require('./src/models/RenrenTransaction');
const User = require('./src/models/User');

async function checkTransactions() {
    try {
        await connectDB();

        // 查找用户 +868888
        const user = await User.findOne({ phoneNumber: '+868888' });
        if (!user) {
            console.log('User +868888 not found');
            return;
        }

        console.log('=== User Info ===');
        console.log('phoneNumber:', user.phoneNumber);

        // 计算电子卡号
        let ecardNo = user.phoneNumber;
        if (ecardNo.startsWith('+86')) {
            ecardNo = '0' + ecardNo.substring(3);
        } else if (ecardNo.startsWith('+62')) {
            ecardNo = '0' + ecardNo.substring(3);
        }
        console.log('ecardNo:', ecardNo);

        // 查询所有 RenrenTransaction 记录
        console.log('\n=== All RenrenTransaction records ===');
        const allTx = await RenrenTransaction.find({});
        console.log('Total records:', allTx.length);

        if (allTx.length > 0) {
            allTx.forEach(tx => {
                console.log(`- cardNo: ${tx.cardNo}, deviceNo: ${tx.deviceNo}, tradeType: ${tx.tradeType}, cash: ${tx.cash}, waterTime: ${tx.waterTime}`);
            });
        }

        // 查询该用户的交易记录
        console.log('\n=== Query with current logic ===');
        const userTx = await RenrenTransaction.find({
            $or: [
                { cardNo: ecardNo },
                { cardNo: user.phoneNumber }
            ]
        });
        console.log('Found', userTx.length, 'transactions for user');

        // 检查是否有匹配的 cardNo
        console.log('\n=== Checking for matching cardNo ===');
        const matchingCards = await RenrenTransaction.find({
            cardNo: { $in: [ecardNo, user.phoneNumber, user.phoneNumber.replace('+86', '0'), user.phoneNumber.replace('+62', '0')] }
        });
        console.log('Matching records:', matchingCards.length);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkTransactions();
