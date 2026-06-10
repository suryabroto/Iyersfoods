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
                cash: Number(s.cashReceived) || 0,
                gpay: Number(s.gpayReceived) || 0,
                anand: Number(s.anandReceived) || 0
            });
        }
    }
});

console.log('--- PAYMENTS VS SALES ---');
shops.forEach(s => {
    const dSale = Number(s.dosa.sale) || 0;
    const dCr = Number(s.dosa.cr) || 0;
    const aSale = Number(s.appam.sale) || 0;
    const aCr = Number(s.appam.cr) || 0;

    const pd = 45; // default dosa price
    const pa = 55; // default appam price

    const saleValue = (dSale + dCr) * pd + (aSale + aCr) * pa;
    const paid = s.cash + s.gpay + s.anand;

    if (saleValue || paid) {
        const diff = paid - saleValue;
        console.log(`${s.name}:`);
        console.log(`  Today's Sales Value: ₹${saleValue} (Dosa: ${dSale}S, ${dCr}C | Appam: ${aSale}S, ${aCr}C)`);
        console.log(`  Paid: ₹${paid} (Cash: ₹${s.cash}, Gpay: ₹${s.gpay})`);
        if (diff !== 0) {
            console.log(`  Difference: ${diff > 0 ? '+' : ''}₹${diff}`);
        }
    }
});
