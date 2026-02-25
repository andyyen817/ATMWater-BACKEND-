const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RegionalPricing = sequelize.define('RegionalPricing', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  regionCode: { type: DataTypes.STRING(50), unique: true, allowNull: false, comment: '区域代码' },
  regionName: { type: DataTypes.STRING(100), allowNull: false, comment: '区域名称' },
  pureWaterPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 400, comment: '纯净水价格(Rp/升)' },
  mineralWaterPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 500, comment: '矿物水价格(Rp/升)' },
  electricityCost: { type: DataTypes.DECIMAL(10, 2), allowNull: true, comment: '电费成本' },
  waterCost: { type: DataTypes.DECIMAL(10, 2), allowNull: true, comment: '水费成本' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'regional_pricing',
  timestamps: true,
  underscored: true
});

module.exports = RegionalPricing;
