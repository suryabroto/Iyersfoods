const raw = require('./june8_raw.json');
const fields = raw.fields || {};

const categories = ['PACKET', 'LOOSE'];
categories.forEach(cat => {
    console.log(`=== ${cat} TRIPS ===`);
    if (fields[cat]) {
        const catMap = fields[cat].mapValue?.fields || {};
        const trips = catMap.trips?.arrayValue?.values || [];
        trips.forEach((t, i) => {
            const f = t.mapValue?.fields || {};
            console.log(`Trip ${i}:`);
            for (const key in f) {
                console.log(`  ${key}: ${JSON.stringify(f[key])}`);
            }
        });
    }
});
