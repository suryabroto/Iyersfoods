const data = require('./june8_decoded.json');

console.log('--- PACKET TRIPS ---');
console.log(data.PACKET.trips);

console.log('--- LOOSE TRIPS ---');
console.log(data.LOOSE.trips);

console.log('--- KADAVANTHRA PACKET SALES ---');
for (const shop in data.PACKET.shops) {
    const s = data.PACKET.shops[shop];
    if (s.driver === 'KADAVANTHRA' || s.driver === 'Kadavanthra') {
        if (s.dosa?.sale || s.dosa?.cr || s.appam?.sale || s.appam?.cr) {
            console.log(shop, 'Dosa:', s.dosa, 'Appam:', s.appam);
        }
    }
}

console.log('--- KADAVANTHRA LOOSE SALES ---');
for (const shop in data.LOOSE.shops) {
    const s = data.LOOSE.shops[shop];
    if (s.driver === 'KADAVANTHRA' || s.driver === 'Kadavanthra') {
        if (s.dosa?.sale || s.dosa?.cr || s.appam?.sale || s.appam?.cr) {
            console.log(shop, 'Dosa:', s.dosa, 'Appam:', s.appam);
        }
    }
}
