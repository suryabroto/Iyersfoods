const data = require('./june8_decoded.json');

console.log('--- ALL ACTIVE SHOPS ON JUNE 8 ---');
const categories = ['PACKET', 'LOOSE'];
categories.forEach(cat => {
    const shops = data[cat].shops || {};
    for (const name in shops) {
        const s = shops[name];
        const dSale = Number(s.dosa?.sale) || 0;
        const dCr = Number(s.dosa?.cr) || 0;
        const dDmg = Number(s.dosa?.dmg) || 0;
        const dFree = Number(s.dosa?.free) || 0;

        const aSale = Number(s.appam?.sale) || 0;
        const aCr = Number(s.appam?.cr) || 0;
        const aDmg = Number(s.appam?.dmg) || 0;
        const aFree = Number(s.appam?.free) || 0;

        const cash = Number(s.cashReceived) || 0;
        const gpay = Number(s.gpayReceived) || 0;
        const anand = Number(s.anandReceived) || 0;

        if (dSale || dCr || dDmg || dFree || aSale || aCr || aDmg || aFree || cash || gpay || anand) {
            console.log(`${cat} | ${name} | Driver: "${s.driver}"`);
            console.log(`  Dosa: sale=${dSale}, cr=${dCr}, dmg=${dDmg}, free=${dFree}`);
            console.log(`  Appam: sale=${aSale}, cr=${aCr}, dmg=${aDmg}, free=${aFree}`);
            console.log(`  Payments: cash=${cash}, gpay=${gpay}, anand=${anand}`);
        }
    }
});
