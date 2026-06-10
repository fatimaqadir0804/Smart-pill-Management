const DEFAULT_STATE = {
    c1: { pills: 20, time1: "08:00", time1_active: true, time2: "14:00", time2_active: true, time3: "20:00", time3_active: true, name: "Alpha", lastDoseDate: "", completedDoses: [] },
    c2: { pills: 15, time1: "08:00", time1_active: true, time2: "14:00", time2_active: true, time3: "20:00", time3_active: true, name: "Beta", lastDoseDate: "", completedDoses: [] },
    c3: { pills: 30, time1: "08:00", time1_active: true, time2: "14:00", time2_active: true, time3: "20:00", time3_active: true, name: "Gamma", lastDoseDate: "", completedDoses: [] },
    c4: { pills: 10, time1: "08:00", time1_active: true, time2: "14:00", time2_active: true, time3: "20:00", time3_active: true, name: "Delta", lastDoseDate: "", completedDoses: [] },
    c5: { pills: 5,  time1: "08:00", time1_active: true, time2: "14:00", time2_active: true, time3: "20:00", time3_active: true, name: "Epsilon", lastDoseDate: "", completedDoses: [] },
    logs: [],
    audio: true,
    patients: [
        { id: "P-1002", name: "Jane Doe", password: "password123" },
        { id: "P-1045", name: "John Smith", password: "password456" }
    ]
};

let appState = {}; 
let activeDoseAlarmInterval = null;
let doseAlarmTimeout = null;

