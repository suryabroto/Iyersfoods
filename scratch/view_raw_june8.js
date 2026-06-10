const fs = require('fs');

async function main() {
    const url = 'https://firestore.googleapis.com/v1/projects/iyers-c0944/databases/(default)/documents/routeDays/2026-06-08';
    const res = await fetch(url);
    const data = await res.json();
    fs.writeFileSync('scratch/june8_raw.json', JSON.stringify(data, null, 2));
    console.log('Raw data written to scratch/june8_raw.json');
}

main().catch(console.error);
