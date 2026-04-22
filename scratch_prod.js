
import { db, doc, setDoc, onSnapshot, getDoc, collection, getDocs } from "../firebase-config.js";

/* --- CONFIG --- */
const SHOPS = ["Nettor", "Kannankulangara", "Vadakkekotta"];
let STAFF = { Nettor:[], Kannankulangara:[], Vadakkekotta:[] };
const DB_KEY = "IYERSFOOD_ERP_V3_3"; 
const CLIENT_DB_KEY = "IYERS_CLIENT_DB_V2";
const empty = `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">No records for this selection</td></tr>`;

/* --- STATE --- */
let erpData = {};
let currentDate = "";
let currentProduct = "DOSA";
let currentCategory = "PACKET";
let activeSection = "production";
let editState = { prod: null, del: null, dec: null, ret: null }; 

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sb.classList.toggle('open');
    overlay.classList.toggle('show');
}

function switchSection(sectionId) {
    activeSection = sectionId;
    
    // Update Sidebar UI
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(`'${sectionId}'`)) {
            item.classList.add('active');
        }
    });

    // Update Section Visibility
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    // Close Sidebar on Mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.remove('open');
        document.querySelector('.sidebar-overlay').classList.remove('show');
    }

    // Toggle Global Stats Visibility (Only for Production/Dispatch)
    const stats = document.getElementById('globalStats');
    if (sectionId === 'production' || sectionId === 'dispatch') {
        stats.style.display = 'grid';
    } else {
        stats.style.display = 'none';
    }

    render();
}

function resetAllData() {
    if (confirm("⚠️ CAUTION: RESET ALL DATA?\n\nThis will permanently delete all logs and production records.\n\nAre you sure you want to proceed?")) {
        setDoc(doc(db, "data", "erp"), {})
            .then(() => alert("Daily logs have been cleared on Firestore."))
            .catch(err => alert("Error resetting data: " + err.message));
    }
}

// Function to handle App Initialization
// Module-level element references
let activeShop, workDate, retShop, activeStaff, delProdStaff, delStaff, prodQty, delQty, retQty, decCount, decStaff;

function initApp() {
    loadDataFromStorage();
    
    activeShop = document.getElementById('activeShop');
    workDate = document.getElementById('workDate');
    retShop = document.getElementById('retShop');
    activeStaff = document.getElementById('activeStaff');
    delProdStaff = document.getElementById('delProdStaff');
    delStaff = document.getElementById('delStaff');
    prodQty = document.getElementById('prodQty');
    delQty = document.getElementById('delQty');
    retQty = document.getElementById('retQty');
    decCount = document.getElementById('decCount');
    decStaff = document.getElementById('decStaff');

    if (activeShop) {
        activeShop.innerHTML = `<option value="ALL">All Shops</option>` + SHOPS.map(s=>`<option value="${s}">${s}</option>`).join("");
        activeShop.onchange = syncShopUI;
    }
    
    if (workDate) {
        workDate.value = new Date().toISOString().split("T")[0];
        workDate.onchange = () => switchDate(workDate.value);
        switchDate(workDate.value);
    }
    
    if (retShop) {
        retShop.innerHTML = SHOPS.map(s=>`<option value="${s}">${s}</option>`).join("");
    }
    
    loadClients();
    loadStaff();
    initStaffGrid();
    setCategory(currentCategory);
    switchSection('production'); 
}

function loadStaff() {
    onSnapshot(doc(db, "data", "staff"), (snapshot) => {
        if(snapshot.exists()) {
            const list = snapshot.data().list || [];
            // Group by role
            let newProd = { Nettor:[], Kannankulangara:[], Vadakkekotta:[] };
            let newDrivers = [];
            
            list.forEach(s => {
                if(s.type === 'PRODUCTION') {
                    if(s.shop === 'Common') {
                        SHOPS.forEach(sh => newProd[sh].push(s.name));
                    } else if(newProd[s.shop]) {
                        newProd[s.shop].push(s.name);
                    }
                } else if(s.type === 'DELIVERY') {
                    newDrivers.push(s.name);
                }
            });
            
            STAFF = newProd;
            window.DRIVERS = newDrivers.sort();
            syncShopUI();
            syncDecUI();
        }
    });
}

// Module scripts are deferred, so DOM is guaranteed to be ready here
initApp();

// Use an object to hold state to avoid reference replacement issues
const state = {
    erpData,
    currentDate,
    currentProduct,
    currentCategory,
    activeSection,
    editState
};

// Expose proxy-like sync function
function syncWindow() {
    Object.assign(window, {
        erpData, currentDate, currentProduct, currentCategory, activeSection, editState,
        toggleSidebar, switchSection, resetAllData, loadClients, loadDataFromStorage,
        saveData, repairData, generateId, getBatchColor, switchDate, cancelAllEdits,
        setCategory, getBatchKey, getCurrentBatchCode, handleManualBatchChange,
        handleFinishBatch, setProductContext, syncShopUI, syncDecUI,
        handleAddProduction, handleAddDelivery, handleAddReturn, handleSubmitDec,
        editItem, deleteItem, cancelEditMode, initStaffGrid, showStaffStats, render,
        editProd: (id) => editItem('PROD', id), deleteProd: (id) => deleteItem('PROD', id),
        editDel: (id) => editItem('DEL', id), deleteDel: (id) => deleteItem('DEL', id),
        editDec: (id) => editItem('DEC', id), deleteDec: (id) => deleteItem('DEC', id),
        editRet: (id) => editItem('RET', id), deleteRet: (id) => deleteItem('RET', id)
    });
}
syncWindow();

