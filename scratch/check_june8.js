const fs = require('fs');

async function main() {
    const url = 'https://firestore.googleapis.com/v1/projects/iyers-c0944/databases/(default)/documents/routeDays/2026-06-08';
    console.log('Fetching', url);
    const res = await fetch(url);
    if (!res.ok) {
        console.error('Error fetching document:', res.status, res.statusText);
        const text = await res.text();
        console.error(text);
        return;
    }
    const data = await res.json();
    
    // Helper function to decode Firestore values
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

    fs.writeFileSync('scratch/june8_decoded.json', JSON.stringify(decoded, null, 2));
    console.log('Decoded data written to scratch/june8_decoded.json');
}

main().catch(console.error);
