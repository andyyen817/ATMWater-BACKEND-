const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UnitMonthlySales = sequelize.define('UnitMonthlySales', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  unitId: { type: DataTypes.INTEGER, allowNull: false },
  deviceId: { type: DataTypes.STRING(50), allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  month: { type: DataTypes.INTEGER, allowNull: false },
  totalVolume: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  totalRevenue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  freeThresholdVolume: { type: DataTypes.DECIMAL(10, 2), defaultValue: 34200 },
  profitSharingVolume: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  stewardProfit: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  rpProfit: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  headquartersRevenue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  lastResetAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'unit_monthly_sales',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['unit_id', 'year', 'month'] },
    { fields: ['device_id'] },
    { fields: ['year', 'month'] }
  ]
});

module.exports = UnitMonthlySales;