function loadClients() {
    const docRef = doc(db, "data", "clients");
    onSnapshot(docRef, (snapshot) => {
        if(!snapshot.exists()) return;
        const list = snapshot.data().list || [];
        const dl = document.getElementById('clientOptions');
        if(!dl) return;
        
        const clients = list.map(c => typeof c === 'string' ? c : c.name).sort();
        dl.innerHTML = clients.map(c => `<option value="${c}">`).join("");
    });

    // Initial check/migration
    getDoc(docRef).then((snapshot) => {
        if(!snapshot.exists()) {
            const rawC = localStorage.getItem(CLIENT_DB_KEY);
            if(rawC) setDoc(docRef, { list: JSON.parse(rawC) });
        }
    });
}

/* --- DATA HANDLING --- */
function loadDataFromStorage() {
    const docRef = doc(db, "data", "erp");
    onSnapshot(docRef, (snapshot) => {
        if(!snapshot.exists()) return;
        const data = snapshot.data();
        if(data) {
            erpData = data; 
            repairData();
            if(currentDate && !erpData[currentDate]) {
                erpData[currentDate] = { productions: [], deliveries: [], staffDeclarations: [], returns: [] };
            }
            syncWindow();
            render();
        }
    }, (error) => {
        console.error("Firestore read error:", error);
    });

    getDoc(docRef).then((snapshot) => {
        if(!snapshot.exists()) {
            const raw = localStorage.getItem(DB_KEY);
            if(raw) {
                erpData = JSON.parse(raw);
                saveData();
                syncWindow();
            }
        }
    });
}
function saveData() { 
    if(!db) return console.error("DB not initialized");
    setDoc(doc(db, "data", "erp"), erpData)
        .then(() => console.log("Firestore save success"))
        .catch(err => {
            console.error("Firestore save failed:", err);
            alert("Error: Data not saved to Firestore. Check rules.");
        });
}
function repairData() {
    for(let d in erpData) {
        if(!erpData[d]) erpData[d] = {};
        if(!erpData[d].productions) erpData[d].productions = [];
        if(!erpData[d].deliveries) erpData[d].deliveries = [];
        if(!erpData[d].staffDeclarations) erpData[d].staffDeclarations = [];
        if(!erpData[d].returns) erpData[d].returns = [];
        if(!erpData[d].batchSeq) erpData[d].batchSeq = {};
    }
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
function getBatchColor(bn) {
    if(!bn || bn === "-") return { bg: '#f1f5f9', text: '#64748b' };
    const hash = bn.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
        { bg: '#e0e7ff', text: '#4338ca' }, // Indigo
        { bg: '#dcfce7', text: '#15803d' }, // Green
        { bg: '#fee2e2', text: '#b91c1c' }, // Red
        { bg: '#fef9c3', text: '#a16207' }, // Yellow
        { bg: '#f3e8ff', text: '#7e22ce' }, // Purple
        { bg: '#ffedd5', text: '#9a3412' }, // Orange
        { bg: '#e0f2fe', text: '#0369a1' }, // Blue
        { bg: '#fae8ff', text: '#a21caf' }  // Pink
    ];
    return colors[hash % colors.length];
}

function switchDate(date) {
    currentDate = date;
    const badge = document.getElementById('dateDisplayBadge');
    if(badge) badge.innerText = new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if(!erpData[date]) erpData[date] = { productions: [], deliveries: [], staffDeclarations: [], returns: [] };
    cancelAllEdits();
    const details = document.getElementById('staffDetailsCard');
    if(details) details.style.display = 'none';
    syncShopUI(); syncDecUI();
    syncWindow();
}
function cancelAllEdits() { cancelEditMode('PROD'); cancelEditMode('DEL'); cancelEditMode('DEC'); cancelEditMode('RET'); }

function setCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-option').forEach(o => {
        o.classList.remove('active');
        if(o.dataset.cat === cat) o.classList.add('active');
    });
    const lbl = document.getElementById('uiBalLabel');
    if(lbl) lbl.innerText = cat === 'PACKET' ? 'Packet Stock' : 'Loose Stock';
    
    const prodClientWrap = document.getElementById('prodClientWrapper');
    if(prodClientWrap) prodClientWrap.style.display = (cat === 'LOOSE') ? 'block' : 'none';

    const delClientWrap = document.getElementById('delClientWrapper');
    if(delClientWrap) delClientWrap.style.display = (cat === 'LOOSE') ? 'block' : 'none';

    const retClientWrap = document.getElementById('retClientWrapper');
    if(retClientWrap) retClientWrap.style.display = (cat === 'LOOSE') ? 'block' : 'none';

    const retShopWrap = document.getElementById('retShopWrapper');
    if(retShopWrap) retShopWrap.style.display = 'block';

    const details = document.getElementById('staffDetailsCard');
    if(details) details.style.display = 'none';
    syncWindow();
    render();
}

