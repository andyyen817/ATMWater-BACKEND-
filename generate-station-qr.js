// Generate QR codes for all water stations
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function generateStationQRCodes() {
  try {
    // Create output directory
    const outputDir = path.join(__dirname, 'qrcodes', 'stations');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Connect to database
    const connection = await mysql.createConnection({
      host: 'hkg1.clusters.zeabur.com',
      port: 30886,
      user: 'root',
      password: 'm6RE5f3pADClMNn9ca47Z1z028gbXxuW',
      database: 'zeabur'
    });

    console.log('✅ Connected to database\n');

    // Get all active water stations
    const [units] = await connection.execute(
      'SELECT id, device_id, device_name, location FROM units WHERE is_active = 1 OR is_active IS NULL'
    );

    console.log(`📊 Found ${units.length} water stations\n`);

    for (const unit of units) {
      const deviceId = unit.device_id;
      const url = `https://qr.airkop.com/qrcode/atmwater/${deviceId}`;
      const filename = path.join(outputDir, `station_${deviceId}.png`);

      // Generate QR code
      await QRCode.toFile(filename, url, {
        width: 500,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });

      console.log(`✅ Generated: ${unit.device_name || deviceId}`);
      console.log(`   File: ${filename}`);
      console.log(`   URL: ${url}\n`);
    }

    await connection.end();

    console.log('🎉 All station QR codes generated successfully!');
    console.log(`📁 Output directory: ${outputDir}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateStationQRCodes();
