const data = require('./june8_decoded.json');

const filterDriver = 'UDHAYAMPEROOR';

const stats = {
    dosa: { load: 0, sold: 0, credit: 0, free: 0, dmg: 0, balance: 0 },
    appam: { load: 0, sold: 0, credit: 0, free: 0, dmg: 0, balance: 0 }
};

['PACKET', 'LOOSE'].forEach(cat => {
    const catData = data[cat];
    if (!catData) return;

    // Load
    const trips = (catData.trips || []).filter(t => t.driver === filterDriver);
    trips.forEach(t => {
        stats.dosa.load += Number(t.dosa) || 0;
        stats.appam.load += Number(t.appam) || 0;
    });

    // Sales
    const shops = catData.shops || {};
    for (const shop in shops) {
        const s = shops[shop];
        if (s.driver === filterDriver) {
            stats.dosa.sold += Number(s.dosa?.sale) || 0;
            stats.dosa.credit += Number(s.dosa?.cr) || 0;
            stats.dosa.dmg += Number(s.dosa?.dmg) || 0;
            stats.dosa.free += Number(s.dosa?.free) || 0;

            stats.appam.sold += Number(s.appam?.sale) || 0;
            stats.appam.credit += Number(s.appam?.cr) || 0;
            stats.appam.dmg += Number(s.appam?.dmg) || 0;
            stats.appam.free += Number(s.appam?.free) || 0;
        }
    }
});

stats.dosa.balance = stats.dosa.load - (stats.dosa.sold + stats.dosa.credit + stats.dosa.free + stats.dosa.dmg);
stats.appam.balance = stats.appam.load - (stats.appam.sold + stats.appam.credit + stats.appam.free + stats.appam.dmg);

console.log('--- UDHAYAMPEROOR STATS ---');
console.log('DOSA:', stats.dosa);
console.log('APPAM:', stats.appam);