/* --- BATCH MANAGEMENT --- */
function getBatchKey() {
    return `${activeShop.value}_${currentProduct}`;
}
function getCurrentBatchCode() {
    const day = erpData[currentDate];
    if(!day) return "-";
    if(!day.batchSeq) day.batchSeq = {};
    
    const key = getBatchKey();
    const seq = day.batchSeq[key] || 1;
    
    const sCode = activeShop.value.slice(0,1).toUpperCase();
    const pCode = currentProduct.slice(0,1).toUpperCase(); // D or A
    
    return `${sCode}${pCode}-${seq}`;
}
function handleManualBatchChange(val) {
    const shop = activeShop.value;
    if(shop === "ALL") return;
    const v = parseInt(val);
    if(isNaN(v) || v < 1) return;
    
    const day = erpData[currentDate];
    if(!day.batchSeq) day.batchSeq = {};
    day.batchSeq[getBatchKey()] = v;

    // Dynamically update the batch of the item being edited
    if(editState.prod) {
        const item = day.productions.find(p => p.id === editState.prod);
        if(item) {
            item.bn = getCurrentBatchCode(); 
        }
    }
    
    saveData(); render();
}

function handleFinishBatch() {
    const shop = activeShop.value;
    if(shop === "ALL") return alert("Select Shop first");
    
    const key = getBatchKey();
    const day = erpData[currentDate];
    if(!day.batchSeq) day.batchSeq = {};
    const curr = day.batchSeq[key] || 1;

    const otherCat = currentCategory === 'PACKET' ? 'LOOSE' : 'PACKET';
    const msg = `BATCH FUSION: #${curr}\n\nIs this batch finished for BOTH Packet & Loose production?\n\n- Click OK if EVERYTHING is done (Moves to Batch #${curr+1})\n- Click CANCEL to switch to ${otherCat} and continue Batch #${curr}`;

    if (confirm(msg)) {
        day.batchSeq[key] = curr + 1;
        saveData();
        setCategory('PACKET'); // Default next batch to Packet view
        render();
    } else {
        setCategory(otherCat);
    }
}

function setProductContext(prod) {
    currentProduct = prod;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if(b.dataset.prod === prod) b.classList.add('active');
    });
    document.getElementById('staffDetailsCard').style.display = 'none';
    render();
}

function syncShopUI() {
    const shop = activeShop.value;
    activeStaff.innerHTML = ""; 
    delProdStaff.innerHTML = "";
    delStaff.innerHTML = "";
    retStaff.innerHTML = '<option value="InHouse">In House (Factory)</option>';
    
    if(shop === "ALL") { render(); return; }
    
    // Populate Production Staff
    if(STAFF[shop]) {
        STAFF[shop].forEach(s => { 
            activeStaff.add(new Option(s, s)); 
            delProdStaff.add(new Option(s, s)); 
            retStaff.add(new Option(s, s));
        });
    }
    
    // Populate Drivers into Dispatch and Returns
    if(window.DRIVERS) {
        window.DRIVERS.forEach(d => {
            delStaff.add(new Option(d, d));
            retStaff.add(new Option(d, d));
        });
    }
    
    // Sync Returns Shop if not in ALL mode
    if(shop !== "ALL") retShop.value = shop;

    syncDecUI(); // Sync Declaration UI as well
    render(); 
}
function syncDecUI() {
    const shop = activeShop.value;
    decStaff.innerHTML = "";
    if(shop === "ALL") return;
    if(STAFF[shop]) STAFF[shop].forEach(s => decStaff.add(new Option(s, s)));
}

/* --- MATH --- */
function calculateDailyMovement(date, shopFilter, productFilter) {
    let stats = 0;
    const day = erpData[date];
    if(!day) return 0;

    function process(arr, typeKey, qtyKey, isAdd) {
        arr.forEach(item => {
            if(item.product !== productFilter) return;
            if(shopFilter !== "ALL" && item.shop !== shopFilter) return;
            
            let t = item[typeKey]; 
            if(typeKey === 'ret') t = item.stockType;
            
            if(t !== currentCategory) return;

            let q = item[qtyKey] || 0;
            
            if(typeKey === 'ret') {
                if(item.action === 'RETURN') stats += q; 
                // DAMAGE is no longer deducted from stock
                return;
            }

            if(isAdd) stats += q;
            else stats -= q;
        });
    }

    process(day.productions, 'type', 'qty', true);
    process(day.deliveries, 'type', 'qty', false);
    process(day.returns, 'ret', 'qty', true); 

    return stats;
}

function getOpeningBalance(dateLimit, shop, product) {
    let total = 0;
    Object.keys(erpData).forEach(d => {
        if(d < dateLimit) {
            total += calculateDailyMovement(d, shop, product);
        }
    });
    return total;
}

