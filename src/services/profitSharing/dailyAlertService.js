const { DailySalesAlert, Unit, User, Transaction } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');
const messageService = require('../messageService');

const ALERT_THRESHOLD = 850;

const checkDailySales = async (date) => {
  try {
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    // 查询当天所有水站的销售量
    const salesData = await Transaction.findAll({
      attributes: [
        'unitId',
        [fn('SUM', col('volume')), 'dailyVolume']
      ],
      where: {
        type: 'WaterPurchase',
        status: 'Completed',
        createdAt: { [Op.between]: [startOfDay, endOfDay] }
      },
      group: ['unitId'],
      raw: true
    });

    const salesMap = {};
    salesData.forEach(s => { salesMap[s.unitId] = parseFloat(s.dailyVolume) || 0; });

    const units = await Unit.findAll({ where: { isActive: true } });

    for (const unit of units) {
      const dailyVolume = salesMap[unit.id] || 0;
      const isBelowThreshold = dailyVolume < ALERT_THRESHOLD;

      const [alert, created] = await DailySalesAlert.findOrCreate({
        where: { unitId: unit.id, alertDate: date },
        defaults: {
          unitId: unit.id,
          deviceId: unit.deviceId,
          alertDate: date,
          dailyVolume,
          alertThreshold: ALERT_THRESHOLD,
          isBelowThreshold,
          alertSent: false
        }
      });

      if (!created) {
        await alert.update({ dailyVolume, isBelowThreshold });
      }

      if (isBelowThreshold && !alert.alertSent) {
        await sendAlertNotifications(alert, unit);
      }
    }

    console.log(`[DailyAlertService] Daily check completed for ${date}`);
  } catch (error) {
    console.error('[DailyAlertService] checkDailySales error:', error);
    throw error;
  }
};

const sendAlertNotifications = async (alert, unit) => {
  try {
    const recipients = await getAlertRecipients(unit.id);
    const message = `[ATMWater Alert] 水站 ${unit.deviceId} 今日销售量 ${alert.dailyVolume}升，低于阈值 ${alert.alertThreshold}升，请关注！`;

    for (const recipient of recipients) {
      if (recipient.phone) {
        try {
          await messageService.sendWhatsApp(recipient.phone, message);
        } catch (err) {
          console.warn(`[DailyAlertService] Failed to send to ${recipient.phone}:`, err.message);
        }
      }
    }

    await alert.update({
      alertSent: true,
      sentAt: new Date(),
      recipients: JSON.stringify(recipients.map(r => ({ id: r.id, name: r.name, phone: r.phone })))
    });
  } catch (error) {
    console.error('[DailyAlertService] sendAlertNotifications error:', error);
  }
};

const getAlertRecipients = async (unitId) => {
  const unit = await Unit.findByPk(unitId);
  const recipients = [];

  if (unit && unit.stewardId) {
    const steward = await User.findByPk(unit.stewardId, { attributes: ['id', 'name', 'phone'] });
    if (steward) recipients.push(steward);
  }

  if (unit && unit.rpOwnerId) {
    const rp = await User.findByPk(unit.rpOwnerId, { attributes: ['id', 'name', 'phone'] });
    if (rp) recipients.push(rp);
  }

  const businessUsers = await User.findAll({
    where: { role: 'Business', isActive: true },
    attributes: ['id', 'name', 'phone']
  });
  recipients.push(...businessUsers);

  return recipients;
};

const getDailyAlerts = async (filters = {}) => {
  const where = {};
  if (filters.date) where.alertDate = filters.date;
  if (filters.status === 'pending') where.alertSent = false;
  if (filters.status === 'sent') where.alertSent = true;
  if (filters.belowThreshold !== undefined) where.isBelowThreshold = filters.belowThreshold === 'true';

  return await DailySalesAlert.findAll({
    where,
    include: [{ model: Unit, as: 'unit', attributes: ['deviceId', 'deviceName'] }],
    order: [['alertDate', 'DESC'], ['dailyVolume', 'ASC']]
  });
};

module.exports = { checkDailySales, sendAlertNotifications, getAlertRecipients, getDailyAlerts };
