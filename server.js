const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Added for secure password hashing

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

const db = new sqlite3.Database('./MedTrackPRO.db', (err) => {
    if (err) console.error("Database opening error:", err.message);
    else console.log("Connected to SQLite database (MedTrackPRO.db).");
});

db.serialize(() => {
    // 1. Vaults Table Definition
    db.run(`CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY,
        name TEXT,
        pills INTEGER,
        time1 TEXT, time1_active INTEGER,
        time2 TEXT, time2_active INTEGER,
        time3 TEXT, time3_active INTEGER,
        lastDoseDate TEXT,
        completedDoses TEXT
    )`);

    // 2. System Audit Logs Table Definition
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action TEXT,
        status TEXT
    )`);

    // 3. Upgraded Patient Table (Now supports password hashes)
    db.run(`CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT,
        password TEXT
    )`);
    
    // Seed default vaults
    db.get("SELECT COUNT(*) as count FROM vaults", [], (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare(`INSERT INTO vaults VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            stmt.run("c1", "Alpha", 20, "08:00", 1, "14:00", 1, "20:00", 1, "", "[]");
            stmt.run("c2", "Beta", 15, "08:00", 1, "14:00", 1, "20:00", 1, "", "[]");
            stmt.run("c3", "Gamma", 30, "08:00", 1, "14:00", 1, "20:00", 1, "", "[]");
            stmt.run("c4", "Delta", 10, "08:00", 1, "14:00", 1, "20:00", 1, "", "[]");
            stmt.run("c5", "Epsilon", 5, "08:00", 1, "14:00", 1, "20:00", 1, "", "[]");
            stmt.finalize();
        }
    });

    // Seed default patients with hashed credentials
    db.get("SELECT COUNT(*) as count FROM patients", [], (err, row) => {
        if (row && row.count === 0) {
            const salt = bcrypt.genSaltSync(10);
            const defaultHash = bcrypt.hashSync("password123", salt); // Safe, encrypted string

            const stmt = db.prepare(`INSERT INTO patients (id, name, password) VALUES (?, ?, ?)`);
            stmt.run("P-1002", "Jane Doe", defaultHash);
            stmt.run("P-1045", "John Smith", defaultHash);
            stmt.finalize();
            console.log("Database seeded with secure patient profiles.");
        }
    });
});

// GET: Aggregates complete application configuration state
app.get('/api/state', (req, res) => {
    db.all("SELECT * FROM vaults", [], (err, vaults) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT timestamp, action, status FROM logs ORDER BY id DESC LIMIT 10", [], (err, logs) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Exclude the password hashes from the global sync state for client privacy
            db.all("SELECT id, name FROM patients", [], (err, patients) => {
                if (err) return res.status(500).json({ error: err.message });

                const state = { 
                    logs: logs || [], 
                    audio: true,
                    patients: patients || [] 
                };

                vaults.forEach(v => {
                    state[v.id] = {
                        name: v.name, pills: v.pills,
                        time1: v.time1, time1_active: !!v.time1_active,
                        time2: v.time2, time2_active: !!v.time2_active,
                        time3: v.time3, time3_active: !!v.time3_active,
                        lastDoseDate: v.lastDoseDate || "",
                        completedDoses: v.completedDoses ? JSON.parse(v.completedDoses) : []
                    };
                });
                res.json(state);
            });
        });
    });
});

// POST: Updates an individual medication vault parameters
app.post('/api/vault/update', (req, res) => {
    const { id, name, pills, time1, time1_active, time2, time2_active, time3, time3_active, lastDoseDate, completedDoses } = req.body;
    const sql = `UPDATE vaults SET name=?, pills=?, time1=?, time1_active=?, time2=?, time2_active=?, time3=?, time3_active=?, lastDoseDate=?, completedDoses=? WHERE id=?`;
    db.run(sql, [name, pills, time1, time1_active?1:0, time2, time2_active?1:0, time3, time3_active?1:0, lastDoseDate, JSON.stringify(completedDoses || []), id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "SUCCESS" });
    });
});

// POST: Handles full updates from client (Hashes clear text inputs before writing to disk)
app.post('/api/state/update', (req, res) => {
    const { patients } = req.body;
    if (!Array.isArray(patients)) {
        return res.status(400).json({ error: "Array expected." });
    }

    // First retrieve current database layout to avoid blanking existing passwords that the client didn't see
    db.all("SELECT id, password FROM patients", [], (err, existingRecords) => {
        if (err) return res.status(500).json({ error: err.message });

        // Map existing patient record hashes by their unique identity keys
        const existingHashesMap = {};
        if (existingRecords) {
            existingRecords.forEach(row => {
                existingHashesMap[row.id] = row.password;
            });
        }

        db.run("DELETE FROM patients", [], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            if (patients.length === 0) return res.json({ status: "SUCCESS" });

            const stmt = db.prepare("INSERT INTO patients (id, name, password) VALUES (?, ?, ?)");
            
            patients.forEach(p => {
                let finalizedPassword = p.password;
                
                // If client didn't supply a password field (since the GET payload strips them out)
                if (!finalizedPassword) {
                    // Check if we already have a hashed identity profile safely recorded in our local map
                    if (existingHashesMap[p.id]) {
                        finalizedPassword = existingHashesMap[p.id];
                    } else {
                        // Fallback default hash if it's completely new and left blank
                        const salt = bcrypt.genSaltSync(10);
                        finalizedPassword = bcrypt.hashSync("password123", salt);
                    }
                } 
                // If it's a plain text string typed into the UI, hash it securely before writing it down!
                else if (!finalizedPassword.startsWith('$2a$')) {
                    const salt = bcrypt.genSaltSync(10);
                    finalizedPassword = bcrypt.hashSync(finalizedPassword, salt);
                }

                stmt.run(p.id, p.name, finalizedPassword);
            });
            
            stmt.finalize((err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ status: "SUCCESS" });
            });
        });
    });
});

// POST: Logs system actions
app.post('/api/logs', (req, res) => {
    const { timestamp, action, status } = req.body;
    db.run(`INSERT INTO logs (timestamp, action, status) VALUES (?, ?, ?)`, [timestamp, action, status], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "SUCCESS" });
    });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));