function getClientBalances(dateLimit, shop, product) {
    const balances = {};
    const dates = Object.keys(erpData).sort();
    dates.forEach(d => {
        if (d > dateLimit) return;
        const day = erpData[d];
        if (!day) return;
        const isToday = (d === dateLimit);
        const getB = (c) => {
            const name = c || 'Unknown';
            if (!balances[name]) balances[name] = { opening: 0, prod: 0, disp: 0, ret: 0, dmg: 0 };
            return balances[name];
        };
        (day.productions || []).forEach(p => {
            if (p.product === product && (shop === "ALL" || p.shop === shop) && p.type === 'LOOSE') {
                const b = getB(p.client);
                if (isToday) b.prod += (p.qty || 0);
                else b.opening += (p.qty || 0);
            }
        });
        (day.deliveries || []).forEach(del => {
            if (del.product === product && (shop === "ALL" || del.shop === shop) && del.type === 'LOOSE') {
                const b = getB(del.client);
                if (isToday) b.disp += (del.qty || 0);
                else b.opening -= (del.qty || 0);
            }
        });
        (day.returns || []).forEach(r => {
            if (r.product === product && (shop === "ALL" || r.shop === shop) && r.stockType === 'LOOSE') {
                const b = getB(r.client);
                const val = r.qty || 0;
                if (isToday) {
                    if (r.action === 'RETURN') b.ret += val;
                    else b.dmg += val;
                } else {
                    if (r.action === 'RETURN') b.opening += val;
                    // DAMAGE is no longer deducted from opening balance
                }
            }
        });
    });
    return balances;
}

/* --- ACTIONS --- */
function handleAddProduction() {
    const shop = activeShop.value;
    if(shop === "ALL") return alert("Select Shop");
    const qty = Number(prodQty.value);
    if(qty <= 0) return;
    const type = currentCategory;
    
    // Client handling for Loose
    let client = "";
    if(type === 'LOOSE') {
        const cEl = document.getElementById('prodClient');
        if(cEl && cEl.value) client = cEl.value;
        if(!client) return alert("Please select a Client for Loose production.");
    }

    const day = erpData[currentDate];
    if(!day.batchSeq) day.batchSeq = {}; // Ensure init

    // Use Active Batch Code
    const batchName = getCurrentBatchCode(); 

    if(editState.prod) {
        const idx = day.productions.findIndex(p => p.id === editState.prod);
        if(idx !== -1) day.productions[idx] = { ...day.productions[idx], shop, staff: activeStaff.value, type, qty, client, bn: batchName };
        cancelEditMode('PROD');
    } else {
        day.productions.push({ id: generateId(), shop, staff: activeStaff.value, product: currentProduct, type, qty, bn: batchName, client });
    }
    prodQty.value = ""; if(document.getElementById('prodClient')) document.getElementById('prodClient').value = "";
    saveData(); render();
}

function handleAddDelivery() {
    const shop = activeShop.value;
    if(shop === "ALL") return alert("Select Shop");
    const qty = Number(delQty.value);
    if(qty <= 0) return;
    const type = currentCategory;
    const day = erpData[currentDate];

    let client = "";
    if(type === 'LOOSE') {
         const cEl = document.getElementById('delClient');
         if(cEl && cEl.value) client = cEl.value;
    }

    if(editState.del) {
        const idx = day.deliveries.findIndex(d => d.id === editState.del);
        if(idx !== -1) day.deliveries[idx] = { ...day.deliveries[idx], shop, type, productionStaff: delProdStaff.value, deliveryStaff: delStaff.value, client, qty };
        cancelEditMode('DEL');
    } else {
        day.deliveries.push({ id: generateId(), shop, product: currentProduct, type, productionStaff: delProdStaff.value, deliveryStaff: delStaff.value, client, qty });
    }
    delQty.value = ""; if(document.getElementById('delClient')) document.getElementById('delClient').value = "";
    saveData(); render();
}

function handleAddReturn() {
    const shop = retShop.value;
    if(!shop) return alert("Select Shop");
    const qty = Number(retQty.value);
    if(qty <= 0) return;
    
    const action = document.querySelector('input[name="retAction"]:checked').value;
    const type = currentCategory;
    const client = document.getElementById('retClient').value;
    
    // Client is optional for Packet but encouraged, mandatory for Loose if user prefers
    if(type === 'LOOSE' && !client) return alert("Please select a Client for Loose items");
    
    const day = erpData[currentDate];

    if(editState.ret) {
        const idx = day.returns.findIndex(r => r.id === editState.ret);
        if(idx !== -1) day.returns[idx] = { ...day.returns[idx], shop, action, stockType: type, staff: retStaff.value, client, qty };
        cancelEditMode('RET');
    } else {
        day.returns.push({ id: generateId(), shop, product: currentProduct, action, stockType: type, staff: retStaff.value, client, qty });
    }
    retQty.value = ""; 
    if(document.getElementById('retClient')) document.getElementById('retClient').value = "";
    saveData(); render();
}

