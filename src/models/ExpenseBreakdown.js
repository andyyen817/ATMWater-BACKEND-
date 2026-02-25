const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExpenseBreakdown = sequelize.define('ExpenseBreakdown', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  unitId: { type: DataTypes.INTEGER, allowNull: false },
  deviceId: { type: DataTypes.STRING(50), allowNull: false },
  monthYear: { type: DataTypes.STRING(7), allowNull: false },
  deviceSubscriptionFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  softwareSubscriptionFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  networkFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  totalExpense: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  baseVolume: { type: DataTypes.DECIMAL(10, 2), defaultValue: 850 },
  waterPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  calculationNote: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'expense_breakdown',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['unit_id', 'month_year'] },
    { fields: ['month_year'] }
  ]
});

module.exports = ExpenseBreakdown;
