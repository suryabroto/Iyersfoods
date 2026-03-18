function renderStats() {
    const filterHub = activeHub.value;
    
    let totalTaken = 0;
    let totalSale = 0, totalCredit = 0, totalFree = 0, totalDamage = 0;
    let totalCash = 0;

    // 1. Total Taken (from trips)
    const fTrips = currentData.trips.filter(t => filterHub === "ALL" || t.hub === filterHub);
    fTrips.forEach(t => { totalTaken += t.dosa + t.appam; });

    // 2. Damage (from returns)
    currentData.returns.forEach(r => { 
        if(r.type === 'DAMAGE') totalDamage += r.dosa + r.appam;
    });

    // 3. Shop Outflows
    SHOP_LIST.forEach(shop => {
        if(!currentData.shops[shop]) return;
        const s = currentData.shops[shop];
        
        totalSale += (Number(s.dosa.sale)||0) + (Number(s.appam.sale)||0);
        totalCredit += (Number(s.dosa.cr)||0) + (Number(s.appam.cr)||0);
        totalFree += (Number(s.dosa.free)||0) + (Number(s.appam.free)||0);
        totalDamage += (Number(s.dosa.dmg)||0) + (Number(s.appam.dmg)||0);

        const pD = getPrice(shop, 'dosa');
        const pA = getPrice(shop, 'appam');
        totalCash += ((Number(s.dosa.sale)||0) * pD) + ((Number(s.appam.sale)||0) * pA);
    });

    // 4. Calculate Balance
    const balance = totalTaken - totalSale - totalCredit - totalFree - totalDamage;

    // 5. Update UI
    document.getElementById('uiTotalTaken').innerText = totalTaken;
    document.getElementById('uiTotalSale').innerText = totalSale;
    document.getElementById('uiTotalCredit').innerText = totalCredit;
    document.getElementById('uiTotalFree').innerText = totalFree;
    document.getElementById('uiTotalDamage').innerText = totalDamage;
    
    const balEl = document.getElementById('uiBalance');
    balEl.innerText = balance;
    if(balance > 0) balEl.style.color = '#86efac';
    else if(balance < 0) balEl.style.color = '#fca5a5';
    else balEl.style.color = '#fff';
    
    document.getElementById('uiTotalCash').innerText = `₹${totalCash}`;
}
