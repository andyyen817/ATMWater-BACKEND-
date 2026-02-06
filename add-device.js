const mongoose = require('mongoose');
require('dotenv').config();

const Unit = require('./src/models/Unit');

const addDevice = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 添加真实设备 86362857
        const device = await Unit.create({
            unitId: '86362857',
            locationName: '测试设备 86362857',
            status: 'Active',
            location: {
                type: 'Point',
                coordinates: [106.8229, -6.1944] // 雅加达
            },
            sensors: {
                rawTDS: 0,
                pureTDS: 0,
                ph: 7.0,
                temp: 25,
                humidity: 50
            }
        });

        console.log('\n========== Device Added ==========');
        console.log('Device ID:', device.unitId);
        console.log('Location:', device.locationName);
        console.log('Status:', device.status);
        console.log('====================================\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

addDevice();
