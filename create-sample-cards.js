// Create sample RFID cards with correct format
const mysql = require('mysql2/promise');

async function createSampleCards() {
  try {
    const connection = await mysql.createConnection({
      host: 'hkg1.clusters.zeabur.com',
      port: 30886,
      user: 'root',
      password: 'm6RE5f3pADClMNn9ca47Z1z028gbXxuW',
      database: 'zeabur'
    });

    console.log('✅ Connected to database\n');

    // Sample cards with proper RFID format (1 letter + 8 digits)
    const sampleCards = [
      { rfid: 'A87289317', batch_id: 'BATCH-2026-001' },
      { rfid: 'B12345678', batch_id: 'BATCH-2026-001' },
      { rfid: 'C98765432', batch_id: 'BATCH-2026-001' },
      { rfid: 'D11223344', batch_id: 'BATCH-2026-002' },
      { rfid: 'E55667788', batch_id: 'BATCH-2026-002' }
    ];

    console.log('📝 Creating sample RFID cards with correct format...\n');

    for (const card of sampleCards) {
      // Check if card already exists
      const [existing] = await connection.execute(
        'SELECT id FROM physical_cards WHERE rfid = ?',
        [card.rfid]
      );

      if (existing.length > 0) {
        console.log(`⚠️  Card ${card.rfid} already exists, skipping`);
        continue;
      }

      // Insert new card
      await connection.execute(
        'INSERT INTO physical_cards (rfid, status, batch_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [card.rfid, 'Active', card.batch_id]
      );

      console.log(`✅ Created card: ${card.rfid} (Batch: ${card.batch_id})`);
    }

    // Show all cards with correct format
    const [validCards] = await connection.execute(
      'SELECT id, rfid, status, batch_id FROM physical_cards WHERE rfid REGEXP "^[A-Za-z][0-9]{8}$" ORDER BY id'
    );

    console.log(`\n📊 Total cards with valid RFID format: ${validCards.length}\n`);
    console.table(validCards);

    await connection.end();
    console.log('\n✅ Sample cards created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSampleCards();