function handleSubmitDec() {
    const shop = activeShop.value, staff = decStaff.value;
    if(shop === "ALL") return alert("Select a shop first");
    const isAbsent = document.getElementById('decAbsent').checked;
    let declared = Number(decCount.value);
    
    const day = erpData[currentDate];
    if(!isAbsent && declared < 0) return;
    if(isAbsent) declared = 0;
    
    // COMBINED LOGIC: Count Unique Batch Numbers (BN) for this Staff + Product (Packet + Loose together)
    const prods = day.productions.filter(p => p.shop === shop && p.staff === staff && p.product === currentProduct);
    // Count unique BNs
    const uniqueBNs = new Set(prods.map(p => p.bn)).size;
    const actual = uniqueBNs;

    if(editState.dec) {
        const idx = day.staffDeclarations.findIndex(d => d.id === editState.dec);
        if(idx !== -1) day.staffDeclarations[idx] = { ...day.staffDeclarations[idx], shop, staff, declared, actual, type: 'COMBINED', isAbsent };
        cancelEditMode('DEC');
    } else {
        // Remove existing declarations for this staff/product to avoid duplicates
        day.staffDeclarations = day.staffDeclarations.filter(d => !(d.shop === shop && d.staff === staff && d.product === currentProduct));
        day.staffDeclarations.push({ id: generateId(), shop, staff, product: currentProduct, declared, actual, type: 'COMBINED', isAbsent });
    }
    decCount.value = ""; document.getElementById('decAbsent').checked = false; saveData(); render();
}

/* --- EDIT/DELETE HELPERS --- */
function editItem(type, id) {
    const day = erpData[currentDate];
    if(type === 'PROD') {
        const i = day.productions.find(p=>p.id===id); if(!i) return;
        if(i.product!==currentProduct) setProductContext(i.product);
        if(i.type!==currentCategory) setCategory(i.type);
        activeShop.value=i.shop;

        // Sync batch sequence to the item's batch BEFORE syncing UI
        if(i.bn && i.bn.includes('-')) {
            const seq = parseInt(i.bn.split('-')[1]);
            if(!isNaN(seq)) {
                if(!day.batchSeq) day.batchSeq = {};
                day.batchSeq[getBatchKey()] = seq;
            }
        }

        syncShopUI(); 
        activeStaff.value=i.staff; prodQty.value=i.qty;
        if(i.type === 'LOOSE' &&  document.getElementById('prodClient')) document.getElementById('prodClient').value = (i.client || "");
        editState.prod=id; activeShop.disabled=true;
        document.getElementById('btnProdAdd').innerHTML="Update Production"; document.getElementById('btnProdCancel').style.display="block";
        render(); // Refresh to update batch color and sequence input
    }
    if(type === 'DEL') {
        const i = day.deliveries.find(d=>d.id===id); if(!i) return;
        if(i.product!==currentProduct) setProductContext(i.product);
        if(i.type!==currentCategory) setCategory(i.type);
        activeShop.value=i.shop; syncShopUI(); delProdStaff.value=i.productionStaff; delStaff.value=i.deliveryStaff; delQty.value=i.qty;
        if(i.type === 'LOOSE' &&  document.getElementById('delClient')) document.getElementById('delClient').value = (i.client || "");
        editState.del=id; activeShop.disabled=true;
        document.getElementById('btnDelAdd').innerHTML="Update Dispatch"; document.getElementById('btnDelCancel').style.display="block";
    }
    if(type === 'RET') {
        const i = day.returns.find(r=>r.id===id); if(!i) return;
        if(i.product!==currentProduct) setProductContext(i.product);
        if(i.stockType!==currentCategory) setCategory(i.stockType);
        retShop.value=i.shop; retStaff.value=i.staff; retQty.value=i.qty;
        if(document.getElementById('retClient')) document.getElementById('retClient').value = (i.client || "");
        document.getElementsByName('retAction').forEach(r => r.checked = (r.value === i.action));
        editState.ret=id; activeShop.disabled=true;
        document.getElementById('btnRetAdd').innerHTML="Update Entry"; document.getElementById('btnRetCancel').style.display="block";
    }
    if(type === 'DEC') {
        const i = day.staffDeclarations.find(d=>d.id===id); if(!i) return;
        activeShop.value=i.shop; syncDecUI(); decStaff.value=i.staff; decCount.value=i.declared;
        document.getElementById('decAbsent').checked = (i.isAbsent === true);
        editState.dec=id;
        document.getElementById('btnDecAdd').innerHTML="Update"; document.getElementById('btnDecCancel').style.display="inline-block";
    }
}
function deleteItem(type, id) {
    if(!confirm("Delete?")) return;
    const day = erpData[currentDate];
    if(type==='PROD') {
        day.productions = day.productions.filter(i => i.id !== id);
    } else if(type==='DEL') {
        day.deliveries = day.deliveries.filter(i => i.id !== id);
    } else if(type==='RET') {
        day.returns = day.returns.filter(i => i.id !== id);
    } else if(type==='DEC') {
        day.staffDeclarations = day.staffDeclarations.filter(i => i.id !== id);
    }
    saveData(); 
    render();
}
function cancelEditMode(type) {
    activeShop.disabled=false;
    if(type==='PROD') { 
        editState.prod=null; 
        document.getElementById('btnProdAdd').innerHTML="<span>+</span> Save Production"; 
        document.getElementById('btnProdCancel').style.display="none"; 
        prodQty.value=""; 
        if(document.getElementById('prodClient')) document.getElementById('prodClient').value = ""; 
    }
    if(type==='DEL') { 
        editState.del=null; 
        document.getElementById('btnDelAdd').innerHTML="<span>&#x2192;</span> Confirm Dispatch"; 
        document.getElementById('btnDelCancel').style.display="none"; 
        delQty.value=""; 
        if(document.getElementById('delClient')) document.getElementById('delClient').value = ""; 
    }
    if(type==='RET') { 
        editState.ret=null; 
        document.getElementById('btnRetAdd').innerHTML="<span>!</span> Record Entry"; 
        document.getElementById('btnRetCancel').style.display="none"; 
        retQty.value=""; 
        if(document.getElementById('retClient')) document.getElementById('retClient').value = "";
    }
    if(type==='DEC') { 
        editState.dec=null; 
        document.getElementById('btnDecAdd').innerHTML="<span>&#10003;</span> Verify & Save"; 
        document.getElementById('btnDecCancel').style.display="none"; 
        decCount.value=""; 
        document.getElementById('decAbsent').checked = false;
    }
}

