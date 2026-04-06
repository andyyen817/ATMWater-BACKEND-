// ATMWater-BACKEND/src/models/index.js
// 统一导出所有模型并建立关联关系

const sequelize = require('../config/database');
const User = require('./User');
const PhysicalCard = require('./PhysicalCard');
const Unit = require('./Unit');
const Transaction = require('./Transaction');
const Permission = require('./Permission'); // Stage 1 添加：权限模型
const MaintenanceLog = require('./MaintenanceLog.sequelize'); // MySQL版本的维护日志模型
const WaterQualityLog = require('./WaterQualityLog.sequelize'); // MySQL版本的水质日志模型

// 新分润系统模型
const RegionalPricing = require('./RegionalPricing');
const UnitMonthlySales = require('./UnitMonthlySales');
const DailySalesAlert = require('./DailySalesAlert');
const ProfitSharingLedger = require('./ProfitSharingLedger');
const ExpenseBreakdown = require('./ExpenseBreakdown');
const Application = require('./Application');

// 固件升级系统模型
const FirmwareVersion = require('./FirmwareVersion');
const UpgradeTask = require('./UpgradeTask');

// 审计日志模型
const AuditLog = require('./AuditLog');

// 静态内容模型
const AppContent = require('./AppContent');

// 设备参数配置模型
const DeviceSettings = require('./DeviceSettings');

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

// User <-> PhysicalCard (发卡人关系，一对多)
User.hasMany(PhysicalCard, {
  foreignKey: 'issuedBy',
  as: 'issuedCards'
});
PhysicalCard.belongsTo(User, {
  foreignKey: 'issuedBy',
  as: 'issuer'
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

// Unit <-> MaintenanceLog (一对多)
Unit.hasMany(MaintenanceLog, {
  foreignKey: 'unitId',
  as: 'maintenanceLogs'
});
MaintenanceLog.belongsTo(Unit, {
  foreignKey: 'unitId',
  as: 'unit'
});

// User <-> MaintenanceLog (管家关系，一对多)
User.hasMany(MaintenanceLog, {
  foreignKey: 'stewardId',
  as: 'maintenanceLogs'
});
MaintenanceLog.belongsTo(User, {
  foreignKey: 'stewardId',
  as: 'steward'
});

// Unit <-> WaterQualityLog (一对多)
Unit.hasMany(WaterQualityLog, {
  foreignKey: 'unitId',
  as: 'waterQualityLogs'
});
WaterQualityLog.belongsTo(Unit, {
  foreignKey: 'unitId',
  as: 'unit'
});

// ========================================
// 新分润系统关联关系
// ========================================

// Unit <-> RegionalPricing (多对一，通过regionCode)
Unit.belongsTo(RegionalPricing, { foreignKey: 'regionCode', targetKey: 'regionCode', as: 'region', constraints: false });
RegionalPricing.hasMany(Unit, { foreignKey: 'regionCode', sourceKey: 'regionCode', as: 'units', constraints: false });

// User <-> Unit (RP关系)
User.hasMany(Unit, { foreignKey: 'rpOwnerId', as: 'rpUnits' });
Unit.belongsTo(User, { foreignKey: 'rpOwnerId', as: 'rpOwner' });

// Unit <-> UnitMonthlySales (一对多)
Unit.hasMany(UnitMonthlySales, { foreignKey: 'unitId', as: 'monthlySales' });
UnitMonthlySales.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });

// Unit <-> DailySalesAlert (一对多)
Unit.hasMany(DailySalesAlert, { foreignKey: 'unitId', as: 'dailyAlerts' });
DailySalesAlert.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });

// Transaction <-> ProfitSharingLedger (一对多)
Transaction.hasMany(ProfitSharingLedger, { foreignKey: 'transactionId', as: 'profitSharingEntries' });
ProfitSharingLedger.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'transaction' });

// Unit <-> ProfitSharingLedger (一对多)
Unit.hasMany(ProfitSharingLedger, { foreignKey: 'unitId', as: 'profitSharingLedger' });
ProfitSharingLedger.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });

// Unit <-> ExpenseBreakdown (一对多)
Unit.hasMany(ExpenseBreakdown, { foreignKey: 'unitId', as: 'expenseBreakdowns' });
ExpenseBreakdown.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });

// User <-> Application (一对多)
User.hasMany(Application, { foreignKey: 'applicantId', as: 'applications' });
Application.belongsTo(User, { foreignKey: 'applicantId', as: 'applicant' });

// ========================================
// 固件升级系统关联关系
// ========================================

// FirmwareVersion <-> UpgradeTask (一对多)
FirmwareVersion.hasMany(UpgradeTask, { foreignKey: 'firmwareVersionId', as: 'upgradeTasks' });
UpgradeTask.belongsTo(FirmwareVersion, { foreignKey: 'firmwareVersionId', as: 'firmware' });

// Unit <-> UpgradeTask (一对多)
Unit.hasMany(UpgradeTask, { foreignKey: 'unitId', as: 'upgradeTasks' });
UpgradeTask.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });

// User <-> UpgradeTask (发起者关系，一对多)
User.hasMany(UpgradeTask, { foreignKey: 'initiatedBy', as: 'initiatedUpgrades' });
UpgradeTask.belongsTo(User, { foreignKey: 'initiatedBy', as: 'initiator' });

// User <-> FirmwareVersion (上传者关系，一对多)
User.hasMany(FirmwareVersion, { foreignKey: 'uploadedBy', as: 'uploadedFirmwares' });
FirmwareVersion.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

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
  MaintenanceLog, // MySQL版本的维护日志模型
  WaterQualityLog, // MySQL版本的水质日志模型
  // 新分润系统模型
  RegionalPricing,
  UnitMonthlySales,
  DailySalesAlert,
  ProfitSharingLedger,
  ExpenseBreakdown,
  Application,
  // 固件升级系统模型
  FirmwareVersion,
  UpgradeTask,
  // 审计日志模型
  AuditLog,
  // 静态内容模型
  AppContent,
  // 设备参数配置模型
  DeviceSettings,
  syncDatabase
};

