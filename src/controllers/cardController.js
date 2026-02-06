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
 * @desc    Link a card to a user's wallet [P3-APP-001 logic]
 * @route   POST /api/cards/link
 * @access  Private (User)
 */
exports.linkCard = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        const card = await Card.findOne({ token, status: 'Unlinked' });

        if (!card) {
            return res.status(404).json({ success: false, message: 'Invalid or already used card' });
        }

        // Transfer value to user's wallet
        const User = require('../models/User');
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.balance += card.value;
        await user.save();

        // Update card status
        card.status = 'Linked';
        card.linkedUser = user._id;
        card.linkedAt = Date.now();
        await card.save();

        // Create transaction record
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: user._id,
            type: 'TopUp',
            amount: card.value,
            description: `Physical Card Linking (SN: ${card.serialNumber})`,
            paymentGateway: 'Internal',
            status: 'Completed'
        });

        res.status(200).json({
            success: true,
            message: `Successfully linked card! Rp ${card.value.toLocaleString()} added to your wallet.`,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Link Card Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
