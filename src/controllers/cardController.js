const CardBatch = require('../models/CardBatch');
const Card = require('../models/Card');
const crypto = require('crypto');

/**
 * @desc    Generate a new batch of physical cards
 * @route   POST /api/cards/generate
 * @access  Admin/Super-Admin
 */
exports.generateBatch = async (req, res) => {
    try {
        const { quantity, value } = req.body;
        const valuePerCard = value || 600000;

        console.log(`[CardGen] Request received: qty=${quantity}, value=${valuePerCard}, user=${req.user.role}`);

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a valid quantity' });
        }

        // 1. Create Batch ID
        const date = new Date();
        const year = date.getFullYear();
        const batchCount = await CardBatch.countDocuments({ 
            createdAt: { 
                $gte: new Date(year, 0, 1), 
                $lt: new Date(year + 1, 0, 1) 
            } 
        });
        const batchId = `BATCH-${year}-${(batchCount + 1).toString().padStart(3, '0')}`;
        console.log(`[CardGen] Generated Batch ID: ${batchId}`);

        // 2. Determine Serial Range
        // Use a more robust way to find the max serial number by converting to number if possible
        const cards_all = await Card.find({}, { serialNumber: 1 }).lean();
        let maxSerial = 60000099;
        cards_all.forEach(c => {
            const num = parseInt(c.serialNumber);
            if (!isNaN(num) && num > maxSerial) maxSerial = num;
        });
        
        const startSerialNum = maxSerial + 1;
        const endSerialNum = startSerialNum + quantity - 1;
        console.log(`[CardGen] Serial Range: ${startSerialNum} - ${endSerialNum}`);

        // 3. Create CardBatch record
        let batch;
        try {
            batch = await CardBatch.create({
                batchId,
                quantity,
                valuePerCard,
                startSerial: startSerialNum.toString(),
                endSerial: endSerialNum.toString(),
                createdBy: req.user._id,
                status: 'Pending'
            });
        } catch (dbErr) {
            console.error(`[CardGen] Database error creating batch:`, dbErr.message);
            if (dbErr.code === 11000) {
                return res.status(400).json({ success: false, message: `Batch ID ${batchId} already exists. Please try again.` });
            }
            throw dbErr;
        }

        // 4. Generate individual cards
        const cards = [];
        for (let i = 0; i < quantity; i++) {
            const serialNumber = (startSerialNum + i).toString();
            const token = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
            
            cards.push({
                serialNumber,
                batch: batch._id,
                token,
                value: valuePerCard,
                status: 'Unlinked'
            });
        }

        try {
            await Card.insertMany(cards);
            console.log(`[CardGen] Successfully inserted ${cards.length} cards`);
        } catch (insertErr) {
            console.error(`[CardGen] Error during insertMany:`, insertErr.message);
            batch.status = 'Error';
            await batch.save();
            return res.status(500).json({ 
                success: false, 
                message: 'Error generating individual cards. Please check for duplicate serials.' 
            });
        }
        
        batch.status = 'Completed';
        await batch.save();
        console.log(`[CardGen] Batch ${batchId} marked as Completed`);

        res.status(201).json({
            success: true,
            data: batch
        });

    } catch (error) {
        console.error('[CardGen] Global Catch:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    Get all card batches
 * @route   GET /api/cards/batches
 * @access  Admin/Super-Admin
 */
exports.getBatches = async (req, res) => {
    try {
        const batches = await CardBatch.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: batches.length,
            data: batches
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    Get cards in a specific batch (for downloading QR list)
 * @route   GET /api/cards/batches/:id/cards
 * @access  Admin/Super-Admin
 */
exports.getBatchCards = async (req, res) => {
    try {
        const cards = await Card.find({ batch: req.params.id }).select('serialNumber token value status');
        res.status(200).json({
            success: true,
            count: cards.length,
            data: cards
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    Sell a physical card (预分账)
 * @route   POST /api/cards/sell
 * @access  Private (Station Manager)
 */
exports.sellCard = async (req, res) => {
    try {
        const { serialNumber, stationId, soldPrice } = req.body;

        if (!serialNumber || !stationId) {
            return res.status(400).json({
                success: false,
                message: 'Serial number and station ID are required'
            });
        }

        const card = await Card.findOne({ serialNumber, status: 'Unlinked' });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found or already sold/linked'
            });
        }

        const salePrice = soldPrice || 200000; // 默认20万Rp
        const stationShare = salePrice * 0.5; // 站点分50%
        const hqShare = salePrice * 0.5; // 总部分50%

        // 更新卡片状态
        card.status = 'Sold';
        card.soldByStationId = stationId;
        card.soldAt = new Date();
        card.presplitDone = true;
        await card.save();

        // TODO: 实际项目中需要更新站点和总部的账户余额
        // 这里仅做记录，实际分账逻辑需要对接财务系统

        console.log(`[CardSell] Card ${serialNumber} sold by station ${stationId}`);
        console.log(`[CardSell] Station share: Rp ${stationShare}, HQ share: Rp ${hqShare}`);

        res.status(200).json({
            success: true,
            message: `Card sold successfully! Station receives Rp ${stationShare.toLocaleString()}`,
            data: {
                serialNumber: card.serialNumber,
                soldPrice: salePrice,
                stationRevenue: stationShare,
                hqRevenue: hqShare,
                soldAt: card.soldAt
            }
        });

    } catch (error) {
        console.error('[CardSell] Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    Link a card to a user's wallet [更新为支持RFID卡号和MySQL]
 * @route   POST /api/cards/link
 * @access  Private (User)
 */
exports.linkCard = async (req, res) => {
    const { PhysicalCard, User, Transaction } = require('../models');
    const sequelize = require('../config/database');

    try {
        const { rfidCard } = req.body;
        const userId = req.user.id;

        console.log(`[Card Link] User ${userId} attempting to link RFID: ${rfidCard}`);

        if (!rfidCard) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_RFID',
                message: 'RFID card number is required'
            });
        }

        // 验证RFID卡号格式（一位字母+八位数字）
        if (!/^([A-Za-z][0-9]{8}|[0-9A-Fa-f]{4,16})$/.test(rfidCard)) {
            console.warn(`[Card Link] Invalid RFID format: ${rfidCard}`);
            return res.status(400).json({
                success: false,
                error: 'INVALID_CARD_FORMAT',
                message: 'Invalid RFID card number format. Expected: 1 letter + 8 digits (e.g., B00000008) or hex (e.g., 5AFB9FE1)'
            });
        }

        // 开始数据库事务
        const transaction = await sequelize.transaction();

        try {
            // 1. 查找卡片：先按 cardNumber 查（QR码可能编码的是cardNumber），找不到再按 rfid 查
            let card = await PhysicalCard.findOne({ where: { cardNumber: rfidCard } });
            if (!card) {
                card = await PhysicalCard.findOne({ where: { rfid: rfidCard } });
            }

            if (!card) {
                await transaction.rollback();
                console.warn(`[Card Link] Card not found: ${rfidCard}`);
                return res.status(404).json({
                    success: false,
                    error: 'CARD_NOT_FOUND',
                    message: 'Card not found'
                });
            }

            // 2. 检查卡状态
            if (card.userId) {
                await transaction.rollback();
                console.warn(`[Card Link] Card already linked: ${rfidCard} to user ${card.userId}`);
                return res.status(400).json({
                    success: false,
                    error: 'CARD_ALREADY_LINKED',
                    message: 'Card already linked to another account'
                });
            }

            if (card.status !== 'Active' && card.status !== 'Sold') {
                await transaction.rollback();
                console.warn(`[Card Link] Card inactive: ${rfidCard}, status: ${card.status}`);
                return res.status(400).json({
                    success: false,
                    error: 'CARD_INACTIVE',
                    message: 'Card is not active'
                });
            }

            // 3. 获取用户当前余额
            const user = await User.findByPk(userId);

            if (!user) {
                await transaction.rollback();
                console.error(`[Card Link] User not found: ${userId}`);
                return res.status(404).json({
                    success: false,
                    error: 'USER_NOT_FOUND',
                    message: 'User not found'
                });
            }

            const oldBalance = parseFloat(user.balance || 0);
            // 优先用卡自身余额（balance），其次用初始面值（initialValue），两者都没有则默认0
            const cardValue = parseFloat(card.balance || card.initialValue || 0);
            const newBalance = oldBalance + cardValue;

            console.log(`[Card Link] Balance update: ${oldBalance} + ${cardValue} = ${newBalance}`);

            // 4. 更新卡状态
            await card.update({
                status: 'Linked',
                userId: userId,
                boundAt: new Date()
            }, { transaction });

            // 5. 更新用户余额
            await user.update({
                balance: newBalance
            }, { transaction });

            // 6. 创建交易记录
            const txRecord = await Transaction.create({
                userId: userId,
                type: 'TopUp',
                amount: cardValue,
                balanceBefore: oldBalance,
                balanceAfter: newBalance,
                balanceType: 'PHYSICAL_BACKED',
                originCardId: card.id,
                profitShared: true,
                status: 'Completed',
                description: `Physical Card Linking (RFID: ${rfidCard})`
            }, { transaction });

            // 提交事务
            await transaction.commit();

            console.log(`[Card Link] Success! Card ${rfidCard} linked to user ${userId}, transaction ${txRecord.id}`);

            return res.json({
                success: true,
                message: 'Card linked successfully',
                data: {
                    newBalance: newBalance,
                    cardValue: cardValue,
                    transactionId: txRecord.id
                }
            });

        } catch (error) {
            // 回滚事务
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('[Card Link Error]', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to link card'
        });
    }
};
