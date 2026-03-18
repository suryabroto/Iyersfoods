
const DB_PROD = "IYERSFOOD_ERP_V3_3";
const DB_ROUTE = "IYERS_ROUTE_V3_1";
const DB_CLIENTS = "IYERS_CLIENT_DB_V2";

const SHOPS = ["Nettor", "Kannankulangara", "Vadakkekotta"];
const STAFF = {
  Nettor: ["Geethu", "Sedhu", "Hathika", "Roshna", "Rincy"],
  Kannankulangara: ["Sreedevi", "Rejitha", "Suma"],
  Vadakkekotta: ["Remya"]
};
const DRIVERS = ["Anand", "Renjith", "Aswin", "Sanja"];
const CLIENT_NAMES = ["Fathima Stores", "Malabar Hotel", "Saravana Bhavan", "Lulu Hypermarket", "Bismi Hyper", "Ajwa Hotel", "Tea Time", "Royal Bakers"];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const generateData = () => {
    const prodData = {};
    const routeData = {};
    const today = new Date();
    
    // 1. Setup Clients
    const clients = CLIENT_NAMES.map(name => ({
        name, 
        phone: "98" + randomInt(10000000, 99999999),
        pd: 45, pa: 55
    }));
    localStorage.setItem(DB_CLIENTS, JSON.stringify(clients));

    // 2. Loop 30 Days
    for(let i=30; i>=0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // --- PRODUCTION ---
        const dailyProds = [];
        // 5-10 batches per day
        const batches = randomInt(5, 10);
        for(let b=1; b<=batches; b++) {
            const shop = randomItem(SHOPS);
            const staff = randomItem(STAFF[shop]);
            const product = Math.random() > 0.3 ? "DOSA" : "APPAM";
            const type = Math.random() > 0.3 ? "PACKET" : "LOOSE"; // 70% Packet
            const qty = (type === 'PACKET') ? randomInt(20, 50) : randomInt(10, 30);
            
            dailyProds.push({
                id: Math.random().toString(36),
                shop, staff, product, type, qty,
                bn: `${shop[0]}${product[0]}-${b}`, // Simple batch number
                client: (type === 'LOOSE') ? randomItem(CLIENT_NAMES) : ""
            });
        }
        prodData[dateStr] = { productions: dailyProds, deliveries: [], staffDeclarations: [], returns: [] };

        // --- ROUTE / SALES ---
        const dailyRoute = {
            PACKET: { trips: [], returns: [], shops: {} },
            LOOSE: { trips: [], returns: [], shops: {} }
        };

        // Trips
        const numTrips = randomInt(3, 6);
        for(let t=0; t<numTrips; t++) {
            dailyRoute.PACKET.trips.push({
                id: Math.random().toString(36),
                hub: randomItem(SHOPS),
                driver: randomItem(DRIVERS),
                dosa: randomInt(10, 50),
                appam: randomInt(5, 20)
            });
        }
        
        // Shop Sales (Simulate sales for clients)
        CLIENT_NAMES.forEach(c => {
            const soldDosa = randomInt(0, 10);
            const soldAppam = randomInt(0, 5);
            // 80% chance of sale
            if(Math.random() > 0.2) {
                // Randomly assign cash or credit
                const isCredit = Math.random() > 0.7; // 30% Credit
                const saleData = {
                    dosa: { sale: soldDosa, cr: isCredit ? soldDosa : 0, dmg: 0, free: 0 },
                    appam: { sale: soldAppam, cr: isCredit ? soldAppam : 0, dmg: 0, free: 0 },
                    cashReceived: isCredit ? 0 : (soldDosa * 45 + soldAppam * 55),
                    driver: randomItem(DRIVERS)
                };
                dailyRoute.PACKET.shops[c] = saleData;
            }
        });

        routeData[dateStr] = dailyRoute;
    }
    
    // Save
    localStorage.setItem(DB_PROD, JSON.stringify(prodData));
    localStorage.setItem(DB_ROUTE, JSON.stringify(routeData));
    console.log("DUMMY DATA INJECTED SUCCESS");
    return "SUCCESS";
};

generateData();
