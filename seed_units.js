const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Unit = require('./src/models/Unit');

// 指定 .env 文件的绝对路径
dotenv.config({ path: path.join(__dirname, '.env') });

const seedUnits = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected for Seeding...');

        // 清除旧数据
        await Unit.deleteMany();

        const units = [
            {
                unitId: 'JKT-KM-001',
                locationName: 'Indomaret Kemang, Jakarta',
                location: {
                    type: 'Point',
                    coordinates: [106.8150, -6.2383] // Kemang
                },
                status: 'Active',
                sensors: {
                    pureTDS: 42,
                    rawTDS: 180,
                    ph: 7.2,
                    temp: 24
                },
                subscription: {
                    isOverdue: false,
                    lastPaidAt: new Date()
                }
            },
            {
                unitId: 'JKT-MT-015',
                locationName: 'Menteng Residence, Jakarta',
                location: {
                    type: 'Point',
                    coordinates: [106.8272, -6.1847] // Menteng
                },
                status: 'Maintenance',
                sensors: {
                    pureTDS: 110,
                    rawTDS: 220,
                    ph: 6.8,
                    temp: 26
                },
                subscription: {
                    isOverdue: true,
                    overdueDays: 5,
                    lastPaidAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
                }
            },
            {
                unitId: 'BDG-SL-003',
                locationName: 'Dago Street, Bandung',
                location: {
                    type: 'Point',
                    coordinates: [107.6191, -6.8915] // Bandung
                },
                status: 'Active',
                sensors: {
                    pureTDS: 35,
                    rawTDS: 150,
                    ph: 7.0,
                    temp: 22
                },
                subscription: {
                    isOverdue: false,
                    lastPaidAt: new Date()
                }
            }
        ];

        await Unit.insertMany(units);
        console.log('✅ 3 Mock Units Created with Geospatial data!');
        process.exit();
    } catch (err) {
        console.error('❌ Seeding Error:', err);
        process.exit(1);
    }
};

seedUnits();
