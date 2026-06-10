const fs = require('fs');

async function main() {
    const url = 'https://firestore.googleapis.com/v1/projects/iyers-c0944/databases/(default)/documents/data/clients_v4';
    const res = await fetch(url);
    if (!res.ok) {
        console.error('Error fetching clients:', res.status);
        return;
    }
    const data = await res.json();
    const docFields = data.fields || {};
    
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

    const list = decodeValue(docFields.list) || [];
    console.log('Total clients in clients_v4:', list.length);
    
    const names = list.map(c => typeof c === 'string' ? c : c.name);
    fs.writeFileSync('scratch/clients_v4.json', JSON.stringify(names.sort(), null, 2));
    console.log('Client names written to scratch/clients_v4.json');
}

main().catch(console.error);