function enterSystem() {
    document.getElementById('welcome-screen').classList.add('hidden-screen');
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const tempCtx = new AudioContext();
            if (tempCtx.state === 'suspended') tempCtx.resume();
        }
    } catch(e) { console.log("Audio Context priming skipped."); }

    if (appState.audio && window.Notification && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

document.getElementById('toast-container').addEventListener('click', function(e) {
    if (e.target === this) {
        const activeToast = this.querySelector('.toast-animation-in');
        if (activeToast) closeToast(activeToast.querySelector('button'));
    }
});

function toggleSettings(show) {
    if(show) {
        document.getElementById('settings-modal-title').innerHTML = `<i data-lucide="sliders" class="text-indigo-400"></i> Control Panel Configuration`;
        document.getElementById('wrapper-folder-schedules').style.display = 'block';
        document.getElementById('wrapper-folder-renames').style.display = 'block';
        document.getElementById('wrapper-global-preferences').style.display = 'block';

        document.getElementById('patients-folder-content').classList.remove('open');
        document.getElementById('patients-folder-arrow').style.transform = 'rotate(0deg)';
        document.getElementById('schedule-folder-content').classList.remove('open');
        document.getElementById('folder-arrow').style.transform = 'rotate(0deg)';
        document.getElementById('rename-folder-content').classList.remove('open');
        document.getElementById('rename-folder-arrow').style.transform = 'rotate(0deg)';
        generateSettingsUI();
        renderPatientsList();
    }
    document.getElementById('settings-screen').classList.toggle('active', show);
}

function togglePatientsOnly(show) {
    if(show) {
        toggleSettings(true);
        document.getElementById('settings-modal-title').innerHTML = `<i data-lucide="user-round" class="text-indigo-400"></i> Patient Management Records`;
        document.getElementById('wrapper-folder-schedules').style.display = 'none';
        document.getElementById('wrapper-folder-renames').style.display = 'none';
        document.getElementById('wrapper-global-preferences').style.display = 'none';
        
        setTimeout(() => {
            toggleFolder('patients-folder-content', 'patients-folder-arrow');
        }, 60);
    }
}

function toggleFolder(folderId, arrowId) {
    const folder = document.getElementById(folderId);
    const arrow = document.getElementById(arrowId);
    if (!folder || !arrow) return;
    const isOpen = folder.classList.toggle('open');
    arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function checkDayReset(vaultData) {
    const todayStr = new Date().toDateString();
    if (vaultData.lastDoseDate !== todayStr) {
        vaultData.lastDoseDate = todayStr;
        vaultData.completedDoses = [];
    }
}

async function init() {
    try {
        const response = await fetch('http://localhost:3000/api/state');
        appState = await response.json();
    } catch (error) {
        console.error("Failed to fetch state from SQLite backend. Using defaults.", error);
        appState = DEFAULT_STATE;
    }

    if (!appState.patients) {
        appState.patients = [...DEFAULT_STATE.patients];
    }

    for (let i = 1; i <= 5; i++) { 
        const id = `c${i}`;
        if (appState[id]) {
            checkDayReset(appState[id]);
            if (appState[id].time1_active === undefined) appState[id].time1_active = true;
            if (appState[id].time2_active === undefined) appState[id].time2_active = true;
            if (appState[id].time3_active === undefined) appState[id].time3_active = true;
        }
    }
    generateUI();
    generateSettingsUI(); 
    renderWelcomePatientLabel();
    lucide.createIcons();
    
    setInterval(() => {
        document.getElementById('system-clock').innerText = new Date().toLocaleTimeString();
    }, 1000);

    setInterval(() => {
        checkDosageSchedules();
    }, 60000);
}

function renderWelcomePatientLabel() {
    const container = document.getElementById('welcome-patient-display');
    if (!container) return;
    
    if (appState.patients && appState.patients.length > 0) {
        container.innerHTML = `
            <span class="text-[9px] font-black uppercase text-slate-500 tracking-widest">Active Admitted Care</span>
            <span class="text-xs font-bold text-indigo-400">${appState.patients.map(p => p.name).join(', ')}</span>`;
    } else {
        container.innerHTML = `
            <span class="text-[9px] font-black uppercase text-slate-500 tracking-widest">Active Admitted Care</span>
            <span class="text-xs font-bold text-slate-400">No Patients Registered</span>`;
    }
}

function generateSettingsUI() {
    const vaultRenameContainer = document.getElementById('vault-rename-inputs');
    const scheduleContainer = document.getElementById('schedule-manager-container');
    if (!vaultRenameContainer || !scheduleContainer) return;
    
    vaultRenameContainer.innerHTML = "";
    scheduleContainer.innerHTML = "";
    
    for(let i=1; i<=5; i++) {
        const id = `c${i}`;
        
        if (!appState[id]) {
            appState[id] = { ...DEFAULT_STATE[id] };
        }
        
        vaultRenameContainer.innerHTML += `
            <div class="flex items-center gap-3">
                <span class="text-xs font-mono text-slate-400 w-8">V${i}:</span>
                <input type="text" id="name_c${i}" value="${appState[id].name}" class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold text-white outline-none focus:border-indigo-500">
            </div>`;

        scheduleContainer.innerHTML += `
            <div class="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
                <span class="text-xs font-black uppercase text-indigo-400 tracking-wider">${appState[id].name} Schedule</span>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="bg-slate-950/60 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-black uppercase text-slate-400">Morning</span>
                            <input type="checkbox" id="active_${id}_t1" ${appState[id].time1_active ? 'checked' : ''} class="w-4 h-4 accent-indigo-500">
                        </div>
                        <input type="time" id="val_${id}_t1" value="${appState[id].time1}" class="bg-white/5 text-white border border-white/5 font-bold text-xs p-2 rounded-lg outline-none focus:border-indigo-500">
                    </div>
                    <div class="bg-slate-950/60 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-black uppercase text-slate-400">Midday</span>
                            <input type="checkbox" id="active_${id}_t2" ${appState[id].time2_active ? 'checked' : ''} class="w-4 h-4 accent-indigo-500">
                        </div>
                        <input type="time" id="val_${id}_t2" value="${appState[id].time2}" class="bg-white/5 text-white border border-white/5 font-bold text-xs p-2 rounded-lg outline-none focus:border-indigo-500">
                    </div>
                    <div class="bg-slate-950/60 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-black uppercase text-slate-400">Evening</span>
                            <input type="checkbox" id="active_${id}_t3" ${appState[id].time3_active ? 'checked' : ''} class="w-4 h-4 accent-indigo-500">
                        </div>
                        <input type="time" id="val_${id}_t3" value="${appState[id].time3}" class="bg-white/5 text-white border border-white/5 font-bold text-xs p-2 rounded-lg outline-none focus:border-indigo-500">
                    </div>
                </div>
            </div>`;
    }
    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) audioToggle.checked = appState.audio;
    lucide.createIcons();
}

function renderPatientsList() {
    const tableBody = document.getElementById('patients-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = appState.patients.map(p => `
        <tr class="hover:bg-white/5 transition">
            <td class="p-3 font-mono text-slate-400">${p.id}</td>
            <td class="p-3 text-white font-bold">${p.name}</td>
            <td class="p-3 text-right">
                <button onclick="removePatient('${p.id}')" class="text-rose-400 hover:text-rose-300 p-1 transition">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function addOrUpdatePatient() {
    const nameInput = document.getElementById('patient-name-input');
    const idInput = document.getElementById('patient-id-input');
    const passwordInput = document.getElementById('patient-password-input');
    
    if (!nameInput || !idInput || !nameInput.value.trim() || !idInput.value.trim()) return;

    const pid = idInput.value.trim();
    const pname = nameInput.value.trim();
    const ppass = passwordInput ? passwordInput.value : '';

    const existingIdx = appState.patients.findIndex(p => p.id === pid);
    if (existingIdx > -1) {
        appState.patients[existingIdx].name = pname;
        if(ppass) appState.patients[existingIdx].password = ppass;
    } else {
        appState.patients.push({ id: pid, name: pname, password: ppass });
    }

    nameInput.value = "";
    idInput.value = "";
    if (passwordInput) passwordInput.value = "";
    
    renderPatientsList();
    renderWelcomePatientLabel();
    savePatientsToDatabase().catch(err => console.error(err));
}

function removePatient(pid) {
    appState.patients = appState.patients.filter(p => p.id !== pid);
    renderPatientsList();
    renderWelcomePatientLabel();
    savePatientsToDatabase().catch(err => console.error(err));
}

async function savePatientsToDatabase() {
    await fetch('http://localhost:3000/api/state/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: appState.patients })
    }).catch(e => console.log("Database update deferred. Running on memory frame."));
}

function saveSettings() {
    if (document.getElementById('wrapper-folder-schedules').style.display !== 'none') {
        for(let i=1; i<=5; i++) {
            const id = `c${i}`;
            const currentTargetName = document.getElementById(`name_c${i}`);
            if (!currentTargetName) continue;

            appState[id].name = currentTargetName.value;
            appState[id].time1 = document.getElementById(`val_${id}_t1`).value;
            appState[id].time1_active = document.getElementById(`active_${id}_t1`).checked;
            appState[id].time2 = document.getElementById(`val_${id}_t2`).value;
            appState[id].time2_active = document.getElementById(`active_${id}_t2`).checked;
            appState[id].time3 = document.getElementById(`val_${id}_t3`).value;
            appState[id].time3_active = document.getElementById(`active_${id}_t3`).checked;
            
            saveVaultToDatabase(id).catch(err => console.error(err));
        }
        
        const globalAudioToggle = document.getElementById('audio-toggle');
        if (globalAudioToggle) appState.audio = globalAudioToggle.checked;
    }
    
    toggleSettings(false);
    generateUI();
    render();
    showTab('dashboard'); 
    showCustomToast("System Update", "Operational parameters applied successfully.", "info");
}

function getNextDoseInfo(vaultData) {
    checkDayReset(vaultData);
    const done = vaultData.completedDoses;

    if (vaultData.time1_active && !done.includes('time1')) {
        return { key: 'time1', label: 'Next Dose (Morning)', val: vaultData.time1 };
    } 
    if (vaultData.time2_active && !done.includes('time2')) {
        return { key: 'time2', label: 'Next Dose (Midday)', val: vaultData.time2 };
    } 
    if (vaultData.time3_active && !done.includes('time3')) {
        return { key: 'time3', label: 'Next Dose (Evening)', val: vaultData.time3 };
    }

    const anyActiveScheduled = vaultData.time1_active || vaultData.time2_active || vaultData.time3_active;
    if(!anyActiveScheduled) {
        return { key: 'none_active', label: 'No Active Doses Set', val: '--:--' };
    }
    return { key: 'all_done', label: 'All Active Doses Taken', val: '' };
}

function generateUI() {
    const grid = document.getElementById('container-grid');
    const inv = document.getElementById('inventory-controls');
    if (!grid || !inv) return;
    grid.innerHTML = ""; inv.innerHTML = "";
    
    for (let i = 1; i <= 5; i++) {
        const id = `c${i}`;
        const nextDose = getNextDoseInfo(appState[id]);
        let inputFieldHtml = '';
        let disableDispenseButton = false;

        if (nextDose.key === 'all_done') {
            inputFieldHtml = `<div class="w-full px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-2xl font-bold text-center border border-emerald-500/20 text-xs tracking-wide">✓ Cycle Complete</div>`;
        } else if (nextDose.key === 'none_active') {
            inputFieldHtml = `<div class="w-full px-4 py-3 bg-slate-500/10 text-slate-400 rounded-2xl font-bold text-center border border-slate-500/20 text-xs tracking-wide">Missing Active Dose</div>`;
            disableDispenseButton = true;
        } else {
            inputFieldHtml = `<input type="time" id="${id}_active_input" data-key="${nextDose.key}" value="${nextDose.val}" onchange="syncSingleData('${id}')" class="w-full px-4 py-2.5 bg-white/5 rounded-2xl font-bold text-white border border-white/10 outline-none focus:border-indigo-500/50">`;
        }

        grid.innerHTML += `
            <div class="glass-card p-8 rounded-[2.5rem]">
                <div class="flex justify-between items-start mb-6">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${appState[id].name}</span>
                    <div id="${id}-status-badge" class="px-2 py-0.5 text-[9px] font-black rounded-full border">READY</div>
                </div>
                <div class="flex items-baseline gap-2 mb-6">
                    <span id="${id}_pills" class="text-6xl font-black text-white tracking-tighter">--</span>
                    <span class="text-slate-500 text-xs font-bold uppercase tracking-widest">Qty</span>
                </div>
                <div class="flex flex-col gap-2 mb-6">
                    <div>
                        <label class="text-[9px] font-black uppercase text-indigo-400 tracking-wider pl-1">${nextDose.label}</label>
                        ${inputFieldHtml}
                    </div>
                </div>
                <button onclick="triggerDispense('${id}')" ${disableDispenseButton ? 'disabled' : ''} class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/10">Dispense</button>
            </div>`;
        inv.innerHTML += `<button onclick="fullRefill('${id}')" class="p-6 bg-white/5 border border-white/5 rounded-2xl text-left hover:bg-indigo-500/10 transition"><p class="text-[10px] font-black text-slate-500 uppercase">${appState[id].name}</p><p class="text-sm font-bold text-white">Refill to 30</p></button>`;
    }
    lucide.createIcons();
    renderPillCountsOnly();
}

function syncSingleData(vaultId) {
    const inputEl = document.getElementById(`${vaultId}_active_input`);
    if(!inputEl) return;
    const targetKey = inputEl.getAttribute('data-key');
    appState[vaultId][targetKey] = inputEl.value;
    render(vaultId);
}

function renderPillCountsOnly() {
    for (let i = 1; i <= 5; i++) {
        const id = `c${i}`;
        const pillEl = document.getElementById(`${id}_pills`);
        if(!pillEl) continue;
        
        pillEl.innerText = appState[id].pills;
        const badge = document.getElementById(`${id}-status-badge`);
        
        if (appState[id].pills <= 5) {
            badge.className = "px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[9px] font-black rounded-full border border-rose-500/20";
            badge.innerText = "LOW STOCK";
            pillEl.classList.add('pill-low');
        } else {
            badge.className = "px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded-full border border-emerald-500/20";
            badge.innerText = "OPTIMAL";
            pillEl.classList.remove('pill-low');
        }
    }
}

async function saveVaultToDatabase(vaultId) {
    const vaultData = { id: vaultId, ...appState[vaultId] };
    await fetch('http://localhost:3000/api/vault/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vaultData)
    });
}

async function saveLogToDatabase(logEntry) {
    await fetch('http://localhost:3000/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
    });
}

