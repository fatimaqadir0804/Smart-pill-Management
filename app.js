const DEFAULT_STATE = {
    c1: { pills: 20, time: "08:00", name: "Alpha" },
    c2: { pills: 15, time: "12:00", name: "Beta" },
    c3: { pills: 30, time: "16:00", name: "Gamma" },
    c4: { pills: 10, time: "20:00", name: "Delta" },
    c5: { pills: 5,  time: "22:00", name: "Epsilon" },
    logs: [],
    audio: true
};

let appState = JSON.parse(localStorage.getItem('medPro_State_v3')) || DEFAULT_STATE;

const alarmSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');

function enterSystem() {
    document.getElementById('welcome-screen').classList.add('hidden-screen');
    if (appState.audio && window.Notification && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// Background click logic: allows closing alerts by clicking outside them
document.getElementById('toast-container').addEventListener('click', function(e) {
    if (e.target === this) {
        const activeToast = this.querySelector('.toast-animation-in');
        if (activeToast) closeToast(activeToast.querySelector('button'));
    }
});

function toggleSettings(show) {
    document.getElementById('settings-screen').classList.toggle('active', show);
}

function init() {
    generateUI();
    generateSettingsUI();
    lucide.createIcons();
    setInterval(() => {
        document.getElementById('system-clock').innerText = new Date().toLocaleTimeString();
    }, 1000);
    render();
}

function generateSettingsUI() {
    const container = document.getElementById('vault-rename-inputs');
    container.innerHTML = "";
    for(let i=1; i<=5; i++) {
        container.innerHTML += `
            <div class="flex items-center gap-3">
                <span class="text-xs font-mono text-slate-600">V${i}</span>
                <input type="text" id="name_c${i}" value="${appState['c'+i].name}" 
                    class="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-500">
            </div>
        `;
    }
    document.getElementById('audio-toggle').checked = appState.audio;
}

function saveSettings() {
    for(let i=1; i<=5; i++) appState['c'+i].name = document.getElementById(`name_c${i}`).value;
    appState.audio = document.getElementById('audio-toggle').checked;
    toggleSettings(false);
    generateUI();
    render();
    showCustomToast("System Update", "Configuration parameters updated successfully.", "info");
}

function generateUI() {
    const grid = document.getElementById('container-grid');
    const inv = document.getElementById('inventory-controls');
    grid.innerHTML = ""; inv.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
        const id = `c${i}`;
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
                <input type="time" id="${id}_time" value="${appState[id].time}" onchange="syncData()" 
                    class="w-full px-4 py-4 bg-white/5 rounded-2xl font-bold text-white border border-white/5 mb-4 outline-none">
                <button onclick="triggerDispense('${id}')" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/10">Dispense</button>
            </div>
        `;
        inv.innerHTML += `<button onclick="fullRefill('${id}')" class="p-6 bg-white/5 border border-white/5 rounded-2xl text-left hover:bg-indigo-500/10 transition"><p class="text-[10px] font-black text-slate-500 uppercase">${appState[id].name}</p><p class="text-sm font-bold text-white">Refill to 30</p></button>`;
    }
    lucide.createIcons();
}

function render() {
    for (let i = 1; i <= 5; i++) {
        const id = `c${i}`;
        document.getElementById(`${id}_pills`).innerText = appState[id].pills;
        const badge = document.getElementById(`${id}-status-badge`);
        
        if (appState[id].pills <= 5) {
            badge.className = "px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[9px] font-black rounded-full border border-rose-500/20";
            badge.innerText = "LOW STOCK";
            document.getElementById(`${id}_pills`).classList.add('pill-low');
        } else {
            badge.className = "px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded-full border border-emerald-500/20";
            badge.innerText = "OPTIMAL";
            document.getElementById(`${id}_pills`).classList.remove('pill-low');
        }
    }
    renderLogs();
    localStorage.setItem('medPro_State_v3', JSON.stringify(appState));
}

function triggerDispense(id) {
    if (appState[id].pills > 0) {
        appState[id].pills--;
        appState.logs.unshift({ timestamp: new Date().toLocaleTimeString(), action: `Authorized: ${appState[id].name}`, status: "SUCCESS" });
        
        if (appState[id].pills <= 5) {
            triggerLowStockAlert(id, appState[id].name, appState[id].pills);
        }
        render();
    } else { 
        showCustomToast("Vault Depleted", `Cannot dispense from ${appState[id].name}. Stock level is completely zero.`, "critical", id); 
    }
}

function triggerLowStockAlert(id, vaultName, count) {
    if (!appState.audio) return;

    alarmSound.play().catch(e => console.log("Audio pipeline active."));

    showCustomToast(
        `Low Stock Warning`, 
        `Vault <b>${vaultName}</b> has dropped to a critical level of <b>${count}</b> items.`, 
        count === 0 ? "critical" : "warning",
        id
    );

    if (window.Notification && Notification.permission === "granted") {
        new Notification(`MedTrack Inventory Warning`, {
            body: `${vaultName} is running critically low (${count} left).`,
            icon: "https://cdn-icons-png.flaticon.com/512/4213/4213179.png"
        });
    }
}

function showCustomToast(title, bodyText, type = "warning", vaultId = null) {
    const container = document.getElementById('toast-container');
    
    // Enable pointing events to handle clicks on the active box
    container.classList.remove('pointer-events-none');
    
    const toast = document.createElement('div');
    
    let config = {
        bg: "background: linear-gradient(135deg, rgba(244,63,94,0.2) 0%, rgba(15,23,42,0.95) 100%); border-color: rgba(244,63,94,0.4); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px 0 rgba(244,63,94,0.15);",
        icon: "alert-triangle",
        iconColor: "text-rose-400"
    };
    if (type === "info") {
        config = {
            bg: "background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(15,23,42,0.95) 100%); border-color: rgba(99,102,241,0.4); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px 0 rgba(99,102,241,0.15);",
            icon: "info",
            iconColor: "text-indigo-400"
        };
    }

    toast.className = "toast-animation-in pointer-events-auto w-full max-w-md glass-card p-6 rounded-[2rem] flex flex-col gap-4 border relative overflow-hidden";
    toast.style = config.bg;

    let actionButtonHtml = vaultId ? `
        <div class="flex justify-end border-t border-white/5 pt-3 mt-1">
            <button onclick="fullRefill('${vaultId}'); this.closest('.toast-animation-in').remove(); document.getElementById('toast-container').classList.add('pointer-events-none');" class="px-4 py-2 bg-white/5 hover:bg-indigo-600/30 text-white rounded-xl text-[11px] font-black uppercase tracking-wider border border-white/10 hover:border-indigo-500/40 transition-all flex items-center gap-1.5">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Emergency Refill
            </button>
        </div>
    ` : '';

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
        ${actionButtonHtml}
    `;

    // Clear previous toast instances so they do not stack on top of each other in center space
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
    appState.logs.unshift({ timestamp: new Date().toLocaleTimeString(), action: `Refill: ${appState[id].name}`, status: "ADMIN" });
    render();
}

function renderLogs() {
    document.getElementById('log-table-body').innerHTML = appState.logs.slice(0, 10).map(log => `
        <tr class="text-sm font-semibold text-slate-300">
            <td class="px-8 py-5 text-slate-500 font-mono text-[10px]">${log.timestamp}</td>
            <td class="px-8 py-5">${log.action}</td>
            <td class="px-8 py-5"><span class="px-2 py-1 bg-white/5 rounded text-[9px] font-black uppercase">${log.status}</span></td>
        </tr>
    `).join('');
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('sidebar-active', 'text-white'));
    document.getElementById('nav-' + tabId).classList.add('sidebar-active', 'text-white');
}

function syncData() {
    for (let i = 1; i <= 5; i++) appState[`c${i}`].time = document.getElementById(`c${i}_time`).value;
    render();
}

function factoryReset() { 
    if(confirm("Confirm Reset?")) { 
        localStorage.clear(); 
        location.reload(); 
    } 
}

window.onload = init;