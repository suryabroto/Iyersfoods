
    // Firebase Configuration (Required for local file:// access via Compat SDK)
    const firebaseConfig = {
      apiKey: "AIzaSyBIGt_8Ty4Ufz9cpRfrLgbKgStb0j81Sto",
      authDomain: "iyers-c0944.firebaseapp.com",
      projectId: "iyers-c0944",
      storageBucket: "iyers-c0944.firebasestorage.app",
      messagingSenderId: "234376255779",
      appId: "1:234376255779:web:8f4b43ff3f66cfd4071496"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    /* --- CONFIG --- */
    const DEFAULT_PRICES = { dosa: 45, appam: 55 };
    const DB_KEY = "IYERS_ROUTE_V3_1";
    const CLIENT_DB_KEY = "IYERS_CLIENT_DB_V2";
    
    let SHOP_LIST = [];
    let SHOP_PRICES = {};

    /* --- STATE --- */
    let globalDB = {}; 
    let currentData = {};
    let selectedDate = "";
    let currentCategory = "PACKET";
    let selectedDriver = "";
    let activeSection = "overview";
    let pastDuesCache = {};
    let unsubscribeSnapshot = null; // Holds the active onSnapshot listener
    let lastSaveTime = 0; // Throttles full re-renders during active typing
    window.editState = { trip: null };

    function getEmptyRouteCategory() {
        return {
            trips: [],
            returns: [],
            shops: {},
            tally: { cashInHandMap: {}, denomsMap: {}, expenses: [], extraIncome: [] },
            activeShops: []
        };
    }

    function getEmptyRouteDay() {
        return {
            PACKET: getEmptyRouteCategory(),
            LOOSE: getEmptyRouteCategory()
        };
    }

    function isSingleCategoryRoutePayload(dayData) {
        if (!dayData || typeof dayData !== 'object') return false;
        return Array.isArray(dayData.trips) || Array.isArray(dayData.returns) || !!dayData.shops || !!dayData.tally;
    }

    function normalizeRouteDay(dayData, fallbackCategory = 'PACKET') {
        const base = getEmptyRouteDay();
        if (!dayData || typeof dayData !== 'object') return base;

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

        ['PACKET', 'LOOSE'].forEach(cat => {
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

    /* ---- FIRESTORE SAVE ---- */
    async function saveData() {
        lastSaveTime = Date.now();
        // 1. Update in-memory + localStorage cache immediately (fast / offline)
        if (!globalDB[selectedDate]) globalDB[selectedDate] = {};
        globalDB[selectedDate][currentCategory] = currentData;
        localStorage.setItem(DB_KEY, JSON.stringify(globalDB));

        // 2. Write the current day to its own Firestore document
        try {
            const routeRef = db.collection("routeDays").doc(selectedDate);
            const sanitizedDay = JSON.parse(JSON.stringify(normalizeRouteDay(globalDB[selectedDate], currentCategory)));
            await routeRef.set(sanitizedDay, { merge: true });
        } catch (err) {
            console.error("Firestore save error:", err);
        }
    }

    /* ---- LOAD A DATE FROM FIRESTORE (with localStorage cache for instant display) ---- */
    async function loadDateFromFirestore(date) {
        // Unsubscribe previous listener if switching dates
        if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }

        // Step 1: Try to show locally cached data immediately
        const raw = localStorage.getItem(DB_KEY);
        if (raw) {
            try { globalDB = JSON.parse(raw); } catch(e) { globalDB = {}; }
        }
        if (!globalDB[date]) globalDB[date] = getEmptyRouteDay();
        globalDB[date] = normalizeRouteDay(globalDB[date], currentCategory);
        currentData = globalDB[date][currentCategory];
        initShopDataForDate(date);
        pastDuesCache = {};
        SHOP_LIST.forEach(shop => {
            const bal = getPendingBalance(shop, date);
            if (bal !== 0) pastDuesCache[shop] = bal;
        });
        fullRender();

        // Step 2: Set up real-time listener on the per-day route document
        unsubscribeSnapshot = db.collection("routeDays").doc(date).onSnapshot({ includeMetadataChanges: true }, async (snap) => {
            // Priority Check: Is this a local write or are we in a typing cooldown?
            const isLocal = snap.metadata.hasPendingWrites;
            const now = Date.now();
            const recentlyTyped = (now - lastSaveTime) < 2000;

            // CRITICAL FIX: Guard BEFORE overwriting globalDB/currentData.
            // Overwriting currentData with a stale Firestore snapshot while the user is
            // typing was the root cause of Today's Sale resetting to ₹0 on credit entry.
            if (isLocal || recentlyTyped) {
                console.log("Sync skipped (Active Typing)");
                // Still persist to localStorage for cross-tab awareness, but
                // do NOT overwrite the live in-memory globalDB / currentData.
                return;
            }

            if (snap.exists) {
                globalDB[date] = normalizeRouteDay(snap.data(), currentCategory);
                if (isSingleCategoryRoutePayload(snap.data())) {
                    saveData();
                }
                localStorage.setItem(DB_KEY, JSON.stringify(globalDB));
                currentData = globalDB[date][currentCategory];
                initShopDataForDate(date);
            } else {
                // Legacy fallback: read the old shared route document once for this date
                try {
                    const legacySnap = await db.collection("data").doc("route").get();
                    const legacyData = legacySnap.exists ? legacySnap.data() : null;
                    if (legacyData && legacyData[date]) {
                        globalDB[date] = normalizeRouteDay(legacyData[date], currentCategory);
                        localStorage.setItem(DB_KEY, JSON.stringify(globalDB));
                    } else if (!globalDB[date]) {
                        globalDB[date] = getEmptyRouteDay();
                    }
                } catch (legacyErr) {
                    console.error("Legacy route read error:", legacyErr);
                    if (!globalDB[date]) globalDB[date] = getEmptyRouteDay();
                }
                currentData = globalDB[date][currentCategory];
                initShopDataForDate(date);
            }

            pastDuesCache = {};
            SHOP_LIST.forEach(shop => {
                const bal = getPendingBalance(shop, date);
                if (bal !== 0) pastDuesCache[shop] = bal;
            });
            fullRender();
        }, (err) => {
            console.error("Firestore listener error:", err);
        });
    }

    /* ---- LOAD CLIENTS FROM FIRESTORE (with real-time sync) ---- */
    function loadClients() {
        // Step 1: Initial load from localStorage for speed
        const rawClient = localStorage.getItem(CLIENT_DB_KEY);
        if (rawClient) {
            try {
                const clients = JSON.parse(rawClient);
                updateClientState(clients);
            } catch(e) {}
        }

        // Step 2: Real-time listener
        db.collection("data").doc("clients").onSnapshot((snap) => {
            if (snap.exists) {
                const clients = snap.data().list || [];
                updateClientState(clients);
                localStorage.setItem(CLIENT_DB_KEY, JSON.stringify(clients));
            }
        });
    }

    function updateClientState(clients) {
        SHOP_LIST = clients.map(c => typeof c === 'string' ? c : c.name);
        SHOP_PRICES = {};
        clients.forEach(c => {
            const name = typeof c === 'string' ? c : c.name;
            SHOP_PRICES[name] = { 
                pd: Number(c.pd) || DEFAULT_PRICES.dosa, 
                pa: Number(c.pa) || DEFAULT_PRICES.appam 
            };
        });
        if (selectedDate) {
            initShopDataForDate(selectedDate);
            fullRender();
        }
    }

    function getPrice(shop, type) {
        if (SHOP_PRICES[shop]) {
            return type === 'dosa' ? SHOP_PRICES[shop].pd : SHOP_PRICES[shop].pa;
        }
        return DEFAULT_PRICES[type];
    }

    function loadRouteMaster() {
        db.collection("data").doc("routeMaster").onSnapshot((snap) => {
            if(snap.exists) {
                const list = snap.data().list || [];
                const routes = list.map(s => s.name).sort();
                
                const gds = document.getElementById('globalDriverSelect');
                const tds = document.getElementById('tripDriver');
                
                if(gds) {
                    const current = gds.value;
                    gds.innerHTML = '<option value="">All Routes</option>' + routes.map(d => `<option>${d}</option>`).join("");
                    gds.value = current;
                }
                if(tds) {
                    const current = tds.value;
                    tds.innerHTML = '<option value="">Select Route...</option>' + routes.map(d => `<option>${d}</option>`).join("");
                    tds.value = current;
                }
            }
        });
    }

    // resetAllData function removed 


    /* ---- WINDOW ONLOAD ---- */
    window.onload = async () => {
        console.log("IyersRoute V3.1 Initializing...");
        
        try {
            // Priority 1: Always start on TODAY's date on every page load/refresh.
            // The user can navigate to other dates using the calendar, but refresh
            // always snaps back to the current working day.
            const today = new Date().toISOString().split('T')[0];
            const lastDate = today; // FIX: always today on refresh
            selectedDate = lastDate;
            
            // Priority 2: Initialize basic structure so buttons don't crash
            if (!globalDB[selectedDate]) globalDB[selectedDate] = getEmptyRouteDay();
            globalDB[selectedDate] = normalizeRouteDay(globalDB[selectedDate], currentCategory);
            currentData = globalDB[selectedDate][currentCategory];
            
            // Apply listeners and bootup
            loadClients();
            loadRouteMaster();
            
            const dInput = document.getElementById('workDate');
            if(dInput) dInput.value = selectedDate;
            const ds = document.getElementById('dateDisplay');
            if(ds) ds.innerText = new Date(selectedDate).toLocaleDateString('en-GB', { day:'numeric', month:'short' });

            if(dInput) {
                dInput.addEventListener('change', (e) => {
                    selectedDate = e.target.value;
                    document.getElementById('dateDisplay').innerText = new Date(selectedDate).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
                    loadDateFromFirestore(selectedDate);
                });
            }
            
            document.querySelectorAll('.sw-option').forEach(btn => btn.classList.remove('active'));
            const cBtn = document.querySelector(`.sw-option[data-cat="${currentCategory}"]`);
            if(cBtn) cBtn.classList.add('active');

            // Set section
            switchSection('overview');

            loadDateFromFirestore(selectedDate);
            console.log("Initialization complete!");
        } catch(err) {
            console.error("Init err:", err);
        }
    };

    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.querySelector('.sidebar-overlay').classList.toggle('show');
    }

    function switchSection(section) {
        activeSection = section;
        document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
        const sEl = document.getElementById(section);
        if(sEl) sEl.classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navEvent = document.querySelector(`.nav-item[onclick="switchSection('${section}')"]`);
        if(navEvent) navEvent.classList.add('active');
        
        const isMobile = window.innerWidth <= 1024;
        if(isMobile) {
            document.getElementById('sidebar').classList.remove('open');
            document.querySelector('.sidebar-overlay').classList.remove('show');
        }

        if(section === 'overview') renderStats();
        if(section === 'shops') renderShops();
        if(section === 'stock' || section === 'members') renderLogs();
        if(section === 'members') renderDeliveryMemberLogs();
        if(section === 'tally') renderTally();
    }

    function setCategory(cat) {
        currentCategory = cat;
        document.querySelectorAll('.sw-option').forEach(el => el.classList.remove('active'));
        const btn = document.querySelector(`.sw-option[data-cat="${cat}"]`);
        if(btn) btn.classList.add('active');

        if (!globalDB[selectedDate]) globalDB[selectedDate] = getEmptyRouteDay();
        globalDB[selectedDate] = normalizeRouteDay(globalDB[selectedDate], currentCategory);
        currentData = globalDB[selectedDate][currentCategory];
        
        fullRender();
    }

    function updateGlobalType(cat, el) { setCategory(cat); }

    function setGlobalDriver(driver) {
        selectedDriver = driver;
        
        const sel = document.getElementById('globalDriverSelect');
        if (sel && sel.value !== driver) sel.value = driver;

        renderStats();
        renderShops();
        renderDeliveryMemberLogs();
        renderCreditAlerts();
    }

    function openDatePicker() {
        const dInput = document.getElementById('workDate');
        if(dInput) dInput.showPicker();
    }

    function updateShopValue(shop, type, field, val) {
        if(!selectedDriver) {
            alert("⚠️ PLEASE SELECT A ROUTE FIRST!\n\nPlease select a route from the dropdown above before entering sales data.");
            renderShops();
            return;
        }
        if(!currentData.activeShops) currentData.activeShops = [];
        if(!currentData.activeShops.includes(shop)) currentData.activeShops.push(shop);

        if(!currentData.shops[shop]) currentData.shops[shop] = { dosa:{}, appam:{} };
        if(!currentData.shops[shop][type]) currentData.shops[shop][type] = {};
        
        currentData.shops[shop][type][field] = val;
        if(selectedDriver) currentData.shops[shop].driver = selectedDriver;
        saveData(); 
        updateShopRowUI(shop); 
        
        const idx = SHOP_LIST.indexOf(shop);
        if(idx !== -1) updateShopBalance(shop, idx);

        refreshDynamicUI(); 
    }
    
    function updateCashReceived(shop, val, idx) {
        if(!selectedDriver) {
            alert("⚠️ PLEASE SELECT A DRIVER FIRST!\n\nEvery driver delivers to different shops. Please select a driver from the chips above before entering sales data.");
            renderShops();
            return;
        }
        if(!currentData.activeShops) currentData.activeShops = [];
        if(!currentData.activeShops.includes(shop)) currentData.activeShops.push(shop);

        currentData.shops[shop].cashReceived = val;
        if(selectedDriver) currentData.shops[shop].driver = selectedDriver;
        saveData();
        updateShopRowUI(shop); 
        updateShopBalance(shop, idx);
        refreshDynamicUI();
    }

    function updateGpayReceived(shop, val, idx) {
        if(!selectedDriver) {
            alert("⚠️ PLEASE SELECT A DRIVER FIRST!\n\nEvery driver delivers to different shops. Please select a driver from the chips above before entering sales data.");
            renderShops();
            return;
        }
        if(!currentData.activeShops) currentData.activeShops = [];
        if(!currentData.activeShops.includes(shop)) currentData.activeShops.push(shop);

        currentData.shops[shop].gpayReceived = val;
        if(selectedDriver) currentData.shops[shop].driver = selectedDriver;
        saveData();
        updateShopRowUI(shop); 
        updateShopBalance(shop, idx);
        refreshDynamicUI();
    }
    
    function updateShopBalance(shop, idx) {
        const prevDues = getPendingBalance(shop, selectedDate);
        let todaySaleOnly = 0;  // Sale amount only (no credit)
        let cashRec = 0;
        let gpayRec = 0;

        const pD = getPrice(shop, 'dosa');
        const pA = getPrice(shop, 'appam');

        // ALWAYS read the ACTIVE category from the live in-memory currentData.
        // This prevents a stale Firestore snapshot from zeroing Today's Sale
        // the moment a credit/dmg/free field is changed.
        const sLocal = currentData.shops[shop];
        if (sLocal) {
            todaySaleOnly += (Number(sLocal.dosa?.sale) || 0) * pD +
                             (Number(sLocal.appam?.sale) || 0) * pA;
            cashRec  += Number(sLocal.cashReceived)  || 0;
            gpayRec  += Number(sLocal.gpayReceived)  || 0;
        }

        // For OTHER categories (e.g. LOOSE when currentCategory is PACKET) use globalDB
        const dayData = globalDB[selectedDate];
        if (dayData) {
            Object.keys(dayData).forEach(cat => {
                if (cat === currentCategory) return; // Already handled above
                const catObj = dayData[cat];
                if (!catObj || !catObj.shops) return;
                const s = catObj.shops[shop];
                if (!s) return;
                todaySaleOnly += (Number(s.dosa?.sale) || 0) * pD +
                                 (Number(s.appam?.sale) || 0) * pA;
                cashRec  += Number(s.cashReceived)  || 0;
                gpayRec  += Number(s.gpayReceived)  || 0;
            });
        }

        // Closing Balance = Previous Dues + Today's Sale (sale only) - Payments
        // Credit is NOT included here — it's tracked in Overview & Tally only
        const totalTarget = prevDues + todaySaleOnly;
        const balance = totalTarget - cashRec - gpayRec;
        
        const balEl = document.getElementById(`balance-${idx}`);
        const totEl = document.getElementById(`total-${idx}`);
        const prevEl = document.getElementById(`prev-${idx}`);
        
        if(prevEl) prevEl.innerText = `₹${prevDues}`;
        if(balEl) {
            balEl.innerText = `₹${balance}`;
            if(balance > 0) {
                balEl.style.color = '#ef4444';
            } else if(balance < 0) {
                balEl.style.color = '#f59e0b';
            } else {
                balEl.style.color = '#10b981';
            }
        }
        if(totEl) totEl.innerText = `₹${todaySaleOnly}`;
    }
    // Updates only the header and class of the shop card (lightweight)
    function updateShopRowUI(shop) {
        const idx = SHOP_LIST.indexOf(shop);
        const dayData = globalDB[selectedDate] || {};
        
        let totalValToday = 0;
        let totalCashToday = 0;
        let hasActivity = false;
        let shopDriver = null;

        Object.keys(dayData).forEach(cat => {
            const catObj = dayData[cat];
            if (!catObj || !catObj.shops) return;
            const s = catObj.shops[shop];
            if(!s) return;
            const pD = getPrice(shop, 'dosa');
            const pA = getPrice(shop, 'appam');
            totalValToday += (Number(s.dosa?.sale)||0) * pD + 
                             (Number(s.appam?.sale)||0) * pA;
            totalCashToday += Number(s.cashReceived) || 0;
            if(s.dosa?.sale || s.dosa?.cr || s.appam?.sale || s.appam?.cr || s.cashReceived) hasActivity = true;
            if(s.driver) shopDriver = s.driver;
        });
        
        const card = document.getElementById(`card-shop-${idx}`);
        const statusDiv = document.getElementById(`status-shop-${idx}`);
        
        if(card && statusDiv) {
            if(hasActivity) {
                card.classList.add('completed');
                statusDiv.innerHTML = `<span>₹${totalCashToday}</span><div class="status-dot"></div>`;
            } else {
                card.classList.remove('completed');
                statusDiv.innerHTML = `Pending<div class="status-dot"></div>`;
            }
        }
    }

    function toggleShop(index) { document.getElementById(`card-shop-${index}`).classList.toggle('expanded'); }
    function toggleCreditDetail(idx) {
        const el = document.getElementById(`credit-detail-${idx}`);
        if(el) {
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? 'block' : 'none';
            const icon = document.getElementById(`credit-icon-${idx}`);
            if(icon) icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
    function switchTab(index, type) {
        const pD = document.getElementById(`panel-dosa-${index}`), pA = document.getElementById(`panel-appam-${index}`);
        const tD = document.getElementById(`tab-dosa-${index}`), tA = document.getElementById(`tab-appam-${index}`);
        if(type === 'dosa') { pD.classList.add('active'); pA.classList.remove('active'); tD.classList.add('active-dosa'); tA.classList.remove('active-appam'); } 
        else { pD.classList.remove('active'); pA.classList.add('active'); tD.classList.remove('active-dosa'); tA.classList.add('active-appam'); }
    }


    /* --- RENDER --- */
    function fullRender() {
        renderStats();
        renderLogs();
        renderDeliveryMemberLogs();
        renderCreditAlerts();
        renderShops();
        renderTally();
    }

    // PRODUCTION-GRADE REFRESH (Fast, doesn't lose focus)
    // PRODUCTION-GRADE REFRESH (Fast, doesn't lose focus)
    // PRODUCTION-GRADE REFRESH (Fast, doesn't lose focus)
    function refreshDynamicUI() {
        renderStats();
        renderDeliveryMemberLogs();
        renderCreditAlerts();
        renderTally(); // Update the main Tally Sheet UI in real-time
        
        // Update the tiny Shop Sales cash summary too
        const tallyStats = calculateTallyStats();
        const el = document.getElementById('uiShopSalesCash');
        if(el) el.innerText = `₹${tallyStats.totalCashCollected}`;
        
        // Trigger animation on key totals to show "it's working"
        const targets = ['statD_Taken', 'statD_Sold', 'statD_Credit', 'statA_Taken', 'statA_Sold', 'statA_Credit', 'uiTotalCash', 'uiNetExpected'];
        targets.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.classList.remove('val-updated');
                void el.offsetWidth; // Trigger reflow
                el.classList.add('val-updated');
            }
        });
    }

    // (updateExpense and updateExtraIncome are defined later with correct multi-arg signatures)
    
    function renderCreditAlerts() {
        const container = document.getElementById('creditCollectionList');
        const card = document.getElementById('creditCollectionCard');
        if(!container || !card) return;
        
        container.innerHTML = "";
        let found = false;
        let grandTotalDues = 0;
        const dayData = globalDB[selectedDate] || {};
        
        // 1. Get ALL unique shops that have activity today or past dues
        const allShopsSet = new Set(Object.keys(pastDuesCache));
        const cats = ['PACKET', 'LOOSE'];
        cats.forEach(cat => {
            if(dayData[cat] && dayData[cat].activeShops) {
                dayData[cat].activeShops.forEach(s => allShopsSet.add(s));
            }
        });
        
        const sortedShops = Array.from(allShopsSet).sort();
        let shopIdx = 0;

        sortedShops.forEach(shop => {
            const pastDues = Number(pastDuesCache[shop]) || 0;
            let todaySaleVal = 0;
            let todayCash = 0;
            let todayCreditOnly = 0;
            let currentDriverName = null;

            cats.forEach(cat => {
                const cObj = dayData[cat];
                if(!cObj || !cObj.shops || !cObj.shops[shop]) return;
                const sd = cObj.shops[shop];
                const pD = getPrice(shop, 'dosa');
                const pA = getPrice(shop, 'appam');
                
                todaySaleVal += ((Number(sd.dosa?.sale)||0) + (Number(sd.dosa?.cr)||0)) * pD + 
                              ((Number(sd.appam?.sale)||0) + (Number(sd.appam?.cr)||0)) * pA;
                todayCash += Number(sd.cashReceived) || 0;
                todayCreditOnly += (Number(sd.dosa?.cr)||0) * pD + (Number(sd.appam?.cr)||0) * pA;
                if(sd.driver) currentDriverName = sd.driver;
            });

            const totalOutstanding = pastDues + todaySaleVal - todayCash;

            // Display logic: Show if they owe money OR if they got credit today
            if(totalOutstanding > 0.1 || todayCreditOnly > 0.1) {
                // Driver Filter: Only show if it belongs to the selected route
                const ownerDriver = currentDriverName || getLastDriver(shop, selectedDate);
                if(selectedDriver && ownerDriver && ownerDriver !== selectedDriver) return;

                found = true;
                grandTotalDues += Math.max(0, totalOutstanding);
                shopIdx++;

                const creditTag = todayCreditOnly > 0 ? `<div style="font-size:10px; color:#ef4444; margin-top:4px; font-weight:800; background:#fee2e2; padding:2px 6px; border-radius:4px; display:inline-block">NEW CREDIT: ₹${todayCreditOnly}</div>` : "";
                const breakdown = getDuesBreakdown(shop, selectedDate);
                const breakdownHTML = breakdown.map(b => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid #fef3c7; font-size:11px">
                        <div style="display:flex; flex-direction:column">
                            <span style="color:#64748b; font-weight:700">${new Date(b.date).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</span>
                            ${b.cash > 0 ? `<span style="font-size:9px; color:var(--success); font-weight:700">Paid ₹${b.cash}</span>` : ''}
                        </div>
                        <div style="text-align:center"><span style="color:var(--dosa-color); font-weight:800">${b.dosa}D</span><span style="color:var(--appam-color); font-weight:800; margin-left:4px">${b.appam}A</span></div>
                        <span style="color:#0f172a; font-weight:800">₹${b.value}</span>
                    </div>`).join("");

                container.innerHTML += `
                <div style="margin-bottom:8px; background:#fff; border-radius:12px; border:1px solid #fde68a; overflow:hidden; box-shadow:0 2px 4px rgba(180, 83, 9, 0.05)">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; cursor:pointer" onclick="toggleCreditDetail(${shopIdx})">
                        <div style="flex:1">
                            <div style="font-weight:700; color:#0f172a; font-size:13px; display:flex; align-items:center; gap:8px">
                                ${shop}
                                <span id="credit-icon-${shopIdx}" style="font-size:9px; transition:0.3s; color:#92400e">▼</span>
                            </div>
                            ${creditTag}
                        </div>
                        <span style="color:#b45309; font-weight:800; font-size:15px">₹${Math.max(0, totalOutstanding).toFixed(0)}</span>
                    </div>
                    <div id="credit-detail-${shopIdx}" style="display:none; background:#fffdf5; border-top:1px solid #fef3c7">
                        <div style="padding:4px 0">
                            <div style="padding:6px 12px; background:#fef3c7; font-size:9px; font-weight:800; color:#92400e; display:flex; justify-content:space-between"><span>DATE / PAYMENT</span><span>PACKETS</span><span>Billed Amt</span></div>
                            ${breakdownHTML || '<div style="padding:15px; text-align:center; color:#94a3b8; font-size:11px">No detailed records found</div>'}
                        </div>
                    </div>
                </div>`;
            }
        });
        
        if(found) {
            container.innerHTML += `<div style="margin-top:12px; padding-top:10px; border-top:2px dashed #fde68a; display:flex; justify-content:space-between; align-items:center">
                <span style="font-size:11px; font-weight:800; color:#92400e">GRAND TOTAL</span>
                <span style="font-size:18px; font-weight:900; color:#b45309">₹${grandTotalDues.toFixed(0)}</span>
            </div>`;
        }
        card.style.display = found ? 'block' : 'none';
        const headSpan = card.querySelector('.card-head span:first-child');
        if(headSpan) headSpan.innerText = selectedDriver ? `Pending Collections (${selectedDriver})` : "Pending Collections";
    }
    
    function renderStats() {
        const stats = calculateTallyStats();
        
        const updateEl = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.innerText = val;
        };

        // Aggregated DOSA CARD UPDATES
        updateEl('statD_Taken', stats.dosa.load);
        updateEl('statD_Sold', stats.dosa.sold);
        updateEl('statD_Credit', stats.dosa.credit);
        updateEl('statD_Free', stats.dosa.free);
        updateEl('statD_Dmg', stats.dosa.dmg);
        updateEl('statD_Bal', stats.dosa.balance);

        // Aggregated APPAM CARD UPDATES
        updateEl('statA_Taken', stats.appam.load);
        updateEl('statA_Sold', stats.appam.sold);
        updateEl('statA_Credit', stats.appam.credit);
        updateEl('statA_Free', stats.appam.free);
        updateEl('statA_Dmg', stats.appam.dmg);
        updateEl('statA_Bal', stats.appam.balance);

        // TOTAL CASH COLLECTOR (Aggregated actual cash received)
        updateEl('uiTotalCash', `₹${stats.totalCashCollected}`);
    }

    function renderLogs() {
         const activeHubSelect = document.getElementById('activeHub');
         if (!activeHubSelect) return;
         const filterHub = activeHubSelect.value;
         const filterDriver = selectedDriver;
         const fTrips = currentData.trips.filter(t => {
             const hubMatch = filterHub === "ALL" || t.hub === filterHub;
             const driverMatch = !filterDriver || t.driver === filterDriver;
             return hubMatch && driverMatch;
         });

         const tLog = document.getElementById('tripLogBody'); 
         if (!tLog) return;
         tLog.innerHTML = "";
         if (fTrips.length > 0) { 
             document.getElementById('tripLogContainer').style.display = "block"; 
             fTrips.forEach(t => tLog.innerHTML += `<tr><td><span class="badge" style="background:#f1f5f9;color:#64748b">${t.hub.slice(0,3)}</span></td><td>${t.driver}</td><td style="text-align:right">${t.dosa}</td><td style="text-align:right">${t.appam}</td><td style="text-align:right"><button class="btn-del" style="background:#e0f2fe; color:#0369a1; margin-right:4px" onclick="editTrip('${t.id}')">✎</button><button class="btn-del" onclick="deleteTrip('${t.id}')">×</button></td></tr>`); 
         } else { 
             document.getElementById('tripLogContainer').style.display = "none"; 
         }
     }

     function renderDeliveryMemberLogs() {
         const container = document.getElementById('deliveryMemberLogs');
         if(!container) return;

         // 1. Preserve Expanded State
         const openStates = {};
         const gds = document.getElementById('globalDriverSelect');
         const DRIVERS = gds ? Array.from(gds.options).map(o => o.value).filter(v => v !== "") : ["Udhayamperoor", "Kakkanad", "Kadavanthra", "Nettor"];
         DRIVERS.forEach(d => {
            const safeName = d.replace(/\s+/g, '');
            const body = document.getElementById(`member-log-${safeName}`);
            if (body && body.parentElement.classList.contains('expanded')) {
                openStates[d] = true;
            }
         });

         container.innerHTML = "";
         
         // Use currentData directly to ensure we show what is being edited
         const catData = currentData; 
         if(!catData || !catData.shops) return;

         // FILTER: If a global driver is selected, only show them. Otherwise show all.
         const driversToShow = selectedDriver ? [selectedDriver] : DRIVERS;

         driversToShow.forEach((driver) => {
             // 1. Find hubs this driver delivered to TODAY
             const driverTrips = (catData.trips || []).filter(t => t.driver === driver);
             const activeHubs = Array.from(new Set(driverTrips.map(t => t.hub)));
             
             let dSold = 0, aSold = 0;
             let tripCount = driverTrips.length;

             // 2. Aggregate stats for shops specifically served by THIS driver (Across all categories)
             let shopDetailsHTML = "";
             const shopActivity = {}; // { shopName: { dosa:0, appam:0, cash:0 } }

             const dayData = globalDB[selectedDate] || {};

             Object.keys(dayData).forEach(cat => {
                const catObj = dayData[cat];
                if (!catObj || !catObj.shops) return;
                const catShops = catObj.shops;
                Object.keys(catShops).forEach(shop => {
                    const sd = catShops[shop];
                    if(!sd || sd.driver !== driver) return;
                    
                    const hasShopActivity = (sd.dosa?.sale || sd.dosa?.cr || sd.appam?.sale || sd.appam?.cr || sd.cashReceived);
                    if(!hasShopActivity) return;

                    if(!shopActivity[shop]) shopActivity[shop] = { dosa:0, appam:0, cash:0 };
                    shopActivity[shop].dosa += (Number(sd.dosa?.sale)||0) + (Number(sd.dosa?.cr)||0);
                    shopActivity[shop].appam += (Number(sd.appam?.sale)||0) + (Number(sd.appam?.cr)||0);
                    shopActivity[shop].cash += (Number(sd.cashReceived)||0);
                });
             });

             Object.keys(shopActivity).forEach(shop => {
                const act = shopActivity[shop];
                shopDetailsHTML += `
                <div style="background:white; padding:12px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px; box-shadow:0 1px 2px rgba(0,0,0,0.02)">
                    <div style="font-weight:800; color:var(--primary); font-size:13px; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:baseline">
                        <span>${shop}</span>
                        <div style="text-align:right">
                            <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; margin-right:4px">Cash:</span>
                            <span style="color:#10b981">₹${act.cash}</span>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px">
                        <div><span style="color:#64748b">Total Sale:</span> <b style="color:#0f172a">${act.dosa}D, ${act.appam}A</b></div>
                    </div>
                </div>`;
             });

             Object.keys(dayData).forEach(cat => {
                const trips = (dayData[cat].trips || []).filter(t => t.driver === driver);
                trips.forEach(t => {
                    dSold += Number(t.dosa)||0; aSold += Number(t.appam)||0;
                });
             });
             tripCount = (Object.keys(dayData).reduce((total, cat) => total + (dayData[cat].trips || []).filter(t => t.driver === driver).length, 0));

             const hasData = tripCount > 0;
             const safeDriverName = driver.replace(/\s+/g, '');
             const isOpen = openStates[driver]; // Restore State
             
             container.innerHTML += `
             <div class="card ${isOpen ? 'expanded' : ''}" style="margin-bottom:12px">
                 <div class="shop-header" onclick="toggleMemberLog('${safeDriverName}')" style="background:#f8fafc">
                     <div class="shop-name" style="color:${hasData ? 'var(--primary)' : 'var(--text-muted)'}">
                         ${driver}
                     </div>
                     <div class="shop-status">
                         <span style="font-size:11px">${tripCount} load(s)</span>
                         <div class="status-dot" style="background:${hasData ? 'var(--success)' : '#cbd5e1'}"></div>
                     </div>
                 </div>
                 <div class="shop-body" id="member-log-${safeDriverName}">
                     ${hasData ? `
                         <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px">
                             <div style="background:white; padding:10px; border-radius:12px; border:1px solid #e2e8f0; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.02)">
                                 <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px">Dosa Loaded</div>
                                 <div style="font-size:20px; font-weight:800; color:var(--dosa-color)">${dSold}</div>
                             </div>
                             <div style="background:white; padding:10px; border-radius:12px; border:1px solid #e2e8f0; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.02)">
                                 <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px">Appam Loaded</div>
                                 <div style="font-size:20px; font-weight:800; color:var(--appam-color)">${aSold}</div>
                             </div>
                         </div>
                         
                         <div style="margin-bottom:12px">
                             <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:8px; text-transform:uppercase">Delivery History</div>
                             ${shopDetailsHTML || `<div style="text-align:center; padding:12px; color:#94a3b8; font-size:12px; background:white; border-radius:8px; border:1px dashed #cbd5e1">No shop activity recorded yet</div>`}
                         </div>

                         <div style="font-size:11px; color:#64748b">Hubs Assigned: <b>${activeHubs.join(", ") || 'General'}</b></div>
                     ` : `
                         <div style="padding:40px; text-align:center; color:#cbd5e1; font-size:12px; border:1px dashed #e2e8f0; border-radius:12px">
                            No loads recorded for this route today
                        </div>
                     `}
                 </div>
             </div>`;
         });
     }
     
     function toggleMemberLog(index) {
         const el = document.getElementById(`member-log-${index}`);
         if(el && el.parentElement) el.parentElement.classList.toggle('expanded');
     }
    function renderShops() {
        const container = document.getElementById('shopsContainer'); 
        if(!container) return;
        
        // --- 1. PRE-RENDER STATE SNAPSHOT ---
        const expandedIds = Array.from(container.querySelectorAll('.card.expanded')).map(el => el.id);
        const activeTabInfo = {}; // { shopIdx: 'dosa'|'appam' }
        container.querySelectorAll('.card').forEach(card => {
            const idxMatch = card.id.match(/\d+$/);
            if (idxMatch) {
                const idx = idxMatch[0];
                const activeTab = card.querySelector('.tab-btn.active-dosa, .tab-btn.active-appam');
                if (activeTab) {
                    activeTabInfo[idx] = activeTab.innerText.toLowerCase().trim();
                }
            }
        });

        const activeElement = document.activeElement;
        let focusedFieldId = null;
        let cursorStart = 0, cursorEnd = 0;
        
        if (activeElement && container.contains(activeElement)) {
            focusedFieldId = activeElement.dataset.focusId || activeElement.id;
            if (activeElement.tagName === 'INPUT') {
                cursorStart = activeElement.selectionStart;
                cursorEnd = activeElement.selectionEnd;
            }
        }
        
        const filterDriver = selectedDriver;
        const searchInput = document.getElementById('shopSearch');
        const searchVal = (searchInput?.value || "").toLowerCase().trim();
        
        if(!filterDriver) {
            container.innerHTML = `<div class="card" style="border:1px dashed #4f46e5; background:#eef2ff; padding:32px 20px; text-align:center; box-shadow:none; margin-bottom:24px"> Select Route First... </div>`;
            return;
        }
        
        let shownCount = 0;
        const listToIterate = searchVal ? SHOP_LIST : (currentData.activeShops || []);
        let htmlBuffer = "";
        
        listToIterate.forEach((shop, i) => {
            const idx = SHOP_LIST.indexOf(shop);
            if(idx === -1 || !currentData.shops[shop]) return;
            
            const matchesSearch = !searchVal || shop.toLowerCase().includes(searchVal);
            if(!matchesSearch) return;

            const data = currentData.shops[shop];
            const hasActivity = (data.dosa.sale || data.dosa.cr || data.appam.sale || data.appam.cr || data.cashReceived);
            if(filterDriver && hasActivity && data.driver && data.driver !== filterDriver) return;
            if (!searchVal && !hasActivity) return;

            const pD = getPrice(shop, 'dosa');
            const pA = getPrice(shop, 'appam');
            let totalValToday = 0;
            const dayData = globalDB[selectedDate] || {};
            Object.keys(dayData).forEach(cat => {
                const catObj = dayData[cat];
                if (!catObj || !catObj.shops) return;
                const s = catObj.shops[shop];
                if(s) {
                    totalValToday += (Number(s.dosa?.sale)||0) * pD + 
                                     (Number(s.appam?.sale)||0) * pA;
                }
            });
            
            if(shownCount >= 50) return;
            shownCount++;
            
            // Determine initial tab state
            const prefTab = activeTabInfo[idx] || 'dosa';

            htmlBuffer += `
            <div class="card ${hasActivity ? 'completed' : ''}" id="card-shop-${idx}">
                <div class="shop-header" onclick="toggleShop(${idx})">
                    <div class="shop-name">${shownCount}. ${shop}</div>
                    <div class="shop-status" id="status-shop-${idx}">${hasActivity ? `<span>₹${Number(data.cashReceived) || 0}</span>` : 'Pending'}<div class="status-dot"></div></div>
                </div>
                <div class="shop-body">
                    <div class="prod-tabs">
                        <div class="tab-btn ${prefTab==='dosa'?'active-dosa':''}" id="tab-dosa-${idx}" onclick="switchTab(${idx},'dosa')">Dosa</div>
                        <div class="tab-btn ${prefTab==='appam'?'active-appam':''}" id="tab-appam-${idx}" onclick="switchTab(${idx},'appam')">Appam</div>
                    </div>
                    <div id="panel-dosa-${idx}" class="input-panel ${prefTab==='dosa'?'active':''}">
                        <div class="input-grid">
                            <div><label>Sale</label><input type="number" class="qty-input sale" data-focus-id="sale-dosa-${idx}" oninput="updateShopData('${shop}','dosa','sale',this.value)" value="${data.dosa.sale}"></div>
                            <div><label>Credit</label><input type="number" class="qty-input cred" data-focus-id="cr-dosa-${idx}" oninput="updateShopData('${shop}','dosa','cr',this.value)" value="${data.dosa.cr}"></div>
                            <div><label>Dmg</label><input type="number" class="qty-input" data-focus-id="dmg-dosa-${idx}" oninput="updateShopData('${shop}','dosa','dmg',this.value)" value="${data.dosa.dmg}"></div>
                            <div><label>Free</label><input type="number" class="qty-input" data-focus-id="free-dosa-${idx}" oninput="updateShopData('${shop}','dosa','free',this.value)" value="${data.dosa.free}"></div>
                        </div>
                    </div>
                    <div id="panel-appam-${idx}" class="input-panel ${prefTab==='appam'?'active':''}">
                        <div class="input-grid">
                            <div><label>Sale</label><input type="number" class="qty-input sale" data-focus-id="sale-appam-${idx}" oninput="updateShopData('${shop}','appam','sale',this.value)" value="${data.appam.sale}"></div>
                            <div><label>Credit</label><input type="number" class="qty-input cred" data-focus-id="cr-appam-${idx}" oninput="updateShopData('${shop}','appam','cr',this.value)" value="${data.appam.cr}"></div>
                            <div><label>Dmg</label><input type="number" class="qty-input" data-focus-id="dmg-appam-${idx}" oninput="updateShopData('${shop}','appam','dmg',this.value)" value="${data.appam.dmg}"></div>
                            <div><label>Free</label><input type="number" class="qty-input" data-focus-id="free-appam-${idx}" oninput="updateShopData('${shop}','appam','free',this.value)" value="${data.appam.free}"></div>
                        </div>
                    </div>
                    
                    <div style="margin-top:16px; padding:12px; background:white; border-radius:8px; border:1px solid #e2e8f0">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px">
                            <div style="background:#fffbeb; padding:8px; border-radius:6px; border:1px solid #fde68a">
                                <label style="font-size:9px; font-weight:700; color:#92400e; display:block; margin-bottom:2px">PREVIOUS DUES</label>
                                <div style="font-size:15px; font-weight:700; color:#b45309" id="prev-${idx}">₹0</div>
                            </div>
                            <div style="background:#f0fdf4; padding:8px; border-radius:6px; border:1px solid #bbf7d0">
                                <label style="font-size:9px; font-weight:700; color:#166534; display:block; margin-bottom:2px">TODAY'S SALE</label>
                                <div style="font-size:15px; font-weight:700; color:#0f172a" id="total-${idx}">₹${totalValToday}</div>
                            </div>
                        </div>
                        <div style="margin-bottom:12px">
                            <label style="font-size:10px; font-weight:700; color:#64748b; display:block; margin-bottom:4px">TOTAL CASH RECEIVED</label>
                            <input type="number" class="qty-input" style="width:100%; font-size:16px; font-weight:700; background:#f0fdf4; border-color:#86efac" 
                                data-focus-id="cash-${idx}"
                                oninput="updateCashReceived('${shop}', this.value, ${idx})" 
                                value="${data.cashReceived || ''}" placeholder="Enter cash amount...">
                        </div>
                        <div style="margin-bottom:12px">
                            <label style="font-size:10px; font-weight:700; color:#64748b; display:block; margin-bottom:4px">TOTAL GPAY RECEIVED</label>
                            <input type="number" class="qty-input" style="width:100%; font-size:16px; font-weight:700; background:#eff6ff; border-color:#93c5fd" 
                                data-focus-id="gpay-${idx}"
                                oninput="updateGpayReceived('${shop}', this.value, ${idx})" 
                                value="${data.gpayReceived || ''}" placeholder="Enter Gpay amount...">
                        </div>
                        <div style="padding:10px; background:#f1f5f9; border-radius:6px; text-align:center; border:1px solid #e2e8f0">
                            <div style="font-size:9px; font-weight:700; color:#64748b; margin-bottom:2px">CLOSING BALANCE</div>
                            <div style="font-size:18px; font-weight:800" id="balance-${idx}">₹0</div>
                        </div>
                    </div>
                    <button class="save-btn" onclick="toggleShop(${idx})">Done</button>
                </div>
            </div>`;
        });
        
        if(!htmlBuffer) htmlBuffer = `<div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1">No shops found</div>`;
        container.innerHTML = htmlBuffer;
        
        // --- 2. RESTORE UI STATE ---
        expandedIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('expanded');
        });
        
        if (focusedFieldId) {
            const target = container.querySelector(`[data-focus-id="${focusedFieldId}"]`);
            if (target) {
                target.focus();
                if (target.tagName === 'INPUT') target.setSelectionRange(cursorStart, cursorEnd);
            }
        }

        SHOP_LIST.forEach((shop, idx) => {
            if(currentData.shops[shop]) updateShopBalance(shop, idx);
        });
    }

    /* --- TALLY & RECONCILIATION LOGIC --- */
    function addExpense() {
        if(!currentData.tally) currentData.tally = { cashInHandMap: {}, expenses: [] };
        currentData.tally.expenses.push({ id: generateId(), detail: '', amount: '', driver: selectedDriver });
        saveData();
        renderTally();
    }

    function updateExpense(idx, field, val) {
        const filterDriver = selectedDriver;
        let localIdx = 0;
        for(let i=0; i<currentData.tally.expenses.length; i++) {
            if(!filterDriver || currentData.tally.expenses[i].driver === filterDriver) {
                if(localIdx === idx) {
                    currentData.tally.expenses[i][field] = val;
                    break;
                }
                localIdx++;
            }
        }
        saveData();
        // OPTIMIZATION: Only update totals to keep input focus intact
        updateTallyReconciliationUI();
    }

    function deleteExpense(idx) {
        if(!confirm("Delete expense?")) return;
        const filterDriver = selectedDriver;
        let localIdx = 0;
        for(let i=0; i<currentData.tally.expenses.length; i++) {
            if(!filterDriver || currentData.tally.expenses[i].driver === filterDriver) {
                if(localIdx === idx) {
                    currentData.tally.expenses.splice(i, 1);
                    break;
                }
                localIdx++;
            }
        }
        saveData();
        renderTally();
    }

    /* --- EXTRA INCOME LOGIC --- */
    function addExtraIncome() {
        if(!currentData.tally) currentData.tally = { cashInHandMap: {}, expenses: [], extraIncome: [] };
        if(!currentData.tally.extraIncome) currentData.tally.extraIncome = [];
        currentData.tally.extraIncome.push({ id: generateId(), item: '', amount: '', driver: selectedDriver });
        saveData();
        renderTally();
    }

    function updateExtraIncome(idx, field, val) {
        const filterDriver = selectedDriver;
        let localIdx = 0;
        for(let i=0; i<currentData.tally.extraIncome.length; i++) {
            if(!filterDriver || currentData.tally.extraIncome[i].driver === filterDriver) {
                if(localIdx === idx) {
                    currentData.tally.extraIncome[i][field] = val;
                    break;
                }
                localIdx++;
            }
        }
        saveData();
        // OPTIMIZATION: Only update totals to keep input focus intact
        updateTallyReconciliationUI();
    }

    function deleteExtraIncome(idx) {
        if(!confirm("Delete extra income?")) return;
        const filterDriver = selectedDriver;
        let localIdx = 0;
        for(let i=0; i<currentData.tally.extraIncome.length; i++) {
            if(!filterDriver || currentData.tally.extraIncome[i].driver === filterDriver) {
                if(localIdx === idx) {
                    currentData.tally.extraIncome.splice(i, 1);
                    break;
                }
                localIdx++;
            }
        }
        saveData();
        renderTally();
    }
    function updateCashInHand(val) {
        if(!currentData.tally) currentData.tally = { cashInHandMap: {}, denomsMap: {}, expenses: [] };
        currentData.tally.cashInHandMap[selectedDriver || ''] = val;
        saveData();
        updateTallyReconciliationUI();
    }

    function updateDenom(denom, qty) {
        if(!currentData.tally.denomsMap) currentData.tally.denomsMap = {};
        const driver = selectedDriver || '';
        if(!currentData.tally.denomsMap[driver]) {
            currentData.tally.denomsMap[driver] = { 500:'', 200:'', 100:'', 50:'', 20:'', 10:'', 1:'' };
        }
        currentData.tally.denomsMap[driver][denom] = qty;
        
        // Recalculate Total
        const d = currentData.tally.denomsMap[driver];
        const total = (Number(d[500])||0)*500 + (Number(d[200])||0)*200 + (Number(d[100])||0)*100 + (Number(d[50])||0)*50 + (Number(d[20])||0)*20 + (Number(d[10])||0)*10 + (Number(d[1])||0)*1;
        
        updateCashInHand(total);
        
        // Update the subtotal in UI without full re-render for performance
        const subTotalEl = document.getElementById(`denom-sub-${denom}`);
        if(subTotalEl) subTotalEl.innerText = `₹${((Number(qty)||0) * denom).toLocaleString()}`;
    }

    function calculateTallyStats() {
        const filterDriver = selectedDriver;
        
        // 1. Initialize Stats Containers
        const stats = {
            dosa: { load: 0, sold: 0, credit: 0, free: 0, dmg: 0, balance: 0, finalTotal: 0 },
            appam: { load: 0, sold: 0, credit: 0, free: 0, dmg: 0, balance: 0, finalTotal: 0 },
            credits: [],
            totalCashCollected: 0,
            totalGpayCollected: 0,
            cashPacket: 0,
            cashLoose: 0,
            gpayPacket: 0,
            gpayLoose: 0,
            totalExpenses: 0,
            totalExtraIncome: 0,
            totalOutstanding: 0,
            cashInHand: 0,
            netExpected: 0
        };

        const dayData = globalDB[selectedDate] || {};
    const allShopsSet = new Set();
    
    // Determine which categories to process
    // PACKET tab acts as the COMBINED / DAILY SUMMARY tab
    const catsToProcess = (currentCategory === 'PACKET') ? Object.keys(dayData) : [currentCategory];

    // Get Cash in Hand from the CURRENT category only (to keep reconciliation separate per tab)
    const activeTally = currentData.tally || {};
    stats.cashInHand = Number(activeTally.cashInHandMap ? activeTally.cashInHandMap[filterDriver || ''] : 0) || 0;

    catsToProcess.forEach(cat => {
        const catData = dayData[cat];
        if(!catData) return;
            
            // 2. Aggregate LOADS (Trips)
            if (cat === currentCategory) {
                const trips = (catData.trips || []).filter(t => !filterDriver || t.driver === filterDriver);
                trips.forEach(t => {
                    stats.dosa.load += Number(t.dosa) || 0;
                    stats.appam.load += Number(t.appam) || 0;
                });
            }

            // 3. Expenses & Extra Income
        const tally = catData.tally || { expenses: [], extraIncome: [], cashInHandMap: {} };
        const filteredExpenses = (tally.expenses || []).filter(e => !filterDriver || e.driver === filterDriver);
        filteredExpenses.forEach(e => stats.totalExpenses += (Number(e.amount)||0));

        const filteredExtra = (tally.extraIncome || []).filter(ei => !filterDriver || ei.driver === filterDriver);
        filteredExtra.forEach(ei => stats.totalExtraIncome += (Number(ei.amount)||0));
        
        // 4. Aggregate SHOP SALES
            const shops = catData.shops || {};
            Object.keys(shops).forEach(shop => {
                const s = shops[shop];
                if(!s || (filterDriver && s.driver !== filterDriver)) return;

                const dSale = Number(s.dosa?.sale)||0;
                const dCr = Number(s.dosa?.cr)||0;
                const dDmg = Number(s.dosa?.dmg)||0;
                const dFree = Number(s.dosa?.free)||0;
                
                const aSale = Number(s.appam?.sale)||0;
                const aCr = Number(s.appam?.cr)||0;
                const aDmg = Number(s.appam?.dmg)||0;
                const aFree = Number(s.appam?.free)||0;

                const pD = getPrice(shop, 'dosa');
                const pA = getPrice(shop, 'appam');

                // Product Stats
                if (cat === currentCategory) {
                    stats.dosa.sold += dSale;
                    stats.dosa.credit += dCr; 
                    stats.dosa.dmg += dDmg;
                    stats.dosa.free += dFree;

                    stats.appam.sold += aSale;
                    stats.appam.credit += aCr;
                    stats.appam.dmg += aDmg;
                    stats.appam.free += aFree;
                }

                // Cash & Gpay Collected
                const cash = (Number(s.cashReceived) || 0);
                const gpay = (Number(s.gpayReceived) || 0);
                stats.totalCashCollected += cash;
                stats.totalGpayCollected += gpay;
                
                if(cat === 'PACKET') {
                    stats.cashPacket += cash;
                    stats.gpayPacket += gpay;
                } else if(cat === 'LOOSE') {
                    stats.cashLoose += cash;
                    stats.gpayLoose += gpay;
                }
                
                allShopsSet.add(shop);
            });
        });

        // Sum Outstanding for all shops ever visited
        allShopsSet.forEach(shop => {
            const prevDues = getPendingBalance(shop, selectedDate);
            let todaySaleVal = 0;
            let shopCashRec = 0;
            let dCrTotal = 0;
            let aCrTotal = 0;
            let currentShopDriver = null;
            
            Object.keys(dayData).forEach(cat => {
                // If in category-specific mode (Loose), only look at Loose data for this shop
                if(currentCategory !== 'PACKET' && cat !== currentCategory) return;
                const catObj = dayData[cat];
                if (!catObj || !catObj.shops) return;
                const s = catObj.shops[shop];
                if (!s) return;
                const pD = getPrice(shop, 'dosa');
                const pA = getPrice(shop, 'appam');
                todaySaleVal += ((Number(s.dosa?.sale)||0) + (Number(s.dosa?.cr)||0)) * pD + 
                               ((Number(s.appam?.sale)||0) + (Number(s.appam?.cr)||0)) * pA;
                shopCashRec += (Number(s.cashReceived) || 0) + (Number(s.gpayReceived) || 0);
                if (cat === currentCategory) {
                    dCrTotal += (Number(s.dosa?.cr)||0);
                    aCrTotal += (Number(s.appam?.cr)||0);
                }
                if (s.driver) currentShopDriver = s.driver;
            });
            
            const ownerDriver = currentShopDriver || getLastDriver(shop, selectedDate);
            if (!filterDriver || ownerDriver === filterDriver) {
                stats.totalOutstanding += (prevDues + todaySaleVal - shopCashRec);
                
                const creditVal = (dCrTotal * getPrice(shop, 'dosa')) + (aCrTotal * getPrice(shop, 'appam'));
                if(creditVal > 0) stats.credits.push({ name: shop, value: creditVal });
            }
        });

        // 5. Calculate Final Tally Fields (sold + credit + free + damage = total distributed)
        const dOut = stats.dosa.sold + stats.dosa.credit + stats.dosa.free + stats.dosa.dmg;
        const aOut = stats.appam.sold + stats.appam.credit + stats.appam.free + stats.appam.dmg;

        stats.dosa.balance = stats.dosa.load - dOut;
        stats.appam.balance = stats.appam.load - aOut;

        stats.dosa.finalTotal = stats.dosa.sold + stats.dosa.credit;
        stats.appam.finalTotal = stats.appam.sold + stats.appam.credit;
        
        stats.dosa.diff = 0;
        stats.appam.diff = 0;

        // 7. Cash In Hand & Net
        stats.netExpected = stats.totalCashCollected + stats.totalExtraIncome - stats.totalExpenses;

        return stats;
    }

    /* REMOVED updateManualTallyField as it is now auto-calculated */
    
    function updateTallyReconciliationUI() {
        // Recalculate everything
        const stats = calculateTallyStats();
        const diff = stats.cashInHand - stats.netExpected;
        const isMatched = Math.abs(diff) < 0.1;

        // Update Text Elements
        const netEl = document.getElementById('uiNetExpected');
        if(netEl) netEl.innerText = `₹${stats.netExpected}`;
        
        // Update the total cash in hand display if it exists (live feedback)
        const totalDisplay = document.getElementById('denom-total-display');
        if(totalDisplay) totalDisplay.innerText = `₹${stats.cashInHand.toLocaleString()}`;

        const diffEl = document.getElementById('uiTallyDiff');
        if(diffEl) {
            diffEl.innerText = `₹${Math.abs(diff).toFixed(0)}`;
            diffEl.style.color = isMatched ? 'var(--success)' : (diff > 0 ? '#3b82f6' : 'var(--danger)');
        }

        const reconPanel = document.getElementById('reconStatusPanel');
        if(reconPanel) {
            reconPanel.style.background = isMatched ? '#dcfce7' : (stats.cashInHand > 0 ? (diff > 0 ? '#fee2e2' : '#fef3c7') : '#f1f5f9');
            reconPanel.innerHTML = `<div style="font-size:11px; font-weight:700; color:${isMatched ? '#166534' : '#991b1b'}">
                ${isMatched ? 'Perfect' : (stats.cashInHand === 0 ? 'PLEASE ENTER CASH IN HAND' : (diff > 0 ? '⚠ EXTRA CASH: ₹'+diff.toFixed(2) : '⚠ SHORTAGE: ₹'+Math.abs(diff).toFixed(2)))}
            </div>`;
        }
        
        const card = document.getElementById('tallyCardMain');
        if(card) {
            card.style.borderColor = isMatched ? 'var(--success)' : (stats.cashInHand > 0 ? 'var(--danger)' : 'var(--border)');
        }
    }

    function renderTally() {
        const stats = calculateTallyStats();
        const diff = stats.cashInHand - stats.netExpected;
        const isMatched = Math.abs(diff) < 0.1;
        const filterDriver = selectedDriver;
        const filteredExpenses = (currentData.tally.expenses || []).filter(e => !filterDriver || e.driver === filterDriver);

        let expHTML = filteredExpenses.map((e, i) => `
            <div style="display:flex; gap:8px; align-items:center; padding:4px 0; border-bottom:1px dashed #e2e8f0; font-size:12px; color:#64748b">
                <input id="exp-detail-${i}" type="text" placeholder="Expense Detail" value="${e.detail}" oninput="updateExpense(${i},'detail',this.value)" style="flex:2; border:none; background:transparent; font-size:12px; font-weight:600; outline:none; border-bottom:1px dashed #e2e8f0">
                <div style="display:flex; align-items:center; gap:8px; flex:1">
                    <span style="font-weight:700; color:var(--danger)">₹</span>
                    <input id="exp-amount-${i}" type="number" placeholder="0" value="${e.amount}" oninput="updateExpense(${i},'amount',this.value)" style="width:100%; border:none; background:transparent; font-size:12px; font-weight:700; color:var(--danger); outline:none; border-bottom:1px dashed #fee2e2">
                    <button onclick="deleteExpense(${i})" style="color:#cbd5e1; border:none; background:none; font-size:16px; cursor:pointer">×</button>
                </div>
            </div>
        `).join('');

            const renderProductSection = (name, data, color) => `
            <div style="margin-bottom:20px; background:#fff; border-radius:12px; padding:0; border:1px solid #e2e8f0; overflow:hidden">
                <div style="padding:12px; background:${color}10; border-bottom:1px solid ${color}30; display:flex; justify-content:space-between; align-items:center">
                    <div style="font-size:14px; font-weight:800; color:${color};">${name}</div>
                    <div style="font-size:11px; font-weight:700; color:${color}; opacity:0.8">QTY TALLY</div>
                </div>
                
                <table style="width:100%; font-size:12px; border-collapse:collapse">
                    <tr style="border-bottom:1px solid #f1f5f9">
                        <td style="padding:10px 12px; color:#64748b; font-weight:600">Total Loaded</td>
                        <td style="padding:10px 12px; text-align:right; font-weight:700; color:#0f172a">${data.load}</td>
                    </tr>
                    <tr style="border-bottom:2px solid #e2e8f0; background:#f8fafc">
                        <td style="padding:10px 12px; color:#334155; font-weight:800">Total Distributed</td>
                        <td style="padding:10px 12px; text-align:right; font-weight:800; color:#334155">${data.load - data.balance}</td>
                    </tr>
                    
                    <tr>
                        <td style="padding:8px 12px; color:#64748b; font-size:11px">Sold (Cash)</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:600; color:#10b981">${data.sold}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 12px; color:#64748b; font-size:11px">Credit</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:600; color:#f59e0b">${data.credit}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 12px; color:#64748b; font-size:11px">Free</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:600; color:#3b82f6">${data.free}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9">
                        <td style="padding:8px 12px; color:#64748b; font-size:11px">Damage</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:600; color:#ef4444">${data.dmg}</td>
                    </tr>
                    
                    <tr style="background:#f0fdf4">
                        <td style="padding:10px 12px; color:#166534; font-weight:800">Stock Remaining</td>
                        <td style="padding:10px 12px; text-align:right; font-weight:800; color:#166534">${data.balance}</td>
                    </tr>
                </table>
            </div>
            `;

        const creditTotal = stats.credits.reduce((a, b) => a + b.value, 0);
        const creditsHTML = stats.credits.map(c => `
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px">
                <span style="color:#64748b">${c.name}</span>
                <span style="font-weight:700; color:#0f172a">₹${c.value}</span>
            </div>
        `).join('');

        document.getElementById('tallyContainer').innerHTML = `
            <div class="card" id="tallyCardMain" style="padding:24px; border:1px solid #e2e8f0; background:#fff">
                <h3 style="font-size:16px; font-weight:900; color:#0f172a; margin-bottom:20px; text-transform:uppercase; letter-spacing:1px; text-align:center">Totals Written on Sheet</h3>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
                    ${renderProductSection('DOSA', stats.dosa, '#4f46e5')}
                    ${renderProductSection('APPAM', stats.appam, '#f59e0b')}
                </div>
                
                <h3 style="font-size:16px; font-weight:900; color:#0f172a; margin:24px 0 16px 0; text-transform:uppercase; letter-spacing:1px; text-align:center">Cash Reconciliation</h3>

                <div style="background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e2e8f0; margin-bottom:20px">
                    ${currentCategory === 'PACKET' ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px">
                        <span style="color:#64748b; font-size:11px; font-weight:600">Total Cash (PACKETS)</span>
                        <span style="font-weight:700; color:#0f172a">₹${stats.cashPacket}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px">
                        <span style="color:#64748b; font-size:11px; font-weight:600">Total Cash (LOOSE)</span>
                        <span style="font-weight:700; color:#0f172a">₹${stats.cashLoose}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding-top:8px; border-top:1px solid #e2e8f0">
                        <span style="color:#334155; font-weight:700">Total Cash Collected</span>
                        <span style="font-weight:800; color:#0f172a">₹${stats.totalCashCollected}</span>
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom:6px; padding-top:12px; border-top:2px dashed #cbd5e1">
                        <span style="color:#64748b; font-size:11px; font-weight:600">Total Gpay (PACKETS)</span>
                        <span style="font-weight:700; color:#4f46e5">₹${stats.gpayPacket}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px">
                        <span style="color:#64748b; font-size:11px; font-weight:600">Total Gpay (LOOSE)</span>
                        <span style="font-weight:700; color:#4f46e5">₹${stats.gpayLoose}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                        <span style="color:#4f46e5; font-weight:700">Total Gpay Collected</span>
                        <span style="font-weight:800; color:#4f46e5">₹${stats.totalGpayCollected}</span>
                    </div>
                    ` : `
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px">
                        <span style="color:#64748b; font-size:11px; font-weight:600">Total Cash (LOOSE)</span>
                        <span style="font-weight:700; color:#0f172a">₹${stats.cashLoose}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px">
                        <span style="color:#64748b; font-size:11px; font-weight:600">Total Gpay (LOOSE)</span>
                        <span style="font-weight:700; color:#4f46e5">₹${stats.gpayLoose}</span>
                    </div>
                    `}
                    ${stats.totalExtraIncome > 0 ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                        <span style="color:#64748b; font-weight:600">Extra Income</span>
                        <span style="font-weight:800; color:#10b981">+ ₹${stats.totalExtraIncome}</span>
                    </div>` : ''}
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed #cbd5e1">
                        <span style="color:#64748b; font-weight:600">Expenses</span>
                        <span style="font-weight:800; color:#ef4444">- ₹${stats.totalExpenses}</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
                        <span style="font-weight:800; color:#334155; text-transform:uppercase; font-size:12px">Net Expected Cash</span>
                        <span style="font-weight:900; color:#0f172a; font-size:20px" id="uiNetExpected">₹${stats.netExpected}</span>
                    </div>

                    <div style="background:white; border:2px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:20px">
                        <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px">Actual Cash Denominations</label>
                        
                        <div style="display:grid; grid-template-columns:1fr; gap:8px">
                            ${[500, 200, 100, 50, 20, 10, 1].map(val => {
                                const driver = selectedDriver || '';
                                const qty = (currentData.tally.denomsMap && currentData.tally.denomsMap[driver]) ? (currentData.tally.denomsMap[driver][val] || '') : '';
                                return `
                                <div style="display:flex; align-items:center; gap:12px; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #f1f5f9">
                                    <div style="width:40px; font-weight:800; color:#475569; font-size:13px">₹${val}</div>
                                    <div style="color:#cbd5e1; font-size:10px">×</div>
                                    <input type="number" placeholder="0" value="${qty}" 
                                        oninput="updateDenom(${val}, this.value)"
                                        style="flex:1; background:white; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px; font-weight:700; font-size:14px; color:#0f172a; outline:none; text-align:center">
                                    <div id="denom-sub-${val}" style="width:80px; text-align:right; font-weight:800; color:#0f172a; font-size:14px">₹${((Number(qty)||0) * val).toLocaleString()}</div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <div style="margin-top:16px; padding-top:12px; border-top:2px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center">
                            <span style="font-weight:800; color:#64748b; font-size:11px; text-transform:uppercase">Total Cash In Hand</span>
                            <span style="font-weight:900; color:var(--primary); font-size:22px" id="denom-total-display">₹${stats.cashInHand.toLocaleString()}</span>
                        </div>
                    </div>

                    <div id="reconStatusPanel" style="margin-top:12px; text-align:center; padding:10px; background:#f1f5f9; border-radius:8px;">
                        <span style="font-size:12px; color:#94a3b8">Enter denoms to reconcile</span>
                    </div>
                    
                    <div style="text-align:center; margin-top:8px">
                         <span style="font-size:11px; font-weight:700; color:#cbd5e1">DIFFERENCE: <span id="uiTallyDiff">₹${Math.abs(diff).toFixed(0)}</span></span>
                    </div>
                </div>

                <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:12px; padding:16px; display:${stats.credits.length>0?'block':'none'}">
                     <div style="font-size:11px; font-weight:800; color:#b45309; text-transform:uppercase; margin-bottom:10px; display:flex; justify-content:space-between">
                        <span>Balance Credit Given</span>
                        <span>₹${creditTotal}</span>
                     </div>
                     ${creditsHTML}
                </div>
            </div>
            
            <div style="margin-top:24px">
                <div class="card" style="border:none; background:transparent; box-shadow:none; margin-bottom:8px">
                    <div class="card-head" style="background:transparent; padding-left:0; color:var(--text-main)">
                        <span>Expense Breakdown</span>
                    </div>
                </div>
                <div style="background:white; border-radius:12px; padding:16px; border:1px solid #e2e8f0">
                    ${expHTML}
                    <button onclick="addExpense()" style="width:100%; padding:12px; border:1px dashed #cbd5e1; background:#f8fafc; color:#64748b; border-radius:8px; font-weight:700; font-size:12px; margin-top:12px; cursor:pointer">+ Add Expense Row</button>
                    
                    <div style="margin-top:24px; border-top:1px solid #f1f5f9; padding-top:16px">
                        <div style="font-size:11px; font-weight:800; color:#cbd5e1; margin-bottom:12px; text-transform:uppercase">One-off Extra Income</div>
                        ${(currentData.tally.extraIncome || []).map((ei, i) => `
                        <div style="display:flex; gap:8px; align-items:center; padding:4px 0; border-bottom:1px dashed #e2e8f0; font-size:12px; color:#64748b">
                             <input type="text" placeholder="Extra Item" value="${ei.item}" oninput="updateExtraIncome(${i},'item',this.value)" style="flex:2; border:none; background:transparent; font-size:12px; font-weight:600; outline:none; border-bottom:1px dashed #e2e8f0">
                             <div style="display:flex; align-items:center; gap:8px; flex:1">
                                 <span style="font-weight:700; color:var(--success)">+ ₹</span>
                                 <input type="number" placeholder="0" value="${ei.amount}" oninput="updateExtraIncome(${i},'amount',this.value)" style="width:100%; border:none; background:transparent; font-size:12px; font-weight:700; color:var(--success); outline:none; border-bottom:1px dashed #86efac">
                                 <button onclick="deleteExtraIncome(${i})" style="color:#cbd5e1; border:none; background:none; font-size:16px; cursor:pointer">×</button>
                             </div>
                        </div>`).join('')}
                        <button onclick="addExtraIncome()" style="width:100%; padding:12px; border:1px dashed #cbd5e1; background:#f0fdf4; color:#16a34a; border-radius:8px; font-weight:700; font-size:12px; margin-top:12px; cursor:pointer">+ Add Extra Income</button>
                    </div>
                    
                </div>
             </div>
        `;
    }

    // All functions are now automatically global in the non-module script.
    console.log("IyersRoute V3.1 Script Loaded.");
