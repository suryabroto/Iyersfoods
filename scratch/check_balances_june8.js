const data = require('./june8_decoded.json');
const fs = require('fs');

const driver = 'KADAVANTHRA';
const activeDate = '2026-06-08';

// Since we don't have full database history in june8_decoded.json (only June 8),
// let's fetch the other routeDays documents to calculate getPendingBalance correctly.
async function fetchAllDocs() {
    const listUrl = 'https://firestore.googleapis.com/v1/projects/iyers-c0944/databases/(default)/documents/routeDays?pageSize=100';
    const res = await fetch(listUrl);
    const result = await res.json();
    const documents = result.documents || [];
    
    // Decode helper
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

    const allDB = {};
    documents.forEach(doc => {
        const id = doc.name.split('/').pop();
        const docFields = doc.fields || {};
        const decoded = {};
        for (const key in docFields) {
            decoded[key] = decodeValue(docFields[key]);
        }
        allDB[id] = decoded;
    });

    return allDB;
}

async function main() {
    const globalDB = await fetchAllDocs();
    console.log('Fetched', Object.keys(globalDB).length, 'date documents.');

    // Helper functions similar to app
    function getPrice(shop) {
        // use default prices for simplicity unless custom prices are known
        return { pd: 45, pa: 55 };
    }

    function getShopDayValue(shop, dayData) {
        let sold = 0;
        let paid = 0;
        ['PACKET', 'LOOSE'].forEach(cat => {
            const s = dayData?.[cat]?.shops?.[shop];
            if (!s) return;
            const p = getPrice(shop);
            sold += ((Number(s.dosa?.sale) || 0) + (Number(s.dosa?.cr) || 0)) * p.pd;
            sold += ((Number(s.appam?.sale) || 0) + (Number(s.appam?.cr) || 0)) * p.pa;
            paid += (Number(s.cashReceived) || 0) + (Number(s.gpayReceived) || 0) + (Number(s.anandReceived) || 0);
        });
        return { sold, paid };
    }

    function getPendingBalance(shop, beforeDate) {
        return Object.keys(globalDB)
            .filter(date => date < beforeDate)
            .sort()
            .reduce((total, date) => {
                const day = getShopDayValue(shop, globalDB[date]);
                return total + day.sold - day.paid;
            }, 0);
    }

    const dayData = globalDB[activeDate] || {};
    const shopsSet = new Set();
    ['PACKET', 'LOOSE'].forEach(cat => {
        const catShops = dayData[cat]?.shops || {};
        for (const shop in catShops) {
            const s = catShops[shop];
            if (s.driver === driver) {
                shopsSet.add(shop);
            }
        }
    });

    console.log(`\n--- LEDGER BALANCES FOR ${driver} ON ${activeDate} ---`);
    let totalPrev = 0;
    let totalSales = 0;
    let totalPaid = 0;
    let totalClosing = 0;

    Array.from(shopsSet).sort().forEach(shop => {
        const prev = getPendingBalance(shop, activeDate);
        const dayVal = getShopDayValue(shop, dayData);
        const closing = prev + dayVal.sold - dayVal.paid;

        if (dayVal.sold || dayVal.paid || prev !== 0) {
            console.log(`${shop}:`);
            console.log(`  Prev Dues:   ₹${prev}`);
            console.log(`  Today Sale:  ₹${dayVal.sold}`);
            console.log(`  Today Paid:  ₹${dayVal.paid}`);
            console.log(`  Closing Bal: ₹${closing}`);
            
            totalPrev += prev;
            totalSales += dayVal.sold;
            totalPaid += dayVal.paid;
            totalClosing += closing;
        }
    });

    console.log('\n=============================================');
    console.log(`TOTAL PREV DUES:   ₹${totalPrev}`);
    console.log(`TOTAL TODAY SALE:  ₹${totalSales}`);
    console.log(`TOTAL TODAY PAID:  ₹${totalPaid}`);
    console.log(`TOTAL CLOSING BAL: ₹${totalClosing}`);
}

main().catch(console.error);
