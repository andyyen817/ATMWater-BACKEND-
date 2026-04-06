// 通过 Zeabur 后端 API 来更新数据库
const https = require('https');

async function fixPhysicalCards() {
    const code = `
const sequelize = require('./src/config/database');
const PhysicalCard = require('./src/models/PhysicalCard');

async function fix() {
    await sequelize.authenticate();
    const [results] = await sequelize.query(
        'UPDATE physical_cards SET issuedBy = NULL WHERE issuedBy IS NOT NULL'
    );
    const [cards] = await sequelize.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN issuedBy IS NULL THEN 1 ELSE 0 END) as unassigned FROM physical_cards'
    );
    return { updated: results.affectedRows, total: cards[0].total, unassigned: cards[0].unassigned };
}

fix().then(r => console.log(JSON.stringify(r))).catch(e => console.error(e.message));
`;
    
    console.log('📝 SQL to run on Zeabur database:');
    console.log('UPDATE physical_cards SET issuedBy = NULL WHERE issuedBy IS NOT NULL;');
    console.log('\n⚠️  Please run this SQL manually in Zeabur MySQL console');
    console.log('🔗 https://zeabur.com/dashboard');
}

fixPhysicalCards();