function render(updatedVaultId = null, newLogEntry = null) {
    renderPillCountsOnly();
    renderLogs();
    if (updatedVaultId) saveVaultToDatabase(updatedVaultId).catch(err => console.error(err));
    if (newLogEntry) saveLogToDatabase(newLogEntry).catch(err => console.error(err));
}

function triggerDispense(id) {
    if (appState[id].pills > 0) {
        const nextDose = getNextDoseInfo(appState[id]);
        
        if (nextDose.key !== 'all_done' && nextDose.key !== 'none_active') {
            appState[id].pills--;
            appState[id].completedDoses.push(nextDose.key);
            
            stopDoseAlarm();
            
            const newLog = { 
                timestamp: new Date().toLocaleTimeString(), 
                action: `Authorized: ${appState[id].name} (${nextDose.label})`, 
                status: "SUCCESS" 
            };
            appState.logs.unshift(newLog);
            
            if (appState[id].pills <= 5) {
                triggerLowStockAlert(id, appState[id].name, appState[id].pills);
            }
            
            generateUI();
            render(id, newLog);
        }
    } else { 
        showCustomToast("Vault Depleted", `Cannot dispense from ${appState[id].name}. Stock level is completely zero.`, "critical", id); 
    }
}

function triggerLowStockAlert(id, vaultName, count) {
    if (!appState.audio) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            const mainVolume = ctx.createGain();
            mainVolume.gain.setValueAtTime(1.0, now);
            
            const osc = ctx.createOscillator();
            osc.type = 'square'; 
            osc.frequency.setValueAtTime(1000, now);
            
            const beepDuration = 3.0; 
            let timeCursor = now + beepDuration;
            
            mainVolume.gain.setValueAtTime(1.0, now);
            mainVolume.gain.exponentialRampToValueAtTime(0.001, timeCursor);
            
            osc.connect(mainVolume);
            mainVolume.connect(ctx.destination);
            osc.start(now);
            osc.stop(timeCursor);
        }
    } catch (error) {
        console.warn("Web Audio context blocked or uninitialized.", error);
    }
    showCustomToast(`Low Stock Warning`, `Vault <b>${vaultName}</b> has dropped to a critical level of <b>${count}</b> items.`, count === 0 ? "critical" : "warning", id);
}