/* --- STAFF GRID --- */
function initStaffGrid() {
    const grid = document.getElementById('staffGrid'); grid.innerHTML = "";
    let all = []; Object.values(STAFF).forEach(arr => all.push(...arr));
    [...new Set(all)].forEach(name => {
        grid.innerHTML += `<div class="chip" onclick="showStaffStats('${name}', this)">${name}</div>`;
    });
}
function showStaffStats(name, el) {
    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active')); 
    if(el) el.classList.add('active');
    
    const day = erpData[currentDate];
    // COMBINED: Filter by Staff & Product ONLY (Combine Packet + Loose)
    const prods = day.productions.filter(p => p.staff === name && p.product === currentProduct);
    
    // Group by Batch
    const batchSummary = {};
    prods.forEach(p => {
        if(!batchSummary[p.bn]) batchSummary[p.bn] = 0;
        batchSummary[p.bn] += p.qty;
    });
    
    const uniqueBatches = Object.keys(batchSummary).sort();
    const totalVolume = Object.values(batchSummary).reduce((a, b) => a + b, 0);

    document.getElementById('sdName').innerText = name; 
    document.getElementById('sdProduct').innerText = currentProduct;
    document.getElementById('sdBatches').innerText = uniqueBatches.length;
    document.getElementById('sdVolume').innerText = totalVolume + " L";
    
    const list = document.getElementById('sdList'); 
    list.innerHTML = "";
    
    if(uniqueBatches.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:10px">No data</div>`;
    } else {
        uniqueBatches.forEach(bn => {
            const batchItems = prods.filter(p => p.bn === bn);
            const qty = batchItems.reduce((a, b) => a + (b.qty || 0), 0);
            const clients = [...new Set(batchItems.filter(p => p.type === 'LOOSE').map(p => p.client))].join(", ");
            const bClr = getBatchColor(bn);
            
            list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px dashed #e2e8f0">
                    <div>
                        <span class="badge" style="background:${bClr.bg}; color:${bClr.text}; font-size:11px">${bn}</span>
                        ${clients ? `<div style="font-size:10px; color:#64748b; margin-top:2px">${clients}</div>` : ''}
                    </div>
                    <strong style="font-size:14px">${qty} L</strong>
                </div>`;
        });
    }
    document.getElementById('staffDetailsCard').style.display = 'block';
}

/* --- RENDER --- */
function render() {
    const day = erpData[currentDate];
    const shop = activeShop.value;
    
    // Calculate Stats
    const daily = calculateDailyMovement(currentDate, shop, currentProduct);
    const opening = getOpeningBalance(currentDate, shop, currentProduct);
    
    // Update Batch UI
    const pUi = document.getElementById('uibatchPrefix');
    const sUi = document.getElementById('batchSeqInput');
    if(pUi && sUi) {
        if(shop === "ALL") {
            pUi.innerText = "-";
            sUi.value = ""; sUi.disabled = true;
            pUi.style.color = "var(--primary)";
        } else {
            const day = erpData[currentDate];
            if(!day.batchSeq) day.batchSeq = {};
            const seq = day.batchSeq[getBatchKey()] || 1;
            
            const sCode = shop.slice(0,1).toUpperCase();
            const pCode = currentProduct.slice(0,1).toUpperCase();
            const prefix = `${sCode}${pCode}-`;
            
            pUi.innerText = prefix;
            sUi.value = seq; sUi.disabled = false;
            
            const bClr = getBatchColor(`${prefix}${seq}`);
            pUi.style.color = bClr.text;
            sUi.style.color = bClr.text;
            sUi.style.borderBottomColor = bClr.text;
        }
    }
    
    // Update UI
    document.getElementById('uiOpen').innerText = opening;
    
    // Calculate Production Today
    let producedToday = 0;
    if(day && day.productions) {
        day.productions.forEach(p => {
             if(p.product === currentProduct && (shop === "ALL" || p.shop === shop) && p.type === currentCategory) {
                  producedToday += p.qty;
             }
        });
    }
    document.getElementById('uiProduced').innerText = producedToday;

    // Calculate Dispatch Today
    let dispatchedToday = 0;
    if(day && day.deliveries) {
        day.deliveries.forEach(d => {
             if(d.product === currentProduct && (shop === "ALL" || d.shop === shop) && d.type === currentCategory) {
                  dispatchedToday += d.qty;
             }
        });
    }

    // --- ALERT & LOGIC CONSOLIDATION ---
    const mismatchEl = document.getElementById('looseMismatchAlert');
    const undispatchedEl = document.getElementById('looseUndispatchedAlert');
    const undispatchedContent = document.getElementById('looseUndispatchedContent');
    const summaryCard = document.getElementById('looseDeliveryLogCard');
    const summaryLog = document.getElementById('looseDeliveryLog');

    if (currentCategory === 'LOOSE') {
        const clientBalances = getClientBalances(currentDate, shop, currentProduct);
        const criticalErrors = []; 
        const pendingStock = [];   

        // Corrected Logic: Production + Opening Balance = Dispatch. Balance remains in Loose Stock.
        const currentStockBal = opening + daily;
        if (currentStockBal < 0) {
            criticalErrors.push(`Inventory Shortage: ${Math.abs(currentStockBal)}L (Dispatch exceeds total stock available)`);
        }

        Object.keys(clientBalances).sort().forEach(c => {
            const b = clientBalances[c];
            const closing = (b.opening + b.prod) - (b.disp - b.ret); // DAMAGE removed from deduction logic
            if (closing < 0) criticalErrors.push(`${c}: Excess Dispatch (${Math.abs(closing)}L)`);
            else if (closing > 0) pendingStock.push({ name: c, qty: closing });
        });

        // Update Mismatch Alert
        if (criticalErrors.length > 0 && mismatchEl) {
            mismatchEl.style.display = 'block';
            mismatchEl.innerHTML = `<strong>⚠️ Inventory Discrepancy</strong><div style="font-size:11px; font-weight:400; margin-top:4px">${criticalErrors.join("<br>")}</div>`;
        } else if (mismatchEl) {
            mismatchEl.style.display = 'none';
        }

        // Update Undispatched Dashboard Alert
        if (pendingStock.length > 0 && undispatchedEl && undispatchedContent) {
            undispatchedEl.style.display = 'block';
            undispatchedContent.innerHTML = pendingStock.map(p => `<div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:2px"><span>${p.name}</span><span style="font-weight:700">${p.qty}L</span></div>`).join("");
        } else if (undispatchedEl) {
            undispatchedEl.style.display = 'none';
        }

        // Update Tomorrow's Queue Log
        if (summaryCard && summaryLog) {
            summaryCard.style.display = 'block';
            summaryLog.innerHTML = pendingStock.length === 0 ? `<tr><td colspan="2" style="text-align:center;color:#cbd5e1;padding:10px">Zero Carryover - All Cleared</td></tr>` : pendingStock.map(e => `<tr><td>${e.name}</td><td style="text-align:right; font-weight:700">${e.qty}</td></tr>`).join("");
        }
    } else {
        if (mismatchEl) mismatchEl.style.display = 'none';
        if (undispatchedEl) undispatchedEl.style.display = 'none';
        if (summaryCard) summaryCard.style.display = 'none';
    }

    const bal = opening + daily;
    
    document.getElementById('uiBal').innerHTML = `${bal} <span class="stat-unit">L</span>`;
    // Removed old packet/loose ui element updates using innerHTML or innerText if they don't exist anymore loops
    // Wait, the IDs uiBalPacket etc are gone, replaced by uiBal and uiOpen.
    // So the above is correct.

    const pLog = document.getElementById('prodLog'); pLog.innerHTML = "";
    // Update headers based on Category
    const pHeads = document.querySelector('#prodLog').previousElementSibling.firstElementChild; // the <thead><tr>
    if(pHeads) {
        if(currentCategory === 'LOOSE') pHeads.innerHTML = `<th>Batch</th><th>Who / Shop</th><th>Client</th><th style="text-align:right">Qty</th><th style="text-align:right"></th>`;
        else pHeads.innerHTML = `<th>Batch</th><th>Who / Shop</th><th>Type</th><th style="text-align:right">Qty</th><th style="text-align:right"></th>`;
    }

    const dLog = document.getElementById('delLog'); dLog.innerHTML = "";
    // Update Dispatch headers
    const dHeads = document.querySelector('#delLog').previousElementSibling.firstElementChild; 
    if(dHeads) {
        if(currentCategory === 'LOOSE') dHeads.innerHTML = `<th>From</th><th>Driver</th><th>Client</th><th style="text-align:right">Qty</th><th style="text-align:right"></th>`;
        else dHeads.innerHTML = `<th>From</th><th>Driver</th><th style="text-align:right">Qty</th><th style="text-align:right"></th>`;
    }

    const rLog = document.getElementById('retLog'); rLog.innerHTML = "";
    const dcLog = document.getElementById('decLog'); dcLog.innerHTML = "";

    if(day) {
        // SORTED PRODUCTION LOG
        const sortedProds = [...day.productions] // Clone to ensure no mutation issues
            .filter(i => i.product === currentProduct && (shop === "ALL" || i.shop === shop) && i.type === currentCategory)
            .sort((a, b) => {
                const getSeq = (bn) => {
                    if (!bn || typeof bn !== 'string') return 0;
                    const cleanBn = bn.trim();
                    if (cleanBn === '-') return 0;
                    const parts = cleanBn.split('-');
                    // Handle cases like "ND-7" -> 7, or just "7" -> 7
                    const numPart = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                    return parseInt(numPart, 10) || 0;
                };
                const seqA = getSeq(a.bn);
                const seqB = getSeq(b.bn);
                return seqA - seqB;
            });

        sortedProds.forEach(i => {
            let extraCol = "";
            if(currentCategory === 'LOOSE') {
                extraCol = `<td>${i.client || '-'}</td>`;
            } else {
                extraCol = `<td><span class="badge ${i.type==='PACKET'?'bg-pkt':'bg-ls'}">${i.type}</span></td>`;
            }

            const bClr = getBatchColor(i.bn);
            pLog.innerHTML += `<tr><td><span class="badge" style="background:${bClr.bg};color:${bClr.text}">${i.bn}</span></td><td><div style="font-weight:700">${i.staff}</div><div style="font-size:10px; color:#64748b">${i.shop}</div></td>${extraCol}<td style="text-align:right;font-weight:700">${i.qty}</td><td style="text-align:right"><div class="btn-action-group"><button class="btn-icon btn-edit" onclick="editItem('PROD','${i.id}')">E</button><button class="btn-icon btn-del" onclick="deleteItem('PROD','${i.id}')">D</button></div></td></tr>`;
        });
        day.deliveries.forEach(i => {
            if(i.product!==currentProduct || (shop!=="ALL" && i.shop!==shop) || i.type!==currentCategory) return;
            
            let extraCols = "";
            if(currentCategory === 'LOOSE') {
                extraCols = `<td>${i.deliveryStaff}</td><td>${i.client || '-'}</td>`;
            } else {
                extraCols = `<td>${i.deliveryStaff}</td>`;
            }

            dLog.innerHTML += `<tr><td>${i.productionStaff}</td>${extraCols}<td style="text-align:right;font-weight:700">${i.qty}</td><td style="text-align:right"><div class="btn-action-group"><button class="btn-icon btn-edit" onclick="editItem('DEL','${i.id}')">E</button><button class="btn-icon btn-del" onclick="deleteItem('DEL','${i.id}')">D</button></div></td></tr>`;
        });
        day.returns.forEach(i => {
            if(i.product!==currentProduct || (shop!=="ALL" && i.shop!==shop) || i.stockType!==currentCategory) return;
            const isRet = i.action === 'RETURN';
            rLog.innerHTML += `<tr><td><span class="badge ${isRet?'bg-green':'bg-red'}">${isRet?'RETURN':'DAMAGE'}</span></td><td><span class="badge ${i.stockType==='PACKET'?'bg-pkt':'bg-ls'}">${i.stockType}</span></td><td>${i.client || '-'}</td><td>${i.staff}</td><td style="text-align:right;font-weight:700">${i.qty}</td><td style="text-align:right"><div class="btn-action-group"><button class="btn-icon btn-edit" onclick="editItem('RET','${i.id}')">E</button><button class="btn-icon btn-del" onclick="deleteItem('RET','${i.id}')">D</button></div></td></tr>`;
        });
        day.staffDeclarations.forEach(i => {
            if(i.product!==currentProduct || (shop!=="ALL" && i.shop!==shop)) return;
            // COMBINED: Show all declarations for this staff regardless of type

            
            const isAbsent = i.isAbsent || false;
            const ok = i.declared === i.actual;
            dcLog.innerHTML += `<tr><td>${i.staff}</td><td>${isAbsent ? '<span class="badge bg-red">ABSENT</span>' : i.declared}</td><td>${i.actual}</td><td><span class="badge ${ok?'bg-green':'bg-red'}">${ok?'OK':'NO'}</span></td><td style="text-align:right"><div class="btn-action-group"><button class="btn-icon btn-edit" onclick="editItem('DEC','${i.id}')">E</button><button class="btn-icon btn-del" onclick="deleteItem('DEC','${i.id}')">D</button></div></td></tr>`;
        });
    }
    if(pLog.innerHTML==="") pLog.innerHTML=empty; if(dLog.innerHTML==="") dLog.innerHTML=empty; if(rLog.innerHTML==="") rLog.innerHTML=empty; if(dcLog.innerHTML==="") dcLog.innerHTML=empty;

    const ac = document.querySelector('.chip.active'); if(ac) showStaffStats(ac.innerText, ac);
}
