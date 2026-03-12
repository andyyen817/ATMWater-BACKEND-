// Generate QR codes for all physical cards
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function generateCardQRCodes() {
  try {
    // Create output directory
    const outputDir = path.join(__dirname, 'qrcodes', 'cards');
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

    // Get all active physical cards
    const [cards] = await connection.execute(
      'SELECT id, rfid, status, batch_id FROM physical_cards WHERE status = "Active" ORDER BY id'
    );

    console.log(`📊 Found ${cards.length} active physical cards\n`);

    if (cards.length === 0) {
      console.log('⚠️  No active cards found. Creating sample RFID cards for testing...\n');

      // Create sample cards with proper RFID format (1 letter + 8 digits)
      const sampleCards = [
        { rfid: 'A87289317', batch_id: 'BATCH001' },
        { rfid: 'B12345678', batch_id: 'BATCH001' },
        { rfid: 'C98765432', batch_id: 'BATCH001' }
      ];

      for (const card of sampleCards) {
        await connection.execute(
          'INSERT INTO physical_cards (rfid, status, batch_id) VALUES (?, ?, ?)',
          [card.rfid, 'Active', card.batch_id]
        );
        console.log(`✅ Created sample card: ${card.rfid}`);
      }

      // Re-fetch cards
      const [newCards] = await connection.execute(
        'SELECT id, rfid, status, batch_id FROM physical_cards WHERE status = "Active" ORDER BY id'
      );
      cards.length = 0;
      cards.push(...newCards);
      console.log(`\n📊 Now have ${cards.length} cards to generate\n`);
    }

    for (const card of cards) {
      const rfid = card.rfid;

      // Validate RFID format (1 letter + 8 digits)
      if (!/^[A-Za-z][0-9]{8}$/.test(rfid)) {
        console.log(`⚠️  Skipping invalid RFID format: ${rfid}`);
        continue;
      }

      const url = `https://qr.airkop.com/qrcode/card/${rfid}`;
      const filename = path.join(outputDir, `card_${rfid}.png`);

      // Generate QR code with blue color to distinguish from station QR
      await QRCode.toFile(filename, url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0066CC',  // Blue color
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });

      console.log(`✅ Generated: Card ${rfid}`);
      console.log(`   File: ${filename}`);
      console.log(`   URL: ${url}\n`);
    }

    await connection.end();

    console.log('🎉 All card QR codes generated successfully!');
    console.log(`📁 Output directory: ${outputDir}`);
    console.log('\n📝 Note: Card QR codes are blue to distinguish from station QR codes (black)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateCardQRCodes();
