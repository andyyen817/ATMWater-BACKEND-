/**
 * 售水站管理者APP专用控制器
 * 提供看板、收入明细、物理卡管理等功能
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Transaction, User, Unit, PhysicalCard } = require('../models');
const DailyDispenseCounter = require('../models/DailyDispenseCounter');
const { getDailyStats, DAILY_THRESHOLD } = require('../services/profitSharing/waterCoinSplitService');

/**
 * @desc    获取售水站管理者看板数据
 * @route   GET /api/steward/dashboard
 * @access  Private (Steward only)
 */
exports.getDashboard = async (req, res) => {
  try {
    const stewardId = req.user.id;

    // 获取管家名下所有设备
    const units = await Unit.findAll({
      where: { stewardId },
      attributes: ['id', 'deviceId', 'status']
    });

    if (units.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          thresholdProgress: {
            currentVolume: 0,
            threshold: DAILY_THRESHOLD,
            percentage: 0,
            reachedAt: null
          },
          todayStats: {
            waterVolume: 0,
            revenue: 0,
            onlineDevices: 0,
            totalDevices: 0,
            activeUsers: 0
          },
          monthlyRevenue: {
            appProfit: 0,
            crossStationCompensation: 0,
            total: 0
          }
        }
      });
    }

    const unitIds = units.map(u => u.id);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. 阈值进度（取第一个站点的数据，或汇总所有站点）
    const firstUnitId = unitIds[0];
    const thresholdProgress = await getDailyStats(firstUnitId);

    // 2. 今日统计
    const todayTransactions = await Transaction.findAll({
      where: {
        unitId: { [Op.in]: unitIds },
        type: 'dispense',
        status: 'Completed',
        createdAt: {
          [Op.gte]: new Date(today + 'T00:00:00'),
          [Op.lte]: new Date(today + 'T23:59:59')
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('volume')), 'totalVolume'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('userId'))), 'uniqueUsers']
      ],
      raw: true
    });

    const todayStats = {
      waterVolume: parseFloat(todayTransactions[0]?.totalVolume || 0),
      revenue: parseFloat(todayTransactions[0]?.totalAmount || 0),
      onlineDevices: units.filter(u => u.status === 'Online').length,
      totalDevices: units.length,
      activeUsers: parseInt(todayTransactions[0]?.uniqueUsers || 0)
    };

    // 3. 本月收入统计（从 ProfitSharingLedger 或 Transaction 计算）
    // 简化版：从 Transaction 的 stationRevenue 字段汇总
    const monthlyTransactions = await Transaction.findAll({
      where: {
        unitId: { [Op.in]: unitIds },
        type: 'dispense',
        status: 'Completed',
        createdAt: {
          [Op.between]: [monthStart, monthEnd]
        }
      },
      attributes: ['stationRevenue', 'balanceType']
    });

    let appProfit = 0;
    let crossStationCompensation = 0;

    monthlyTransactions.forEach(tx => {
      const revenue = parseFloat(tx.stationRevenue || 0);
      if (tx.balanceType === 'APP_BACKED') {
        appProfit += revenue;
      } else if (tx.balanceType === 'PHYSICAL_BACKED') {
        // 跨站补偿暂不实施，物理卡不分账
        crossStationCompensation += 0;
      }
    });

    const monthlyRevenue = {
      appProfit: parseFloat(appProfit.toFixed(2)),
      crossStationCompensation: parseFloat(crossStationCompensation.toFixed(2)),
      total: parseFloat((appProfit + crossStationCompensation).toFixed(2))
    };

    res.status(200).json({
      success: true,
      data: {
        thresholdProgress,
        todayStats,
        monthlyRevenue
      }
    });

  } catch (error) {
    console.error('[StewardKUD Dashboard] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * @desc    获取收入明细记录
 * @route   GET /api/steward/revenue-records
 * @access  Private (Steward only)
 */
exports.getRevenueRecords = async (req, res) => {
  try {
    const stewardId = req.user.id;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    // 获取管家名下所有设备
    const units = await Unit.findAll({
      where: { stewardId },
      attributes: ['id']
    });

    if (units.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          records: [],
          total: 0,
          pages: 0,
          currentPage: parseInt(page)
        }
      });
    }

    const unitIds = units.map(u => u.id);

    // 构建日期范围
    const where = {
      unitId: { [Op.in]: unitIds },
      type: 'WaterPurchase',
      status: 'Completed',
      stationRevenue: { [Op.gt]: 0 } // 只显示有收入的记录
    };

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59')]
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Transaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['phone', 'name']
        }
      ]
    });

    // 格式化记录
    const records = rows.map(tx => {
      const type = tx.balanceType === 'APP_BACKED' ? 'APP_PROFIT' : 'CROSS_STATION';
      const userInfo = tx.user ? (tx.user.name || tx.user.phone) : 'Unknown';

      return {
        id: tx.id,
        type,
        amount: parseFloat(tx.stationRevenue || 0),
        description: `用户 ${userInfo} 取水 ${tx.volume}L`,
        createdAt: tx.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        records,
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page)
      }
    });

  } catch (error) {
    console.error('[StewardKUD RevenueRecords] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * @desc    获取物理卡列表
 * @route   GET /api/steward/cards
 * @access  Private (Steward only)
 */
exports.getPhysicalCards = async (req, res) => {
  try {
    const stewardId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    // 查询管家发放的物理卡记录
    // 注意：需要在 PhysicalCard 模型中添加 issuedBy 字段来追踪发卡人
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await PhysicalCard.findAndCountAll({
      where: {
        issuedBy: stewardId // 假设有这个字段
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['phone', 'name'],
          required: false
        }
      ]
    });

    // 格式化卡片数据
    const cards = rows.map(card => ({
      id: card.id,
      serialNumber: card.rfid,
      issuedDate: card.createdAt,
      status: card.userId ? 'LINKED' : 'ISSUED',
      linkedUser: card.user ? (card.user.name || card.user.phone) : null,
      linkedAt: card.userId ? card.updatedAt : null
    }));

    // 统计数据
    const totalCards = count;
    const linkedCards = rows.filter(c => c.userId).length;
    const bindingRate = totalCards > 0 ? ((linkedCards / totalCards) * 100).toFixed(1) : 0;
    const estimatedProfit = totalCards * 100000; // 每张卡利润10万Rp

    res.status(200).json({
      success: true,
      data: {
        cards,
        statistics: {
          totalCards,
          linkedCards,
          bindingRate: parseFloat(bindingRate),
          estimatedProfit
        },
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page)
      }
    });

  } catch (error) {
    console.error('[StewardKUD GetCards] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * @desc    添加物理卡记录
 * @route   POST /api/steward/cards
 * @access  Private (Steward only)
 */
exports.addPhysicalCard = async (req, res) => {
  try {
    const stewardId = req.user.id;
    const { serialNumber, issuedDate } = req.body;

    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: 'Serial number is required'
      });
    }

    // 检查卡号是否已存在
    const existingCard = await PhysicalCard.findOne({
      where: { rfid: serialNumber }
    });

    if (existingCard) {
      return res.status(400).json({
        success: false,
        message: 'Card number already exists'
      });
    }

    // 创建物理卡记录
    const card = await PhysicalCard.create({
      rfid: serialNumber,
      issuedBy: stewardId,
      status: 'Active',
      createdAt: issuedDate ? new Date(issuedDate) : new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Physical card added successfully',
      data: {
        id: card.id,
        serialNumber: card.rfid,
        issuedDate: card.createdAt,
        status: 'ISSUED'
      }
    });

  } catch (error) {
    console.error('[StewardKUD AddCard] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = exports;