function checkDosageSchedules() {
    if (!appState.audio) return;

    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    const tenMinsAgo = new Date(now.getTime() - 10 * 60000);
    const oldHours = String(tenMinsAgo.getHours()).padStart(2, '0');
    const oldMinutes = String(tenMinsAgo.getMinutes()).padStart(2, '0');
    const tenMinsAgoTimeStr = `${oldHours}:${oldMinutes}`;

    let playAlarm = false;

    for (let i = 1; i <= 5; i++) {
        const id = `c${i}`;
        const vault = appState[id];
        if (!vault) continue;

        checkDayReset(vault);
        const done = vault.completedDoses;

        if (vault.time1_active && (vault.time1 === currentTimeStr || vault.time1 === tenMinsAgoTimeStr) && !done.includes('time1')) playAlarm = true;
        if (vault.time2_active && (vault.time2 === currentTimeStr || vault.time2 === tenMinsAgoTimeStr) && !done.includes('time2')) playAlarm = true;
        if (vault.time3_active && (vault.time3 === currentTimeStr || vault.time3 === tenMinsAgoTimeStr) && !done.includes('time3')) playAlarm = true;
    }

    if (playAlarm) {
        startDoseAlarm();
    }
}

function startDoseAlarm() {
    if (activeDoseAlarmInterval) return; 

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();

        activeDoseAlarmInterval = setInterval(() => {
            const now = ctx.currentTime;
            const mainVolume = ctx.createGain();
            mainVolume.gain.setValueAtTime(1.0, now);
            
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1000, now);
            
            const beepDuration = 0.15;
            const pauseDuration = 0.15;
            let timeCursor = now;
            
            for (let i = 0; i < 4; i++) {
                mainVolume.gain.setValueAtTime(1.0, timeCursor);
                timeCursor += beepDuration;
                mainVolume.gain.setValueAtTime(0.0, timeCursor);
                timeCursor += pauseDuration;
            }
            
            osc.connect(mainVolume);
            mainVolume.connect(ctx.destination);
            osc.start(now);
            osc.stop(timeCursor);
        }, 1200); 

        doseAlarmTimeout = setTimeout(() => {
            stopDoseAlarm();
            console.log("Dose reminder sound reached 15-second duration limit and auto-stopped.");
        }, 15000);

    } catch(e) {
        console.warn("AudioContext initialization for dose alarm failed", e);
    }
}

