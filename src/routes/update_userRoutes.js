const express = require('express');
const router = express.Router();
const { 
    getProfile, 
    updateProfile,
    addBankAccount, 
    addAddress, 
    deleteBankAccount, 
    deleteAddress,
    getUserHistory
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', protect, updateProfile);
router.get('/history', getUserHistory);
router.post('/bank-accounts', addBankAccount);
router.delete('/bank-accounts/:id', deleteBankAccount);
router.post('/addresses', addAddress);
router.delete('/addresses/:id', deleteAddress);

module.exports = router;
