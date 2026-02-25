const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DailySalesAlert = sequelize.define('DailySalesAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  unitId: { type: DataTypes.INTEGER, allowNull: false },
  deviceId: { type: DataTypes.STRING(50), allowNull: false },
  alertDate: { type: DataTypes.DATEONLY, allowNull: false },
  dailyVolume: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  alertThreshold: { type: DataTypes.DECIMAL(10, 2), defaultValue: 850 },
  isBelowThreshold: { type: DataTypes.BOOLEAN, defaultValue: false },
  alertSent: { type: DataTypes.BOOLEAN, defaultValue: false },
  sentAt: { type: DataTypes.DATE, allowNull: true },
  recipients: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'daily_sales_alerts',
  timestamps: false,
  underscored: true,
  indexes: [
    { unique: true, fields: ['unit_id', 'alert_date'] },
    { fields: ['alert_date'] },
    { fields: ['alert_sent'] }
  ]
});

module.exports = DailySalesAlert;
