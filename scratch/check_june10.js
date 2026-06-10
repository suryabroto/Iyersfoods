const fs = require('fs');

async function main() {
    const url = 'https://firestore.googleapis.com/v1/projects/iyers-c0944/databases/(default)/documents/routeDays/2026-06-10';
    console.log('Fetching', url);
    const res = await fetch(url);
    if (!res.ok) {
        console.error('Error fetching document:', res.status, res.statusText);
        return;
    }
    const data = await res.json();
    
    function decodeValue(val) {
        if (!val) return null;
        if ('stringValue' in val) return val.stringValue;
        if ('integerValue' in val) return parseInt(val.integerValue, 10);
        if ('doubleValue' in val) return parseFloat(val.doubleValue);
        if ('booleanValue' in val) return val.booleanValue;
        if ('arrayValue' in val) {
            const values = val.arrayValue.values || [];
            return values.map(v => decodeValue(v));
        }
        if ('mapValue' in val) {
            const fields = val.mapValue.fields || {};
            const obj = {};
            for (const key in fields) {
                obj[key] = decodeValue(fields[key]);
            }
            return obj;
        }
        return val;
    }

    const docFields = data.fields || {};
    const decoded = {};
    for (const key in docFields) {
        decoded[key] = decodeValue(docFields[key]);
    }

    console.log('=== PACKET ACTIVE SHOPS ===');
    console.log(decoded.PACKET?.activeShops);

    console.log('=== LOOSE ACTIVE SHOPS ===');
    console.log(decoded.LOOSE?.activeShops);
    
    fs.writeFileSync('scratch/june10_decoded.json', JSON.stringify(decoded, null, 2));
}

main().catch(console.error);
