const raw = require('./june8_raw.json');
const fields = raw.fields || {};

console.log('--- RAW PACKET FIELDS ---');
if (fields.PACKET) {
    const packetMap = fields.PACKET.mapValue?.fields || {};
    if (packetMap.trips) {
        console.log(JSON.stringify(packetMap.trips, null, 2));
    }
}

console.log('--- RAW LOOSE FIELDS ---');
if (fields.LOOSE) {
    const looseMap = fields.LOOSE.mapValue?.fields || {};
    if (looseMap.trips) {
        console.log(JSON.stringify(looseMap.trips, null, 2));
    }
}
