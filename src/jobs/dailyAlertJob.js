const cron = require('node-cron');
const { dailyAlertService } = require('../services/profitSharing');

// 每天晚上23:00执行
cron.schedule('0 23 * * *', async () => {
  console.log('[DailyAlertJob] Running daily sales alert job...');
  try {
    const today = new Date().toISOString().split('T')[0];
    await dailyAlertService.checkDailySales(today);
    console.log('[DailyAlertJob] Daily alert check completed');
  } catch (error) {
    console.error('[DailyAlertJob] Error:', error);
  }
}, { timezone: 'Asia/Jakarta' });

console.log('[DailyAlertJob] Scheduled: runs daily at 23:00 WIB');
