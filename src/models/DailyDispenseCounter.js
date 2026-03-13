// ATMWater-BACKEND/src/models/DailyDispenseCounter.js
// 每日App水币出水量统计模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DailyDispenseCounter = sequelize.define('DailyDispenseCounter', {
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

  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '日期: 2026-03-10'
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
  tableName: 'daily_dispense_counters',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['unit_id', 'date'],
      name: 'uk_unit_date'
    },
    { fields: ['date'] },
    { fields: ['threshold_reached'] }
  ]
});

module.exports = DailyDispenseCounter;
