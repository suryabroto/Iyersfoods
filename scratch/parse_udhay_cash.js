const data = require('./june8_decoded.json');

const filterDriver = 'UDHAYAMPEROOR';

const stats = {
    totalCashCollected: 0,
    totalGpayCollected: 0,
    totalAnandCollected: 0,
    cashPacket: 0,
    cashLoose: 0,
    gpayPacket: 0,
    gpayLoose: 0,
    anandPacket: 0,
    anandLoose: 0,
    credits: [],
    dosaPrice: 45,
    appamPrice: 55
};

['PACKET', 'LOOSE'].forEach(cat => {
    const catData = data[cat];
    if (!catData) return;

    const shops = catData.shops || {};
    for (const shop in shops) {
        const s = shops[shop];
        if (s.driver === filterDriver) {
            const cash = Number(s.cashReceived) || 0;
            const gpay = Number(s.gpayReceived) || 0;
            const anand = Number(s.anandReceived) || 0;

            stats.totalCashCollected += cash;
            stats.totalGpayCollected += gpay;
            stats.totalAnandCollected += anand;

            if (cat === 'PACKET') {
                stats.cashPacket += cash;
                stats.gpayPacket += gpay;
                stats.anandPacket += anand;
            } else if (cat === 'LOOSE') {
                stats.cashLoose += cash;
                stats.gpayLoose += gpay;
                stats.anandLoose += anand;
            }
        }
    }
});

console.log('--- UDHAYAMPEROOR CASH RECONCILIATION ---');
console.log('Total Cash Collected:', stats.totalCashCollected);
console.log('  Cash Packet:', stats.cashPacket);
console.log('  Cash Loose:', stats.cashLoose);
console.log('Total Gpay Collected:', stats.totalGpayCollected);
console.log('  Gpay Packet:', stats.gpayPacket);
console.log('  Gpay Loose:', stats.gpayLoose);
console.log('Total Anand Collected:', stats.totalAnandCollected);
console.log('  Anand Packet:', stats.anandPacket);
console.log('  Anand Loose:', stats.anandLoose);
