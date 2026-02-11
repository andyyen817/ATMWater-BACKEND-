// ATMWater-BACKEND/src/models/index.js
// 统一导出所有模型并建立关联关系

const sequelize = require('../config/database');
const User = require('./User');
const PhysicalCard = require('./PhysicalCard');
const Unit = require('./Unit');
const Transaction = require('./Transaction');
const Permission = require('./Permission'); // Stage 1 添加：权限模型

// ========================================
// 建立模型关联关系
// ========================================

// User <-> PhysicalCard (一对多)
User.hasMany(PhysicalCard, {
  foreignKey: 'userId',
  as: 'physicalCards'
});
PhysicalCard.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// User <-> Transaction (一对多)
User.hasMany(Transaction, {
  foreignKey: 'userId',
  as: 'transactions'
});
Transaction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Unit <-> Transaction (一对多)
Unit.hasMany(Transaction, {
  foreignKey: 'unitId',
  as: 'transactions'
});
Transaction.belongsTo(Unit, {
  foreignKey: 'unitId',
  as: 'unit'
});

// User <-> Unit (管理员关系，一对多)
User.hasMany(Unit, {
  foreignKey: 'stewardId',
  as: 'managedUnits'
});
Unit.belongsTo(User, {
  foreignKey: 'stewardId',
  as: 'steward'
});

// ========================================
// 同步数据库（仅开发环境）
// ========================================
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('[Models] ✅ Database synchronized');
  } catch (error) {
    console.error('[Models] ❌ Sync error:', error.message);
    throw error;
  }
};

// ========================================
// 导出
// ========================================
module.exports = {
  sequelize,
  User,
  PhysicalCard,
  Unit,
  Transaction,
  Permission, // Stage 1 添加：权限模型
  syncDatabase
};

