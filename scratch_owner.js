
const firebaseConfig = {
  apiKey: "AIzaSyBIGt_8Ty4Ufz9cpRfrLgbKgStb0j81Sto",
  authDomain: "iyers-c0944.firebaseapp.com",
  projectId: "iyers-c0944",
  storageBucket: "iyers-c0944.firebasestorage.app",
  messagingSenderId: "234376255779",
  appId: "1:234376255779:web:8f4b43ff3f66cfd4071496"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function doc(dbRef, ...segments) {
    if (segments.length < 2) throw new Error("doc() needs collection and document id");
    let ref = dbRef.collection(segments[0]).doc(segments[1]);
    for (let i = 2; i < segments.length; i += 2) {
        ref = ref.collection(segments[i]).doc(segments[i + 1]);
    }
    return ref;
}

function collection(dbRef, ...segments) {
    let ref = dbRef.collection(segments[0]);
    for (let i = 1; i < segments.length; i += 2) {
        ref = ref.doc(segments[i]).collection(segments[i + 1]);
    }
    return ref;
}

function setDoc(ref, data) { return ref.set(data); }
function onSnapshot(ref, next, error) { return ref.onSnapshot(next, error); }
function getDoc(ref) { return ref.get(); }
function getDocs(ref) { return ref.get(); }
function deleteDoc(ref) { return ref.delete(); }

// Expose functions and state to global scope
    /* --- CONSTANTS & CONFIG --- */
    const KEY_PROD = "IYERSFOOD_ERP_V3_3";
    const KEY_ROUTE = "IYERS_ROUTE_V3_1";
    const KEY_CLIENTS = "IYERS_CLIENT_DB_V2";

    let staffDB = []; // Array of Objects: { name, type, shop }
    let routeMasterDB = []; // Array of route name objects for delivery app
    let prodDB = {};
    let routeDB = {};
    let routeDaysDB = {};
    let legacyRouteDB = {};
    let clientDB = []; // Array of Objects: { name, phone, pd, pa }
    let currentDate = new Date().toISOString().split('T')[0];

    const INITIAL_CLIENTS = [
        "Prime Super Market", "Krishna Stores", "Prasanth", "Velayudhan", "St. Marys", "Browns Bakery",
        "Margin Free", "Madha Veg", "Pauly Stores", "Angel", "True Bell", "KM Stores", "Ponnus", "Jackson",
        "Shaji", "Super Bakers Matt.", "Little Market", "Shipyard", "Anu Stores", "Family Mini Mart", "Joy Stores",
        "Super Bakery Panam", "Milma", "Jomon James", "Sharadha", "SI Bakery", "Prince Stores", "Karthiga",
        "Sree Krishna", "Charls", "TJS", "Babys", "Bake and Take", "Nathaniya", "Jeyan", "Puthenveetil",
        "KL 39", "Royal", "Salim", "Dreams", "Kkar", "Srikrishna (U)", "Sweet Corner", "Sathar Veg", "Radha",
        "Joys", "Praveeli", "Divine Kumbalam", "Tea Bay", "Divine Madavana", "V Bazaar", "AS Palacharakukada",
        "Fourstar", "MK Stores", "Anjana", "NM Stores", "AR", "Mani Stores", "Kerala Stores", "Nice Bakery",
        "Velikagathu", "Anil Stores", "Ravi Stores", "Arun Bakery", "AKR", "Shopy Fresh", "Sajith Bakery",
        "Lalan", "Padmanaban", "AMK", "Sreelaya", "MT Mart", "Daily Home Needs", "Jafer", "Fathima Bakery",
        "Global Fresh", "Shiyas", "Srilakshmi", "Nepolian", "Fathima", "Malabar", "Madha Stores", "SN Supermarket",
        "Will Mart", "SN Gandhi Nagar", "Nazar", "Valluvassery", "St Joseph", "Chakkalakal", "Magic Oven",
        "Subway", "Vasinjo", "Saketh", "Ammus", "Janatha Margin", "Homey Mart", "Ragava", "Mallus", "Sreccs",
        "CKP", "SRP", "Royal Super Market", "TKM Fresh Mart", "Kairali", "T Mart", "MN", "Homey",
        "Krishna Stores Kani", "Nitha Sudheesh", "Radhakrishnan", "Jasha Bakery", "Rajesh Stores", "Royal Bakery",
        "Pottayil Stores", "SP Stores", "Sini", "Darshana", "Aruveli", "Papilon", "Hairiseed", "Anjaneya",
        "Hishighness", "AV Mart", "SB"
    ];

    function getEmptyRouteCategory() {
        return { trips: [], returns: [], shops: {}, tally: { cashInHandMap: {}, denomsMap: {}, expenses: [], extraIncome: [] }, activeShops: [] };
    }

    function getEmptyRouteDay() {
        return { PACKET: getEmptyRouteCategory(), LOOSE: getEmptyRouteCategory() };
    }

    function isSingleCategoryRoutePayload(dayData) {
        if (!dayData || typeof dayData !== "object") return false;
        return Array.isArray(dayData.trips) || Array.isArray(dayData.returns) || !!dayData.shops || !!dayData.tally;
    }

    function normalizeRouteDay(dayData, fallbackCategory = "PACKET") {
        const base = getEmptyRouteDay();
        if (!dayData || typeof dayData !== "object") return base;

        if (isSingleCategoryRoutePayload(dayData)) {
            base[fallbackCategory] = {
                ...base[fallbackCategory],
                trips: Array.isArray(dayData.trips) ? dayData.trips : [],
                returns: Array.isArray(dayData.returns) ? dayData.returns : [],
                shops: dayData.shops || {},
                tally: {
                    ...base[fallbackCategory].tally,
                    ...(dayData.tally || {}),
                    cashInHandMap: (dayData.tally && dayData.tally.cashInHandMap) || {},
                    denomsMap: (dayData.tally && dayData.tally.denomsMap) || {},
                    expenses: (dayData.tally && Array.isArray(dayData.tally.expenses)) ? dayData.tally.expenses : [],
                    extraIncome: (dayData.tally && Array.isArray(dayData.tally.extraIncome)) ? dayData.tally.extraIncome : []
                },
                activeShops: Array.isArray(dayData.activeShops) ? dayData.activeShops : []
            };
            return base;
        }

        ["PACKET", "LOOSE"].forEach(cat => {
            const incoming = dayData[cat] || {};
            base[cat] = {
                ...base[cat],
                ...incoming,
                trips: Array.isArray(incoming.trips) ? incoming.trips : [],
                returns: Array.isArray(incoming.returns) ? incoming.returns : [],
                shops: incoming.shops || {},
                tally: {
                    ...base[cat].tally,
                    ...(incoming.tally || {}),
                    cashInHandMap: (incoming.tally && incoming.tally.cashInHandMap) || {},
                    denomsMap: (incoming.tally && incoming.tally.denomsMap) || {},
                    expenses: (incoming.tally && Array.isArray(incoming.tally.expenses)) ? incoming.tally.expenses : [],
                    extraIncome: (incoming.tally && Array.isArray(incoming.tally.extraIncome)) ? incoming.tally.extraIncome : []
                },
                activeShops: Array.isArray(incoming.activeShops) ? incoming.activeShops : []
            };
        });

        return base;
    }

    function syncRouteDB() {
        routeDB = { ...legacyRouteDB, ...routeDaysDB };
    }

    function saveRouteDay(date) {
        const payload = JSON.parse(JSON.stringify(normalizeRouteDay(routeDB[date] || getEmptyRouteDay())));
        routeDB[date] = payload;
        routeDaysDB[date] = payload;
        syncRouteDB();
        return setDoc(doc(db, "routeDays", date), payload);
    }

    function resetAllData() {
        if (confirm("⚠️ CAUTION: FULL SYSTEM RESET?\n\nThis will permanently delete ALL PRODUCTION AND DELIVERY LOGS from the entire history.\n\nNOTE: YOUR CLIENT REGISTER (1000+ SHOPS) WILL BE PRESERVED.\n\nAre you sure you want to proceed?")) {
            getDocs(collection(db, "routeDays")).then((snap) => {
                const deletions = [];
                snap.forEach((routeDoc) => deletions.push(deleteDoc(routeDoc.ref)));
                return Promise.all([
                    setDoc(doc(db, "data", "erp"), {}),
                    setDoc(doc(db, "data", "route"), {}),
                    ...deletions
                ]);
            }).then(() => {
                alert("All logs have been cleared on Firestore. Client register was preserved.");
                location.reload();
            }).catch(err => alert("Error clearing data: " + err.message));
        }
    }

    /* --- INIT --- */
    window.onload = function() {
        if(document.getElementById('prodDate')) document.getElementById('prodDate').value = currentDate;
        if(document.getElementById('delDate')) document.getElementById('delDate').value = currentDate;
        
        // Populate Staff Select in Modal
        if(document.getElementById('pShop')) {
            document.getElementById('pShop').addEventListener('change', updateModalStaff);
            updateModalStaff();
        }

        loadData();
    };

    function nav(id, el) {
        document.querySelectorAll('.content').forEach(d=>d.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(d=>d.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('pageTitle').innerText = el.innerText;
    }

    // Expose functions and state to global scope
    function syncWindow() {
        Object.assign(window, {
            prodDB, routeDB, clientDB, currentDate, routeMasterDB,
            nav, resetAllData, loadDateData, openProdModal, closeProdModal, saveProduction,
            editProd, deleteProd, openClientModal, closeClientModal, saveClient, editClient,
            deleteClient, renderClients, renderProduction, renderSales, renderDelivery,
            updateModalStaff, refreshUI, resetTableFilters, saveStaff, openStaffModal, closeStaffModal, editStaff, deleteStaff, saveDelivery, openDelModal, closeDelModal, editDel, deleteDel,
            openRouteModal, closeRouteModal, saveRoute, editRoute, deleteRoute, renderRouteMaster
        });
    }
    syncWindow();


    /* --- DATA LAYER --- */
    function loadDateData() {
        // Sync currentDate with whichever tab is active
        const prodDateEl = document.getElementById('prodDate');
        const delDateEl = document.getElementById('delDate');
        
        if(document.getElementById('prod').classList.contains('active')) {
            currentDate = prodDateEl ? prodDateEl.value : currentDate;
        } else if(document.getElementById('del').classList.contains('active')) {
            currentDate = delDateEl ? delDateEl.value : currentDate;
        } else {
            currentDate = (prodDateEl ? prodDateEl.value : null) || (delDateEl ? delDateEl.value : null) || currentDate;
        }
        
        if(prodDateEl) prodDateEl.value = currentDate;
        if(delDateEl) delDateEl.value = currentDate;
        
        resetTableFilters();
        syncWindow();
        refreshUI();
    }

    function loadData() {
        // Real-time Production logs
        onSnapshot(doc(db, "data", "erp"), (snapshot) => {
            if(snapshot.exists) prodDB = snapshot.data();
            syncWindow();
            refreshUI();
        });
        
        // Real-time Delivery logs from per-day route documents
        onSnapshot(collection(db, "routeDays"), (snapshot) => {
            routeDaysDB = {};
            snapshot.forEach((routeDoc) => {
                routeDaysDB[routeDoc.id] = normalizeRouteDay(routeDoc.data());
            });
            syncRouteDB();
            syncWindow();
            refreshUI();
        });

        // Legacy route fallback for older history not yet migrated
        onSnapshot(doc(db, "data", "route"), (snapshot) => {
            legacyRouteDB = {};
            if(snapshot.exists) {
                const raw = snapshot.data() || {};
                Object.keys(raw).forEach((dateKey) => {
                    if (!routeDaysDB[dateKey]) legacyRouteDB[dateKey] = normalizeRouteDay(raw[dateKey]);
                });
            }
            syncRouteDB();
            syncWindow();
            refreshUI();
        });
        
        loadClients();
        loadStaff();
        loadRouteMaster();
    }
    
    function loadRouteMaster() {
        onSnapshot(doc(db, "data", "routeMaster"), (snapshot) => {
            if(snapshot.exists) {
                routeMasterDB = snapshot.data().list || [];
            } else {
                routeMasterDB = ["Udhayamperoor", "Nettoor", "Kannankulangara", "Vadakkekotta"].map(n => ({name: n}));
                saveRouteMasterDB();
            }
            syncWindow();
            refreshUI();
        });
    }

    function saveRouteMasterDB() {
        setDoc(doc(db, "data", "routeMaster"), { list: routeMasterDB })
            .catch(err => console.error("RouteMaster sync failed", err));
    }

    function loadStaff() {
        onSnapshot(doc(db, "data", "staff"), (snapshot) => {
            if(snapshot.exists) {
                staffDB = snapshot.data().list || [];
            } else {
                // Initial fallback
                staffDB = [
                    { name: "Geethu", type: "PRODUCTION", shop: "Nettor" },
                    { name: "Sedhu", type: "PRODUCTION", shop: "Nettor" },
                    { name: "Hathika", type: "PRODUCTION", shop: "Nettor" },
                    { name: "Roshna", type: "PRODUCTION", shop: "Nettor" },
                    { name: "Rincy", type: "PRODUCTION", shop: "Nettor" },
                    { name: "Sreedevi", type: "PRODUCTION", shop: "Kannankulangara" },
                    { name: "Rejitha", type: "PRODUCTION", shop: "Kannankulangara" },
                    { name: "Suma", type: "PRODUCTION", shop: "Kannankulangara" },
                    { name: "Remya", type: "PRODUCTION", shop: "Vadakkekotta" },
                    { name: "Anand", type: "DELIVERY", shop: "Common" },
                    { name: "Renjith", type: "DELIVERY", shop: "Common" },
                    { name: "Aswin", type: "DELIVERY", shop: "Common" },
                    { name: "Sanja", type: "DELIVERY", shop: "Common" }
                ];
                saveStaffs();
            }
            syncWindow();
            refreshUI();
        });
    }

    function saveStaffs() {
        setDoc(doc(db, "data", "staff"), { list: staffDB })
            .catch(err => console.error("Staff sync failed", err));
    }

    function loadClients() {
        onSnapshot(doc(db, "data", "clients"), (snapshot) => {
            if(snapshot.exists) {
                clientDB = snapshot.data().list || [];
            }
            syncWindow();
            refreshUI();
        });
    }

    // --- CLIENT CRUD ---
    function openClientModal() {
        document.getElementById('clientModal').style.display = "flex";
        document.getElementById('cId').value = "";
        document.getElementById('cName').value = "";
        document.getElementById('cPhone').value = "";
        document.getElementById('cPriceD').value = "45";
        document.getElementById('cPriceA').value = "55";
    }
    function closeClientModal() { document.getElementById('clientModal').style.display = "none"; }
    function saveClient() {
        const idx = document.getElementById('cId').value;
        const name = document.getElementById('cName').value.trim();
        if(!name) return alert('Name required');
        const phone = document.getElementById('cPhone').value;
        const pd = Number(document.getElementById('cPriceD').value);
        const pa = Number(document.getElementById('cPriceA').value);
        
        if(idx !== "") clientDB[idx] = { name, phone, pd, pa };
        else clientDB.push({ name, phone, pd, pa });

        setDoc(doc(db, "data", "clients"), { list: clientDB }).then(closeClientModal);
    }
    function editClient(idx) {
        const c = clientDB[idx];
        openClientModal();
        document.getElementById('cId').value = idx;
        document.getElementById('cName').value = c.name;
        document.getElementById('cPhone').value = c.phone || "";
        document.getElementById('cPriceD').value = c.pd || 45;
        document.getElementById('cPriceA').value = c.pa || 55;
    }
    function deleteClient(idx) {
        if(!confirm("Delete this client?")) return;
        clientDB.splice(idx, 1);
        setDoc(doc(db, "data", "clients"), { list: clientDB });
    }
    function renderClients() {
        const tbody = document.getElementById('clientTable');
        if(!tbody) return;
        tbody.innerHTML = "";
        const filter = document.getElementById('clientSearch')?.value.toUpperCase() || "";
        clientDB.forEach((c, idx) => {
            if(filter && !c.name.toUpperCase().includes(filter)) return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-weight:700">${c.name}</span></td>
                <td>${c.phone || '-'}</td>
                <td><b>₹${c.pd || 45}</b> Dosa / <b>₹${c.pa || 55}</b> Appam</td>
                <td>
                    <button class="btn" style="color:var(--primary); padding:4px 8px" onclick="editClient(${idx})">Edit</button>
                    <button class="btn" style="color:var(--danger); padding:4px 8px" onclick="deleteClient(${idx})">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- STAFF CRUD ---
    function openStaffModal() {
        document.getElementById('staffModal').style.display = "flex";
        document.getElementById('sId').value = "";
        document.getElementById('sName').value = "";
    }
    function closeStaffModal() { document.getElementById('staffModal').style.display = "none"; }
    function saveStaff() {
        const idx = document.getElementById('sId').value;
        const name = document.getElementById('sName').value.trim();
        if(!name) return;
        const type = document.getElementById('sType').value;
        const shop = document.getElementById('sShop').value;

        if(idx !== "") staffDB[idx] = { name, type, shop };
        else staffDB.push({ name, type, shop });
        saveStaffs();
        closeStaffModal();
    }
    function editStaff(idx) {
        const s = staffDB[idx];
        openStaffModal();
        document.getElementById('sId').value = idx;
        document.getElementById('sName').value = s.name;
        document.getElementById('sType').value = s.type;
        document.getElementById('sShop').value = s.shop;
    }
    function deleteStaff(idx) {
        if(!confirm("Delete?")) return;
        staffDB.splice(idx, 1);
        saveStaffs();
    }
    function renderStaffs() {
        const tbody = document.getElementById('staffTable');
        if(!tbody) return;
        tbody.innerHTML = "";
        staffDB.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-weight:700">${s.name}</span></td>
                <td><span class="badge ${s.type==='PRODUCTION'?'bg-blue':'bg-orange'}">${s.type}</span></td>
                <td>${s.shop}</td>
                <td>
                    <button class="btn" style="color:var(--primary); padding:4px 8px" onclick="editStaff(${idx})">Edit</button>
                    <button class="btn" style="color:var(--danger); padding:4px 8px" onclick="deleteStaff(${idx})">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- ROUTE MASTER CRUD ---
    function openRouteModal() {
        document.getElementById('routeModal').style.display = "flex";
        document.getElementById('rIdx').value = "";
        document.getElementById('rName').value = "";
    }
    function closeRouteModal() { document.getElementById('routeModal').style.display = "none"; }
    function saveRoute() {
        const idx = document.getElementById('rIdx').value;
        const name = document.getElementById('rName').value.trim();
        if(!name) return alert('Name required');
        
        if(idx !== "") routeMasterDB[idx] = { name };
        else routeMasterDB.push({ name });
        
        saveRouteMasterDB();
        closeRouteModal();
    }
    function editRoute(idx) {
        const r = routeMasterDB[idx];
        openRouteModal();
        document.getElementById('rIdx').value = idx;
        document.getElementById('rName').value = r.name;
    }
    function deleteRoute(idx) {
        if(!confirm("Delete route?")) return;
        routeMasterDB.splice(idx, 1);
        saveRouteMasterDB();
    }
    function renderRouteMaster() {
        const tbody = document.getElementById('routeMasterTable');
        if(!tbody) return;
        tbody.innerHTML = "";
        routeMasterDB.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-weight:700">${r.name}</span></td>
                <td>
                    <button class="btn" style="color:var(--primary); padding:4px 8px" onclick="editRoute(${idx})">Edit</button>
                    <button class="btn" style="color:var(--danger); padding:4px 8px" onclick="deleteRoute(${idx})">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function refreshUI() {
        // Run all renderers
        if(typeof renderClients === 'function') renderClients();
        if(typeof renderStaffs === 'function') renderStaffs();
        if(typeof renderRouteMaster === 'function') renderRouteMaster();
        if(typeof renderProduction === 'function') renderProduction();
        if(typeof renderDelivery === 'function') renderDelivery();
        if(typeof renderSales === 'function') renderSales();

        const dayP = prodDB[currentDate] || { productions: [] };
        const dayR = routeDB[currentDate] || { PACKET: { trips: [] }, LOOSE: { trips: [] } }; 

        let totalP = 0;
        if(dayP.productions) dayP.productions.forEach(p => totalP += Number(p.qty));
        
        let totalD = 0;
        // Sum trips from both Packet and Loose
        ['PACKET', 'LOOSE'].forEach(cat => {
            if(dayR[cat] && dayR[cat].trips) {
                dayR[cat].trips.forEach(t => totalD += (Number(t.dosa)||0) + (Number(t.appam)||0));
            }
        });

        let staffSet = new Set();
        if(dayP.productions) dayP.productions.forEach(p => staffSet.add(p.staff));

        if(document.getElementById('kpiProd')) document.getElementById('kpiProd').innerText = totalP + " L";
        if(document.getElementById('kpiDel')) document.getElementById('kpiDel').innerText = totalD + " L";
        if(document.getElementById('kpiStaff')) document.getElementById('kpiStaff').innerText = staffSet.size;

        renderChart(); 
    }
    
    function renderChart() {
        const ctx = document.getElementById('chartMain').getContext('2d');
        if(window.myChart) window.myChart.destroy();
        
        let labels = [];
        let dP = [];
        let dD = [];

        for(let i=6; i>=0; i--) {
            let d = new Date(); d.setDate(d.getDate() - i);
            let ds = d.toISOString().split('T')[0];
            labels.push(ds.slice(5)); 
            
            let pVal = 0;
            if(prodDB[ds] && prodDB[ds].productions) prodDB[ds].productions.forEach(x=>pVal+=Number(x.qty));
            dP.push(pVal);

            let dVal = 0;
            if(routeDB[ds]) {
                ['PACKET', 'LOOSE'].forEach(cat => {
                    if(routeDB[ds][cat] && routeDB[ds][cat].trips) {
                        routeDB[ds][cat].trips.forEach(x=>dVal+=(Number(x.dosa)||0)+(Number(x.appam)||0));
                    }
                });
            }
            dD.push(dVal);
        }

        window.myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label:'Production', data:dP, backgroundColor:'#2563eb' },
                    { label:'Delivery', data:dD, backgroundColor:'#10b981' }
                ]
            },
            options: { responsive:true, maintainAspectRatio:false }
        });
    }

    /* --- PRODUCTION LOGIC --- */
    function renderProduction() {
        const tbody = document.getElementById('prodTable');
        const perfGrid = document.getElementById('staffPerfGrid');
        const salaryGrid = document.getElementById('staffSalaryGrid');
        const staffFilter = document.getElementById('fStaff');
        if(!tbody || !perfGrid) return;
        
        tbody.innerHTML = "";
        perfGrid.innerHTML = "";
        if(salaryGrid) salaryGrid.innerHTML = "";
        
        const day = prodDB[currentDate];
        if(!day || (!day.productions && !day.staffDeclarations)) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#cbd5e1">No Data for ${currentDate}</td></tr>`;
            document.getElementById('uiProdTotal').innerText = "0 L";
            document.getElementById('uiProdPacket').innerText = "0 L";
            document.getElementById('uiProdLoose').innerText = "0 L";
            document.getElementById('uiProdAvg').innerText = "0";
            perfGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8; font-size:12px">No staff activity recorded</div>`;
            if(salaryGrid) salaryGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8; font-size:12px">No production logs to calculate salary</div>`;
            return;
        }

        const productions = day.productions || [];
        const declarations = day.staffDeclarations || [];

        // --- 1. POPULATE DYNAMIC FILTERS ---
        if(staffFilter && staffFilter.options.length <= 1) {
            const staffs = new Set([...productions.map(p => p.staff), ...declarations.map(d => d.staff)]);
            [...staffs].sort().forEach(s => staffFilter.add(new Option(s, s)));
        }

        const mainHubFilter = (document.getElementById('prodFilterShop')?.value || "ALL").toUpperCase();
        const fBatch = document.getElementById('fBatch')?.value.toUpperCase() || "";
        const fShop = document.getElementById('fShop')?.value.toUpperCase() || "ALL";
        const fStaff = document.getElementById('fStaff')?.value.toUpperCase() || "ALL";
        const fProd = document.getElementById('fProd')?.value.toUpperCase() || "ALL";
        const fType = document.getElementById('fType')?.value.toUpperCase() || "ALL";
        
        let total = 0, packet = 0, loose = 0, batchCount = 0;
        let staffStats = {}; // { Name: { packet:0, loose:0, total:0, batches: Set } }

        // Process Productions
        productions.forEach(p => {
            if(mainHubFilter !== "ALL" && p.shop.toUpperCase() !== mainHubFilter) return;

            const qty = Number(p.qty) || 0;
            total += qty;
            batchCount++;
            if(p.type === 'PACKET') packet += qty; else loose += qty;

            if(!staffStats[p.staff]) staffStats[p.staff] = { packet:0, loose:0, total:0, batches: new Set() };
            staffStats[p.staff].total += qty;
            if(p.type === 'PACKET') staffStats[p.staff].packet += qty; else staffStats[p.staff].loose += qty;
            if(p.bn) staffStats[p.staff].batches.add(p.bn);

            if(fBatch && !p.bn?.toUpperCase().includes(fBatch)) return;
            if(fShop !== "ALL" && p.shop.toUpperCase() !== fShop) return;
            if(fStaff !== "ALL" && p.staff.toUpperCase() !== fStaff) return;
            if(fProd !== "ALL" && p.product.toUpperCase() !== fProd) return;
            if(fType !== "ALL" && p.type.toUpperCase() !== fType) return;

            const bClr = p.bn ? (window.getBatchColor ? window.getBatchColor(p.bn) : {bg:'#e0f2fe', text:'#0369a1'}) : {bg:'#f1f5f9', text:'#64748b'};
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge" style="background:${bClr.bg}; color:${bClr.text}">${p.bn || '-'}</span></td>
                <td><span style="font-weight:700; font-size:11px">${p.shop}</span></td>
                <td>${p.staff}</td>
                <td><span style="font-weight:700">${p.product}</span></td>
                <td><span class="badge ${p.type==='PACKET'?'bg-blue':'bg-orange'}">${p.type}</span></td>
                <td style="font-weight:700; text-align:right">${p.qty} L</td>
                <td>
                    <button class="btn" style="color:var(--primary); padding:4px 8px" onclick="editProd('${p.id}')">Edit</button>
                    <button class="btn" style="color:var(--danger); padding:4px 8px" onclick="deleteProd('${p.id}')">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('uiProdTotal').innerText = total + " L";
        document.getElementById('uiProdPacket').innerText = packet + " L";
        document.getElementById('uiProdLoose').innerText = loose + " L";
        const avg = batchCount > 0 ? (total / batchCount).toFixed(1) : "0";
        document.getElementById('uiProdAvg').innerText = avg;

        // Process Salary & Performance (Union of Staff)
        const allStaff = new Set([...Object.keys(staffStats), ...declarations.map(d => d.staff)]);
        const sortedStaff = [...allStaff].sort();

        if(sortedStaff.length === 0) {
            perfGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8; font-size:12px">No staff matches the current filter</div>`;
        } else {
            sortedStaff.forEach(s => {
                const stat = staffStats[s] || { packet:0, loose:0, total:0, batches: new Set() };
                const decl = declarations.find(d => d.staff === s); // Assuming one declaration per staff for simplicity or take the latest
                
                // PERFORMANCE CARD
                if(stat.total > 0) {
                    perfGrid.innerHTML += `
                        <div class="staff-card">
                            <div class="name"><span>${s}</span> <span style="color:var(--primary)">${stat.total}L</span></div>
                            <div class="staff-stat"><span>Packet Mode</span> <span style="color:var(--primary)">${stat.packet}L</span></div>
                            <div class="staff-stat"><span>Loose Mode</span> <span style="color:#f59e0b">${stat.loose}L</span></div>
                        </div>
                    `;
                }

                // SALARY CARD
                if(salaryGrid) {
                    let salary = 0;
                    let batchCountDisplay = 0;
                    let paidBatches = 0;
                    let statusBadge = "";
                    let rowClass = "";

                    if (decl && decl.isAbsent) {
                        statusBadge = `<span class="badge" style="background:#fee2e2; color:var(--danger)">ABSENT</span>`;
                        rowClass = "opacity:0.6";
                    } else {
                        // Priority: Declared Batches > Production Log Batches
                        const realBatches = stat.batches.size;
                        const declaredBatches = decl ? decl.declared : null;
                        
                        const finalBatches = (declaredBatches !== null && declaredBatches !== undefined) ? declaredBatches : realBatches;
                        
                        paidBatches = Math.max(0, finalBatches - 4);
                        salary = paidBatches * 75;
                        batchCountDisplay = finalBatches;
                        
                        statusBadge = declaredBatches !== null 
                            ? `<span class="badge" style="background:#dcfce7; color:var(--success)">VERIFIED</span>`
                            : `<span class="badge" style="background:#f1f5f9; color:var(--text-light)">ESTIMATED</span>`;
                    }

                    salaryGrid.innerHTML += `
                        <div class="salary-card" style="${rowClass}">
                            <div class="s-name"><span>${s}</span> ${statusBadge}</div>
                            <div class="s-row"><span>Total Batches</span> <span class="s-val">${batchCountDisplay} Units</span></div>
                            <div class="s-row"><span>Paid Batches</span> <span class="s-val">${paidBatches} Units</span></div>
                            <div class="s-row"><span>Volume</span> <span class="s-val">${stat.total} Liters</span></div>
                            <div class="s-row s-total"><span>Earnings</span> <span>₹${salary.toLocaleString()}</span></div>
                        </div>
                    `;
                }
            });
        }
    }

    // Reset staff options when date changes
    function resetTableFilters() {
        const sf = document.getElementById('fStaff');
        if(sf) sf.innerHTML = '<option value="ALL">All Staff</option>';
        ['fBatch', 'fShop', 'fProd', 'fType'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = (el.tagName === 'SELECT') ? 'ALL' : '';
        });
    }

    function openProdModal() {
        document.getElementById('prodModal').style.display = "flex";
        document.getElementById('pId').value = "";
        document.getElementById('pQty').value = "";
    }
    function closeProdModal() { document.getElementById('prodModal').style.display = "none"; }

    function updateModalStaff() {
        const shop = document.getElementById('pShop')?.value;
        const sel = document.getElementById('pStaff');
        const driverSel = document.getElementById('dDriver');

        if(sel) {
            sel.innerHTML = "";
            const filtered = staffDB.filter(x => x.type === 'PRODUCTION' && (x.shop === shop || x.shop === 'Common'));
            filtered.forEach(s => sel.add(new Option(s.name, s.name)));
        }

        if(driverSel) {
            const currentDr = driverSel.value;
            driverSel.innerHTML = "";
            staffDB.filter(x => x.type === 'DELIVERY').forEach(s => driverSel.add(new Option(s.name, s.name)));
            if(currentDr) driverSel.value = currentDr;
        }
    }

    function editProd(id) {
        const p = prodDB[currentDate].productions.find(x => x.id === id);
        if(!p) return;
        openProdModal();
        document.getElementById('pId').value = id;
        document.getElementById('pShop').value = p.shop; 
        updateModalStaff();
        document.getElementById('pStaff').value = p.staff;
        document.getElementById('pProd').value = p.product;
        document.getElementById('pType').value = p.type;
        document.getElementById('pQty').value = p.qty;
    }

    function saveProduction() {
        const id = document.getElementById('pId').value;
        const shop = document.getElementById('pShop').value;
        const staff = document.getElementById('pStaff').value;
        const prod = document.getElementById('pProd').value;
        const type = document.getElementById('pType').value;
        const qty = Number(document.getElementById('pQty').value);

        if(qty <= 0) return alert("Invalid Qty");

        if(!prodDB[currentDate]) prodDB[currentDate] = { productions:[], deliveries:[], returns:[] }; 

        if(id) {
            const idx = prodDB[currentDate].productions.findIndex(x => x.id === id);
            if(idx !== -1) {
                const old = prodDB[currentDate].productions[idx];
                prodDB[currentDate].productions[idx] = { ...old, shop, staff, product:prod, type, qty };
            }
        } else {
            let bnNum = 1;
            prodDB[currentDate].productions.forEach(x => { if(x.shop===shop && x.product===prod) bnNum++; });
            const bn = `${shop[0]}${prod[0]}${bnNum}`;
            const newId = Date.now().toString(36);
            prodDB[currentDate].productions.push({ id:newId, shop, staff, product:prod, type, qty, bn });
        }

        setDoc(doc(db, "data", "erp"), prodDB)
            .then(() => {
                console.log("Production Saved to Firestore");
                closeProdModal();
            })
            .catch(err => {
                console.error("Prod Save Error", err);
                alert("Error: Production record not saved. Check rules.");
            });
    }

    function deleteProd(id) {
        if(!confirm("Delete?")) return;
        prodDB[currentDate].productions = prodDB[currentDate].productions.filter(x => x.id !== id);
        setDoc(doc(db, "data", "erp"), prodDB);
    }

    function renderDelivery() {
        const grid = document.getElementById('deliveryGrid');
        if(!grid) return;
        grid.innerHTML = "";
        
        const rDay = routeDB[currentDate];
        if(!rDay) {
            grid.innerHTML = `<div style="grid-column:span 2; text-align:center; padding:40px; color:#cbd5e1">No Route Data for ${currentDate}</div>`;
            return;
        }

        let drivers = {};
        // Aggregate trips from both Packet and Loose
        ['PACKET', 'LOOSE'].forEach(cat => {
            if(rDay[cat] && rDay[cat].trips) {
                rDay[cat].trips.forEach(t => {
                    if(!drivers[t.driver]) drivers[t.driver] = { loadedD:0, loadedA:0, trips:0 };
                    drivers[t.driver].loadedD += Number(t.dosa);
                    drivers[t.driver].loadedA += Number(t.appam);
                    drivers[t.driver].trips++;
                });
            }
        });
        
        const dNames = Object.keys(drivers).sort();
        if(dNames.length === 0) {
            grid.innerHTML = `<div style="grid-column:span 2; text-align:center; padding:40px; color:#cbd5e1">No Active Drivers for ${currentDate}</div>`;
            return;
        }

        dNames.forEach(dKey => {
            const d = drivers[dKey];
            grid.innerHTML += `
            <div class="driver-card">
                <div class="driver-head">
                    <span>${dKey}</span>
                    <span class="badge bg-blue">${d.trips} Trips</span>
                </div>
                <div class="d-stat">
                    <div class="d-stat-item"><div class="d-stat-lbl">Dosa Load</div><div class="d-stat-val">${d.loadedD}</div></div>
                    <div class="d-stat-item"><div class="d-stat-lbl">Appam Load</div><div class="d-stat-val">${d.loadedA}</div></div>
                    <div class="d-stat-item"><div class="d-stat-lbl">Total</div><div class="d-stat-val">${d.loadedD+d.loadedA}</div></div>
                </div>
                <div class="client-list">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; margin-bottom:8px">DAILY SALES ACTIVITY</div>
                    ${generateShopSalesHTML(rDay, dKey)}
                </div>
            </div>`;
        });

        // Render Raw Trips Table
        const delTable = document.getElementById('delTable');
        if(delTable) {
            delTable.innerHTML = "";
            ['PACKET','LOOSE'].forEach(cat => {
                if(rDay[cat] && rDay[cat].trips) {
                    rDay[cat].trips.forEach((t, tidx) => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><span style="font-weight:700">${t.driver}</span> <small>(${t.hub || '?'})</small></td>
                            <td><span class="badge ${cat==='PACKET'?'bg-blue':'bg-orange'}">${cat}</span></td>
                            <td style="text-align:right">${t.dosa || 0}</td>
                            <td style="text-align:right">${t.appam || 0}</td>
                            <td>
                                <button class="btn" style="color:var(--primary); padding:4px 8px" onclick="editDel('${cat}', ${tidx})">Edit</button>
                                <button class="btn" style="color:var(--danger); padding:4px 8px" onclick="deleteDel('${cat}', ${tidx})">Del</button>
                            </td>
                        `;
                        delTable.appendChild(tr);
                    });
                }
            });
        }
    }

    /* --- DELIVERY CRUD LOGIC --- */
    function openDelModal() {
        document.getElementById('delModal').style.display = "flex";
        document.getElementById('dId').value = "";
        document.getElementById('dDosa').value = "";
        document.getElementById('dAppam').value = "";
        updateModalStaff();
    }
    function closeDelModal() { document.getElementById('delModal').style.display = "none"; }

    function editDel(cat, idx) {
        const t = routeDB[currentDate][cat].trips[idx];
        if(!t) return;
        openDelModal();
        document.getElementById('dId').value = idx;
        document.getElementById('dTypeOrig').value = cat;
        document.getElementById('dDriver').value = t.driver;
        document.getElementById('dType').value = cat;
        document.getElementById('dHub').value = t.hub || "Nettor";
        document.getElementById('dDosa').value = t.dosa;
        document.getElementById('dAppam').value = t.appam;
    }

    function saveDelivery() {
        const idx = document.getElementById('dId').value;
        const typeOrig = document.getElementById('dTypeOrig').value;
        const driver = document.getElementById('dDriver').value;
        const type = document.getElementById('dType').value;
        const hub = document.getElementById('dHub').value;
        const dosa = Number(document.getElementById('dDosa').value);
        const appam = Number(document.getElementById('dAppam').value);

        if(!routeDB[currentDate]) {
            routeDB[currentDate] = getEmptyRouteDay();
        }
        routeDB[currentDate] = normalizeRouteDay(routeDB[currentDate]);
        if(!routeDB[currentDate][type]) routeDB[currentDate][type] = getEmptyRouteCategory();

        const tripObj = { driver, hub, dosa, appam };

        if(idx !== "") {
            // If type changed, remove from old, push to new
            if(type !== typeOrig) {
                routeDB[currentDate][typeOrig].trips.splice(idx, 1);
                routeDB[currentDate][type].trips.push(tripObj);
            } else {
                routeDB[currentDate][type].trips[idx] = tripObj;
            }
        } else {
            routeDB[currentDate][type].trips.push(tripObj);
        }

        saveRouteDay(currentDate)
            .then(() => closeDelModal())
            .catch(err => alert("Error saving delivery: " + err.message));
    }

    function deleteDel(cat, idx) {
        if(!confirm("Delete this trip?")) return;
        routeDB[currentDate][cat].trips.splice(idx, 1);
        saveRouteDay(currentDate);
    }

    function generateShopSalesHTML(rDay, driverName) {
        let html = "";
        const shopActivity = {}; // { shopName: { dosa:0, appam:0, cash:0, cats:[] } }

        ['PACKET', 'LOOSE'].forEach(cat => {
            const catData = rDay[cat];
            if(!catData || !catData.shops) return;

            Object.keys(catData.shops).forEach(sName => {
                const s = catData.shops[sName];
                // Check if this shop belongs to this driver
                if(s.driver !== driverName) return;

                const dSale = Number(s.dosa.sale)||0;
                const dCr = Number(s.dosa.cr)||0;
                const aSale = Number(s.appam.sale)||0;
                const aCr = Number(s.appam.cr)||0;
                
                const totalD = dSale + dCr;
                const totalA = aSale + aCr;

                if(totalD > 0 || totalA > 0 || s.cashReceived) {
                    if(!shopActivity[sName]) shopActivity[sName] = { dosa:0, appam:0, cash:0, cats:[] };
                    shopActivity[sName].dosa += totalD;
                    shopActivity[sName].appam += totalA;
                    shopActivity[sName].cash += (Number(s.cashReceived)||0);
                    if(!shopActivity[sName].cats.includes(cat)) shopActivity[sName].cats.push(cat);
                }
            });
        });

        const sortedShops = Object.keys(shopActivity).sort();
        sortedShops.forEach(sName => {
            const act = shopActivity[sName];
            const catsDisplay = act.cats.map(c => c[0]).join("/"); // P/L
            html += `
            <div class="client-row">
                <div style="display:flex; flex-direction:column">
                    <span style="font-weight:700">${sName} <small style="color:#94a3b8; font-weight:400">[${catsDisplay}]</small></span>
                    <span style="font-size:10px; color:#64748b">${act.dosa}D / ${act.appam}A</span>
                </div>
                <div style="text-align:right">
                    <b style="color:#10b981">₹${act.cash}</b>
                </div>
            </div>`;
        });

        return html || '<div style="font-size:11px; color:#cbd5e1; text-align:center; padding:10px">No sales records</div>';
    }

    /* --- SALES ANALYTICS LOGIC --- */
    let salesChart = null;

    function getPrice(shop, type) {
        const c = clientDB.find(x => x.name === shop);
        if(c) return type === 'dosa' ? Number(c.pd) : Number(c.pa);
        return type === 'dosa' ? 45 : 55;
    }

    function renderSales() {
        const period = parseInt(document.getElementById('salesPeriod')?.value || "30");
        const dates = Object.keys(routeDB).sort();
        const todayStr = currentDate;
        
        let clientSummary = {}; // { name: { sold: 0, paid: 0 } }
        let driverToday = {}; // { driver: 0 }
        let dailyRev = []; // [ { date, rev } ]

        // Get past N days for the chart
        const lastNDates = [];
        for(let i=period-1; i>=0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            lastNDates.push(d.toISOString().split('T')[0]);
        }

        // Process ALL available historical data for accurate client balances
        dates.forEach(d => {
            ['PACKET','LOOSE'].forEach(cat => {
                const dayData = routeDB[d]?.[cat];
                if(!dayData || !dayData.shops) return;

                Object.keys(dayData.shops).forEach(sName => {
                    const s = dayData.shops[sName];
                    if(!clientSummary[sName]) clientSummary[sName] = { sold: 0, paid: 0 };
                    
                    const pD = getPrice(sName, 'dosa');
                    const pA = getPrice(sName, 'appam');
                    const soldVal = ((Number(s.dosa.sale)||0) + (Number(s.dosa.cr)||0))*pD + 
                                    ((Number(s.appam.sale)||0) + (Number(s.appam.cr)||0))*pA;
                    clientSummary[sName].sold += soldVal;
                    clientSummary[sName].paid += (Number(s.cashReceived) || 0);

                    // Track driver collections for the CURRENT SELECTED DATE
                    if(d === todayStr) {
                        const dr = s.driver || "Undefined";
                        if(!driverToday[dr]) driverToday[dr] = 0;
                        driverToday[dr] += (Number(s.cashReceived) || 0);
                    }
                });
            });
        });

        // Compute Daily Revenue for the Trend Chart
        lastNDates.forEach(d => {
            let rev = 0;
            ['PACKET','LOOSE'].forEach(cat => {
                const dayData = routeDB[d]?.[cat];
                if(!dayData || !dayData.shops) return;
                Object.keys(dayData.shops).forEach(sName => {
                    const s = dayData.shops[sName];
                    const pD = getPrice(sName, 'dosa');
                    const pA = getPrice(sName, 'appam');
                    rev += ((Number(s.dosa.sale)||0) + (Number(s.dosa.cr)||0))*pD + 
                           ((Number(s.appam.sale)||0) + (Number(s.appam.cr)||0))*pA;
                });
            });
            dailyRev.push({ date: d, rev: rev });
        });

        // Update High-Level KPIs
        let totalRev = 0, totalPaid = 0, active = 0;
        Object.values(clientSummary).forEach(c => {
            totalRev += c.sold;
            totalPaid += c.paid;
            if(c.sold > 0 || c.paid > 0) active++;
        });

        if(document.getElementById('salesTotalRev')) document.getElementById('salesTotalRev').innerText = "₹" + totalRev.toLocaleString();
        if(document.getElementById('salesTotalCash')) document.getElementById('salesTotalCash').innerText = "₹" + totalPaid.toLocaleString();
        if(document.getElementById('salesTotalOut')) document.getElementById('salesTotalOut').innerText = "₹" + (totalRev - totalPaid).toLocaleString();
        if(document.getElementById('salesActiveClients')) document.getElementById('salesActiveClients').innerText = active;

        // Render Driver Collection List
        const dList = document.getElementById('salesDriverList');
        if(dList) {
            dList.innerHTML = "";
            const sortedDrivers = Object.keys(driverToday).sort();
            sortedDrivers.forEach(dr => {
                if(driverToday[dr] === 0) return;
                dList.innerHTML += `
                    <div class="driver-row">
                        <span style="font-weight:600">${dr}</span>
                        <span style="font-weight:800; color:var(--primary)">₹${driverToday[dr].toLocaleString()}</span>
                    </div>
                `;
            });
            if(dList.innerHTML === "") dList.innerHTML = `<div style="text-align:center; padding:40px 20px; color:#94a3b8; font-size:12px">No collections recorded for ${todayStr}</div>`;
        }

        // Render Client Master Statement Table
        const cTable = document.getElementById('salesClientTable');
        if(cTable) {
            cTable.innerHTML = "";
            // Sort by Balance Due (Descending)
            const sortedClients = Object.keys(clientSummary).sort((a,b) => (clientSummary[b].sold - clientSummary[b].paid) - (clientSummary[a].sold - clientSummary[a].paid));
            
            sortedClients.forEach(name => {
                const stats = clientSummary[name];
                const bal = stats.sold - stats.paid;
                if(stats.sold === 0 && stats.paid === 0) return;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span style="font-weight:700">${name}</span></td>
                    <td>₹${stats.sold.toLocaleString()}</td>
                    <td>₹${stats.paid.toLocaleString()}</td>
                    <td style="text-align:right; font-weight:800; color:${bal > 0 ? 'var(--danger)' : 'var(--success)'}">₹${bal.toLocaleString()}</td>
                `;
                cTable.appendChild(tr);
            });
        }

        // Render Revenue Trend Chart
        const chartCanvas = document.getElementById('salesChart');
        if(chartCanvas) {
            if(salesChart) salesChart.destroy();
            const ctx = chartCanvas.getContext('2d');
            salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyRev.map(x => x.date.split('-').slice(1).join('/')),
                    datasets: [{
                        label: 'Revenue',
                        data: dailyRev.map(x => x.rev),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 0,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { 
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        }
    }

