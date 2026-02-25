const { regionalPricingService, monthlySalesService, dailyAlertService, expenseService } = require('../services/profitSharing');
const { Unit } = require('../models');

// ============================================
// 区域定价管理
// ============================================
exports.getAllRegionalPricing = async (req, res) => {
  try {
    const regions = await regionalPricingService.getAllRegions();
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('[ProfitSharing] getAllRegionalPricing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrUpdateRegionalPricing = async (req, res) => {
  try {
    const result = await regionalPricingService.createOrUpdateRegion(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ProfitSharing] createOrUpdateRegionalPricing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRegionalPricing = async (req, res) => {
  try {
    await regionalPricingService.deleteRegion(req.params.regionCode);
    res.json({ success: true, message: 'Region deleted' });
  } catch (error) {
    console.error('[ProfitSharing] deleteRegionalPricing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 水站分润配置
// ============================================
exports.getUnitConfig = async (req, res) => {
  try {
    const unit = await Unit.findByPk(req.params.unitId, {
      attributes: ['id', 'deviceId', 'regionCode', 'rpOwnerId', 'stewardId', 'profitSharingEnabled', 'monthlyFreeThreshold', 'stewardProfitRatio', 'rpProfitRatio']
    });
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });
    res.json({ success: true, data: unit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUnitConfig = async (req, res) => {
  try {
    const { regionCode, rpOwnerId, stewardId, profitSharingEnabled, monthlyFreeThreshold, stewardProfitRatio, rpProfitRatio } = req.body;
    const unit = await Unit.findByPk(req.params.unitId);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });
    await unit.update({ regionCode, rpOwnerId, stewardId, profitSharingEnabled, monthlyFreeThreshold, stewardProfitRatio, rpProfitRatio });
    res.json({ success: true, data: unit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 月度销售统计
// ============================================
exports.getMonthlySales = async (req, res) => {
  try {
    const { year, month } = req.query;
    const stats = await monthlySalesService.getOrCreateMonthlySales(
      req.params.unitId,
      null,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMonthlySummary = async (req, res) => {
  try {
    const { role, userId, year, month } = req.query;
    const effectiveRole = role || req.user.role;
    // Super-Admin/GM 查指定 role 时，userId=0 表示查全部
    const isSuperViewer = ['Super-Admin', 'GM', 'Finance'].includes(req.user.role);
    const effectiveUserId = userId ? parseInt(userId) : (isSuperViewer && role ? 0 : req.user.id);
    const summary = await monthlySalesService.getMonthlySummary(
      effectiveUserId,
      effectiveRole,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 每日销售告警
// ============================================
exports.getDailyAlerts = async (req, res) => {
  try {
    const alerts = await dailyAlertService.getDailyAlerts(req.query);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendAlertManually = async (req, res) => {
  try {
    const { date } = req.body;
    await dailyAlertService.checkDailySales(date || new Date().toISOString().split('T')[0]);
    res.json({ success: true, message: 'Alert check triggered' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 财务明细
// ============================================
exports.getFinancialDetails = async (req, res) => {
  try {
    const { role, userId, year, month } = req.query;
    const effectiveRole = role || req.user.role;
    const isSuperViewer = ['Super-Admin', 'GM', 'Finance'].includes(req.user.role);
    const effectiveUserId = userId ? parseInt(userId) : (isSuperViewer && role ? 0 : req.user.id);
    const summary = await monthlySalesService.getMonthlySummary(
      effectiveUserId,
      effectiveRole,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExpenseBreakdown = async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const monthYear = `${y}-${String(m).padStart(2, '0')}`;
    const breakdown = await expenseService.getExpenseBreakdown(req.params.unitId, monthYear);
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// App动态定价（公开API）
// ============================================
exports.getUnitPricing = async (req, res) => {
  try {
    const pricing = await regionalPricingService.getUnitPricing(req.params.deviceId);
    res.json({ success: true, data: pricing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
