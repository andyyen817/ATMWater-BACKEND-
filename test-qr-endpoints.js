// Test script for QR validation endpoints
const mysql = require('mysql2/promise');

async function testQREndpoints() {
  try {
    // Connect to database
    const connection = await mysql.createConnection({
      host: 'hkg1.clusters.zeabur.com',
      port: 30886,
      user: 'root',
      password: 'm6RE5f3pADClMNn9ca47Z1z028gbXxuW',
      database: 'zeabur'
    });

    console.log('✅ Connected to database\n');

    // Check users
    const [users] = await connection.execute(
      'SELECT id, phone, role FROM users LIMIT 3'
    );
    console.log('📱 Users in database:');
    console.table(users);

    // Check units (water stations)
    const [units] = await connection.execute(
      'SELECT id, device_id, device_name, location, status FROM units LIMIT 3'
    );
    console.log('\n🚰 Water stations in database:');
    console.table(units);

    // Check physical cards
    const [cards] = await connection.execute(
      'SELECT id, rfid, status, user_id FROM physical_cards LIMIT 3'
    );
    console.log('\n💳 Physical cards in database:');
    console.table(cards);

    await connection.end();
    console.log('\n✅ Database check complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQREndpoints();
