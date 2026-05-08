const https = require('https');

const projectId = "iyers-c0944";
const apiKey = "AIzaSyBIGt_8Ty4Ufz9cpRfrLgbKgStb0j81Sto";

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'firestore.googleapis.com',
            port: 443,
            path: `/v1/projects/${projectId}/databases/(default)/documents${path}?key=${apiKey}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body ? JSON.parse(body) : {});
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function clearData() {
    console.log("Starting cleanup...");

    try {
        // 1. Clear erp_v4
        console.log("Resetting erp_v4...");
        await request('PATCH', '/data/erp_v4', { fields: {} });
        console.log("erp_v4 reset.");

        // 2. Clear legacy route
        console.log("Resetting legacy route...");
        await request('PATCH', '/data/route', { fields: {} });
        console.log("Legacy route reset.");

        // 3. Clear routeDays collection
        console.log("Fetching routeDays documents...");
        const list = await request('GET', '/routeDays');
        if (list.documents) {
            console.log(`Found ${list.documents.length} documents in routeDays.`);
            for (const doc of list.documents) {
                const name = doc.name.split('/').pop();
                console.log(`Deleting routeDays/${name}...`);
                await request('DELETE', `/routeDays/${name}`);
            }
        } else {
            console.log("No documents found in routeDays.");
        }

        console.log("\nSUCCESS: All sales and entry data cleared. Staff and Client registers were NOT touched.");
    } catch (error) {
        console.error("\nERROR during cleanup:");
        console.error(error.message);
    }
}

clearData();
