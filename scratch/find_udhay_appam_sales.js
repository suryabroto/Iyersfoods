const data = require('./june8_decoded.json');

const driver = 'UDHAYAMPEROOR';

console.log('--- UDHAYAMPEROOR APPAM SALES/CREDITS ---');
['PACKET', 'LOOSE'].forEach(cat => {
    const shops = data[cat].shops || {};
    for (const name in shops) {
        const s = shops[name];
        if (s.driver === driver) {
            const sale = Number(s.appam?.sale) || 0;
            const cr = Number(s.appam?.cr) || 0;
            if (sale || cr) {
                console.log(`${cat} | ${name}: sale=${sale}, cr=${cr}`);
            }
        }
    }
});