function stopDoseAlarm() {
    if (activeDoseAlarmInterval) {
        clearInterval(activeDoseAlarmInterval);
        activeDoseAlarmInterval = null;
    }
    if (doseAlarmTimeout) {
        clearTimeout(doseAlarmTimeout);
        doseAlarmTimeout = null;
    }
}

function showCustomToast(title, bodyText, type = "warning", vaultId = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    container.classList.remove('pointer-events-none');
    const toast = document.createElement('div');
    
    let config = {
        bg: "background: linear-gradient(135deg, rgba(244,63,94,0.2) 0%, rgba(15,23,42,0.95) 100%); border-color: rgba(244,63,94,0.4); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px 0 rgba(244,63,94,0.15);",
        icon: "alert-triangle", iconColor: "text-rose-400"
    };
    if (type === "info") {
        config = {
            bg: "background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(15,23,42,0.95) 100%); border-color: rgba(99,102,241,0.4); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px 0 rgba(99,102,241,0.15);",
            icon: "info", iconColor: "text-indigo-400"
        };
    }

    toast.className = "toast-animation-in pointer-events-auto w-full max-w-md glass-card p-6 rounded-[2rem] flex flex-col gap-4 border relative overflow-hidden";
    toast.style = config.bg;

    let actionButtonHtml = vaultId ? `
        <div class="flex justify-end border-t border-white/5 pt-3 mt-1">
            <button onclick="fullRefill('${vaultId}'); this.closest('.toast-animation-in').remove(); document.getElementById('toast-container').classList.add('pointer-events-none');" class="px-4 py-2 bg-white/5 hover:bg-indigo-600/30 text-white rounded-xl text-[11px] font-black uppercase tracking-wider border border-white/10 hover:border-indigo-500/40 transition-all flex items-center gap-1.5">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Emergency Refill
            </button>
        </div>` : '';

    toast.innerHTML = `
        <div class="flex items-start gap-4">
            <div class="p-3 rounded-2xl bg-white/5 border border-white/10 ${config.iconColor}">
                <i data-lucide="${config.icon}" class="w-6 h-6"></i>
            </div>
            <div class="flex-1 pt-0.5">
                <h3 class="text-sm font-black uppercase tracking-wider text-white">${title}</h3>
                <p class="text-xs font-medium text-slate-300 mt-1 leading-relaxed">${bodyText}</p>
            </div>
            <button onclick="closeToast(this)" class="text-slate-500 hover:text-white transition p-1">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
        ${actionButtonHtml}`;

    container.innerHTML = "";
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => { if(toast.parentNode) closeToast(toast.querySelector('button')); }, 6000);
}

