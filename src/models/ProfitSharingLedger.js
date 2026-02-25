const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProfitSharingLedger = sequelize.define('ProfitSharingLedger', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transactionId: { type: DataTypes.INTEGER, allowNull: false },
  unitId: { type: DataTypes.INTEGER, allowNull: false },
  deviceId: { type: DataTypes.STRING(50), allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  accountType: { type: DataTypes.ENUM('Steward', 'RP', 'Headquarters'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  volume: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  profitType: { type: DataTypes.ENUM('FreeThreshold', 'ProfitSharing'), allowNull: false },
  monthYear: { type: DataTypes.STRING(7), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('Pending', 'Settled'), defaultValue: 'Settled' }
}, {
  tableName: 'profit_sharing_ledger',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['transaction_id'] },
    { fields: ['unit_id'] },
    { fields: ['user_id'] },
    { fields: ['account_type'] },
    { fields: ['month_year'] }
  ]
});

module.exports = ProfitSharingLedger;
