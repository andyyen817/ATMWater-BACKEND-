const { ExpenseBreakdown, Unit, RegionalPricing } = require('../../models');

const DEVICE_SUBSCRIPTION_LITERS = 300;
const SOFTWARE_SUBSCRIPTION_LITERS = 200;
const NETWORK_FEE_LITERS = 70;

const calculateMonthlyExpense = async (unitId, year, month) => {
  const monthYear = `${year}-${String(month).padStart(2, '0')}`;
  const unit = await Unit.findByPk(unitId);
  if (!unit) throw new Error(`Unit not found: ${unitId}`);

  let waterPrice = parseFloat(unit.pricePerLiter) || 400;

  if (unit.regionCode) {
    const region = await RegionalPricing.findOne({ where: { regionCode: unit.regionCode, isActive: true } });
    if (region) {
      waterPrice = parseFloat(region.pureWaterPrice) || waterPrice;
    }
  }

  const deviceSubscriptionFee = DEVICE_SUBSCRIPTION_LITERS * waterPrice;
  const softwareSubscriptionFee = SOFTWARE_SUBSCRIPTION_LITERS * waterPrice;
  const networkFee = NETWORK_FEE_LITERS * waterPrice;
  const totalExpense = deviceSubscriptionFee + softwareSubscriptionFee + networkFee;

  const calculationNote = `基准570升/天 | 设备:${DEVICE_SUBSCRIPTION_LITERS}升×${waterPrice}Rp | 软件:${SOFTWARE_SUBSCRIPTION_LITERS}升×${waterPrice}Rp | 网络:${NETWORK_FEE_LITERS}升×${waterPrice}Rp`;

  const [record] = await ExpenseBreakdown.upsert({
    unitId,
    deviceId: unit.deviceId,
    monthYear,
    deviceSubscriptionFee,
    softwareSubscriptionFee,
    networkFee,
    totalExpense,
    baseVolume: 570,
    waterPrice,
    calculationNote
  });

  return record;
};

const getExpenseBreakdown = async (unitId, monthYear) => {
  let record = await ExpenseBreakdown.findOne({ where: { unitId, monthYear } });
  if (!record) {
    const [year, month] = monthYear.split('-').map(Number);
    record = await calculateMonthlyExpense(unitId, year, month);
  }
  return record;
};

const updateExpenseBreakdown = async (unitId, monthYear, data) => {
  const [record] = await ExpenseBreakdown.upsert({ unitId, monthYear, ...data });
  return record;
};

module.exports = { calculateMonthlyExpense, getExpenseBreakdown, updateExpenseBreakdown };