function closeToast(btnElement) {
    const containerNode = btnElement.closest('.toast-animation-in');
    if(!containerNode) return;
    
    containerNode.classList.remove('toast-animation-in');
    containerNode.classList.add('toast-animation-out');
    containerNode.addEventListener('animationend', () => {
        containerNode.remove();
        document.getElementById('toast-container').classList.add('pointer-events-none');
    });
}

function fullRefill(id) {
    appState[id].pills = 30;
    const newLog = { timestamp: new Date().toLocaleTimeString(), action: `Refill: ${appState[id].name}`, status: "ADMIN" };
    appState.logs.unshift(newLog);
    generateUI();
    render(id, newLog);
}

document.getElementById('nav-dashboard').addEventListener('click', () => {
     generateUI();
});

function renderLogs() {
    const tableBody = document.getElementById('log-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = appState.logs.slice(0, 10).map(log => `
        <tr class="text-sm font-semibold text-slate-300">
            <td class="px-8 py-5 text-slate-500 font-mono text-[10px]">${log.timestamp}</td>
            <td class="px-8 py-5">${log.action}</td>
            <td class="px-8 py-5"><span class="px-2 py-1 bg-white/5 rounded text-[9px] font-black uppercase">${log.status}</span></td>
        </tr>`).join('');
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const targetedTab = document.getElementById('tab-' + tabId);
    if(targetedTab) targetedTab.classList.add('active');
    
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('sidebar-active', 'text-white'));
    const targetedNav = document.getElementById('nav-' + tabId);
    if(targetedNav) targetedNav.classList.add('sidebar-active', 'text-white');
}

function factoryReset() {
    const backdrop = document.getElementById('custom-confirm-modal');
    const card = document.getElementById('confirm-card');
    if(!backdrop || !card) return;
    
    backdrop.classList.remove('hidden');
    setTimeout(() => {
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeCustomConfirm(isConfirmed) {
    const backdrop = document.getElementById('custom-confirm-modal');
    const card = document.getElementById('confirm-card');
    if(!backdrop || !card) return;

    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        backdrop.classList.add('hidden');
        if(isConfirmed) {
            localStorage.clear(); 
            location.reload();
        }
    }, 150);
}

window.onload = init;