const sequelize = require('./src/config/database');

async function fixPhysicalCards() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected');

        console.log('🔄 Updating physical_cards table...');
        const [results] = await sequelize.query(
            'UPDATE physical_cards SET issuedBy = NULL WHERE issuedBy IS NOT NULL'
        );
        
        console.log(`✅ Updated ${results.affectedRows} cards`);
        console.log('✅ All cards are now in "Unassigned" status');

        // 验证结果
        const [cards] = await sequelize.query(
            'SELECT COUNT(*) as total, SUM(CASE WHEN issuedBy IS NULL THEN 1 ELSE 0 END) as unassigned FROM physical_cards'
        );
        console.log(`📊 Total cards: ${cards[0].total}`);
        console.log(`📊 Unassigned cards: ${cards[0].unassigned}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixPhysicalCards();
