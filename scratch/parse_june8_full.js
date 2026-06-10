const data = require('./june8_decoded.json');

const driver = 'KADAVANTHRA';
const shops = [];

['PACKET', 'LOOSE'].forEach(cat => {
    const catShops = data[cat].shops;
    for (const shop in catShops) {
        const s = catShops[shop];
        if (s.driver === driver) {
            shops.push({
                cat,
                name: shop,
                dosa: s.dosa || {},
                appam: s.appam || {},
                cash: s.cashReceived,
                gpay: s.gpayReceived,
                anand: s.anandReceived
            });
        }
    }
});

let totalDosaSale = 0;
let totalDosaCr = 0;
let totalDosaDmg = 0;
let totalDosaFree = 0;

let totalAppamSale = 0;
let totalAppamCr = 0;
let totalAppamDmg = 0;
let totalAppamFree = 0;

console.log('--- ALL SHOPS FOR KADAVANTHRA ON JUNE 8 ---');
shops.forEach(s => {
    const dSale = Number(s.dosa.sale) || 0;
    const dCr = Number(s.dosa.cr) || 0;
    const dDmg = Number(s.dosa.dmg) || 0;
    const dFree = Number(s.dosa.free) || 0;

    const aSale = Number(s.appam.sale) || 0;
    const aCr = Number(s.appam.cr) || 0;
    const aDmg = Number(s.appam.dmg) || 0;
    const aFree = Number(s.appam.free) || 0;

    if (dSale || dCr || dDmg || dFree || aSale || aCr || aDmg || aFree || s.cash || s.gpay || s.anand) {
        console.log(`${s.cat} | ${s.name}:`);
        if (dSale || dCr || dDmg || dFree) {
            console.log(`  Dosa: sale=${dSale}, cr=${dCr}, dmg=${dDmg}, free=${dFree}`);
        }
        if (aSale || aCr || aDmg || aFree) {
            console.log(`  Appam: sale=${aSale}, cr=${aCr}, dmg=${aDmg}, free=${aFree}`);
        }
        if (s.cash || s.gpay || s.anand) {
            console.log(`  Payments: cash=${s.cash || 0}, gpay=${s.gpay || 0}, anand=${s.anand || 0}`);
        }
        
        totalDosaSale += dSale;
        totalDosaCr += dCr;
        totalDosaDmg += dDmg;
        totalDosaFree += dFree;

        totalAppamSale += aSale;
        totalAppamCr += aCr;
        totalAppamDmg += aDmg;
        totalAppamFree += aFree;
    }
});

console.log('-------------------------------------------');
console.log('Calculated Totals:');
console.log(`DOSA: sale=${totalDosaSale}, cr=${totalDosaCr}, dmg=${totalDosaDmg}, free=${totalDosaFree}`);
console.log(`APPAM: sale=${totalAppamSale}, cr=${totalAppamCr}, dmg=${totalAppamDmg}, free=${totalAppamFree}`);
