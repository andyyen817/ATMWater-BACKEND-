const cron = require('node-cron');
const { monthlySalesService } = require('../services/profitSharing');

// 每月1号凌晨0点执行
cron.schedule('0 0 1 * *', async () => {
  console.log('[MonthlyResetJob] Running monthly reset job...');
  try {
    await monthlySalesService.resetMonthlyStats();
    console.log('[MonthlyResetJob] Monthly reset completed');
  } catch (error) {
    console.error('[MonthlyResetJob] Error:', error);
  }
}, { timezone: 'Asia/Jakarta' });

console.log('[MonthlyResetJob] Scheduled: runs on 1st of every month at 00:00 WIB');
