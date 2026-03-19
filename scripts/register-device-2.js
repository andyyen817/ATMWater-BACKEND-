// One-time script to register the second physical device into the units table

require('dotenv').config();
const { Unit } = require('../src/models');

async function registerDevice2() {
  console.log('🔄 Registering device 898523420222598612750001...\n');

  try {
    const [unit, created] = await Unit.findOrCreate({
      where: { deviceId: '898523420222598612750001' },
      defaults: {
        deviceName: 'Water Station 2',
        deviceType: 'WaterDispenser',
        password: 'pudow',
        status: 'Offline',
        isActive: true,
        imei: '89852342022259861275',
        pricePerLiter: 500.00,
        pulsePerLiter: 1.0
      }
    });

    if (created) {
      console.log('✅ Device registered successfully!');
      console.log(`   Device ID : ${unit.deviceId}`);
      console.log(`   IMEI      : ${unit.imei}`);
      console.log(`   Password  : ${unit.password}`);
      console.log(`   Status    : ${unit.status}`);
    } else {
      console.log('⚠️  Device already exists in database:');
      console.log(`   Device ID : ${unit.deviceId}`);
      console.log(`   Status    : ${unit.status}`);
    }
  } catch (error) {
    console.error('❌ Error registering device:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

registerDevice2();
