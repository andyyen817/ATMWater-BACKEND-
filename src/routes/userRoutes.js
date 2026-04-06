const express = require('express');
const router = express.Router();
const {
    getProfile,
    updateProfile,
    addBankAccount,
    addAddress,
    deleteBankAccount,
    deleteAddress,
    getUserHistory,
    getUserCards,
    getCardTransactions,
    uploadUserLog,
    uploadAvatar,
    changePassword,
    unbindPhysicalCard
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const avatarUpload = require('../middleware/avatarUploadMiddleware');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/history', getUserHistory);
router.get('/cards', getUserCards);
router.get('/cards/:cardNo/transactions', getCardTransactions);
router.post('/bank-accounts', addBankAccount);
router.delete('/bank-accounts/:id', deleteBankAccount);
router.post('/addresses', addAddress);
router.delete('/addresses/:id', deleteAddress);
router.post('/logs/upload', uploadUserLog);
router.post('/upload-avatar', avatarUpload.single('avatar'), uploadAvatar);
router.put('/change-password', changePassword);
router.delete('/cards/:identifier/unbind', unbindPhysicalCard);

module.exports = router;
