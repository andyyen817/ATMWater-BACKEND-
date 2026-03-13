// ATMWater-BACKEND/src/models/MonthlyDispenseCounter.js
// 月度App水币出水量统计模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MonthlyDispenseCounter = sequelize.define('MonthlyDispenseCounter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  unitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '售水站ID',
    references: {
      model: 'units',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },

  yearMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
    comment: '年月格式: 2026-03'
  },

  appBackedVolume: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false,
    comment: 'App水币累计出水量（升）'
  },

  thresholdReached: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '是否已达570L阈值'
  }
}, {
  tableName: 'monthly_dispense_counters',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['unit_id', 'year_month'],
      name: 'uk_unit_month'
    },
    { fields: ['year_month'] },
    { fields: ['threshold_reached'] }
  ]
});

module.exports = MonthlyDispenseCounter;
