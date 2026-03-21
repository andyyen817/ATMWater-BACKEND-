// ATMWater-BACKEND/src/controllers/qrController.js
// QR码验证控制器 - 处理售水站和物理水卡二维码验证

const { Unit, PhysicalCard } = require('../models');

/**
 * 验证售水站QR码
 * GET /api/qr/station/:deviceId
 *
 * @param {string} deviceId - Units表中的deviceId字段（如：869123456789001）
 * @returns {object} 售水站信息
 */
async function validateStation(req, res) {
  try {
    const { deviceId } = req.params;

    console.log(`[QR Station Validation] Validating deviceId: ${deviceId}`);

    // 从Units表查询设备信息
    const unit = await Unit.findOne({
      where: { deviceId: deviceId }
    });

    if (!unit) {
      console.warn(`[QR Station Validation] Station not found: ${deviceId}`);
      return res.status(404).json({
        success: false,
        error: 'STATION_NOT_FOUND',
        message: 'Water station not found'
      });
    }

    console.log(`[QR Station Validation] Station found: ${unit.deviceName}`);

    return res.json({
      success: true,
      data: {
        stationId: unit.deviceId,  // 使用deviceId作为水站编号
        deviceId: unit.deviceId,
        name: unit.deviceName,
        location: unit.location,
        status: unit.status ? unit.status.toLowerCase() : 'offline',
        pricePerLiter: unit.pricePerLiter || 300,
        tdsValue: unit.tdsValue,
        temperature: unit.temperature
      }
    });
  } catch (error) {
    console.error('[QR Station Validation Error]', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to validate station QR'
    });
  }
}

/**
 * 验证物理水卡QR码
 * GET /api/qr/card/:rfidCard
 *
 * @param {string} rfidCard - PhysicalCards表中的rfid字段（如：A87289317）
 * @returns {object} 水卡信息
 */
async function validateCard(req, res) {
  try {
    const { rfidCard } = req.params;

    console.log(`[QR Card Validation] Validating RFID: ${rfidCard}`);

    // 验证RFID格式：支持 1字母+8数字(旧格式，如B00000008) 或 4-16位hex(新格式，如5AFB9FE1)
    if (!/^([A-Za-z][0-9]{8}|[0-9A-Fa-f]{4,16})$/.test(rfidCard)) {
      console.warn(`[QR Card Validation] Invalid RFID format: ${rfidCard}`);
      return res.status(400).json({
        success: false,
        error: 'INVALID_CARD_FORMAT',
        message: 'Invalid RFID card number format. Expected: 1 letter + 8 digits (e.g., B00000008) or 4-16 hex chars (e.g., 5AFB9FE1)'
      });
    }

    // 从PhysicalCards表查询卡片信息
    const card = await PhysicalCard.findOne({
      where: { rfid: rfidCard }
    });

    if (!card) {
      console.warn(`[QR Card Validation] Card not found: ${rfidCard}`);
      return res.status(404).json({
        success: false,
        error: 'CARD_NOT_FOUND',
        message: 'Card not found'
      });
    }

    // 检查卡片状态
    const canLink = (card.status === 'Active' || card.status === 'Sold') && !card.userId;

    if (card.userId) {
      console.warn(`[QR Card Validation] Card already linked: ${rfidCard}`);
      return res.status(400).json({
        success: false,
        error: 'CARD_ALREADY_LINKED',
        message: 'This card has already been linked to another account'
      });
    }

    console.log(`[QR Card Validation] Card found: ${rfidCard}, Status: ${card.status}, Can link: ${canLink}`);

    return res.json({
      success: true,
      data: {
        rfidCard: card.rfid,
        value: card.value || 200000,
        status: card.status,
        canLink: canLink,
        message: 'Card is available for linking'
      }
    });
  } catch (error) {
    console.error('[QR Card Validation Error]', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to validate card QR'
    });
  }
}

module.exports = {
  validateStation,
  validateCard
};
