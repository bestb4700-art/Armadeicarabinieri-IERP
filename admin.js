import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, push, onValue }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── Firebase config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBkVYKdHpovJ-_CQZQo7wqRIb9Eguk0JMc",
  authDomain: "ierp-carabinieri.firebaseapp.com",
  databaseURL: "https://ierp-carabinieri-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ierp-carabinieri",
  storageBucket: "ierp-carabinieri.firebasestorage.app",
  messagingSenderId: "306373058074",
  appId: "1:306373058074:web:932c2c1dd4aec4a7d0bba3"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Hash SHA-256 ─────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Setup primo admin (eseguito solo se non esiste) ───────────────
async function setupFirstAdmin() {
  const snap = await get(ref(db, "admins"));
  if (!snap.exists()) {
    const hash = await hashPassword("Arma2026");
    await set(ref(db, "admins/MattiaChiaro"), { username: "MattiaChiaro", password: hash });
  }
}
setupFirstAdmin();

// ── Stato sessione (solo in memoria, non localStorage) ───────────
let currentUser = null;

// ── LOGIN ────────────────────────────────────────────────────────
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  const errEl = document.getElementById("loginError");
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  btn.disabled = true;
  btn.textContent = "Verifica...";
  errEl.textContent = "";

  try {
    const snap = await get(ref(db, `admins/${username}`));
    if (!snap.exists()) {
      errEl.textContent = "Credenziali non valide.";
      btn.disabled = false;
      btn.textContent = "ACCEDI AL PANNELLO";
      return;
    }
    const adminData = snap.val();
    const inputHash = await hashPassword(password);

    if (inputHash !== adminData.password) {
      errEl.textContent = "Credenziali non valide.";
      btn.disabled = false;
      btn.textContent = "ACCEDI AL PANNELLO";
      return;
    }

    // Login OK
    currentUser = username;
    document.getElementById("loggedUsername").textContent = username;
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    loadStaff();
    loadAdmins();

  } catch (err) {
    errEl.textContent = "Errore di connessione. Riprova.";
    btn.disabled = false;
    btn.textContent = "ACCEDI AL PANNELLO";
  }
});

// ── LOGOUT ───────────────────────────────────────────────────────
document.getElementById("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginBtn").disabled = false;
  document.getElementById("loginBtn").textContent = "ACCEDI AL PANNELLO";
});

// ── TABS ─────────────────────────────────────────────────────────
document.querySelectorAll(".sb-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll(".sb-link").forEach(l => l.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
    link.classList.add("active");
    document.getElementById(`tab-${tab}`).classList.remove("hidden");
  });
});

// ── CARICA PERSONALE ─────────────────────────────────────────────
function loadStaff() {
  const tbody = document.getElementById("staffTableBody");
  onValue(ref(db, "staff"), (snap) => {
    tbody.innerHTML = "";
    if (!snap.exists()) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Nessun membro registrato.</td></tr>`;
      return;
    }
    let i = 1;
    snap.forEach(child => {
      const m = child.val();
      const key = child.key;
      const statusClass = {
        "Attivo": "status-attivo",
        "In Addestramento": "status-addestramento",
        "Sospeso": "status-sospeso",
        "Congedo": "status-congedo"
      }[m.status] || "status-attivo";

      tbody.innerHTML += `
        <tr>
          <td>${i++}</td>
          <td>${m.name}</td>
          <td>${m.grade}</td>
          <td>${m.reparto}</td>
          <td><span class="status-badge ${statusClass}">${m.status}</span></td>
          <td><button class="btn-delete" onclick="deleteMember('${key}')">Rimuovi</button></td>
        </tr>`;
    });
  });
}

// ── AGGIUNGI MEMBRO ──────────────────────────────────────────────
document.getElementById("addMemberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const successEl = document.getElementById("addSuccess");
  const errorEl   = document.getElementById("addError");
  successEl.classList.add("hidden");
  errorEl.classList.add("hidden");

  const member = {
    name:    document.getElementById("memberName").value.trim(),
    roblox:  document.getElementById("memberRoblox").value.trim(),
    grade:   document.getElementById("memberGrade").value,
    reparto: document.getElementById("memberReparto").value,
    status:  document.getElementById("memberStatus").value,
    note:    document.getElementById("memberNote").value.trim(),
    addedBy: currentUser,
    addedAt: new Date().toISOString()
  };

  try {
    await push(ref(db, "staff"), member);
    successEl.classList.remove("hidden");
    document.getElementById("addMemberForm").reset();
    setTimeout(() => successEl.classList.add("hidden"), 3000);
  } catch (err) {
    errorEl.textContent = "Errore durante il salvataggio.";
    errorEl.classList.remove("hidden");
  }
});

// ── RIMUOVI MEMBRO ───────────────────────────────────────────────
window.deleteMember = async (key) => {
  if (!confirm("Rimuovere questo membro?")) return;
  await remove(ref(db, `staff/${key}`));
};

// ── CARICA ADMINS ────────────────────────────────────────────────
function loadAdmins() {
  const tbody = document.getElementById("adminTableBody");
  onValue(ref(db, "admins"), (snap) => {
    tbody.innerHTML = "";
    if (!snap.exists()) {
      tbody.innerHTML = `<tr><td colspan="2" class="table-empty">Nessun admin.</td></tr>`;
      return;
    }
    snap.forEach(child => {
      const key = child.key;
      tbody.innerHTML += `
        <tr>
          <td>${key}</td>
          <td>
            ${key !== currentUser
              ? `<button class="btn-delete" onclick="deleteAdmin('${key}')">Rimuovi</button>`
              : `<span style="color:var(--gray);font-size:0.8rem;">Account attivo</span>`
            }
          </td>
        </tr>`;
    });
  });
}

// ── AGGIUNGI ADMIN ───────────────────────────────────────────────
document.getElementById("addAdminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const successEl = document.getElementById("adminSuccess");
  const errorEl   = document.getElementById("adminError");
  successEl.classList.add("hidden");
  errorEl.classList.add("hidden");

  const username = document.getElementById("newAdminUsername").value.trim();
  const password = document.getElementById("newAdminPassword").value;

  if (!username || !password) return;

  try {
    const existing = await get(ref(db, `admins/${username}`));
    if (existing.exists()) {
      errorEl.textContent = "Username già esistente.";
      errorEl.classList.remove("hidden");
      return;
    }
    const hash = await hashPassword(password);
    await set(ref(db, `admins/${username}`), { username, password: hash });
    successEl.classList.remove("hidden");
    document.getElementById("addAdminForm").reset();
    setTimeout(() => successEl.classList.add("hidden"), 3000);
  } catch (err) {
    errorEl.textContent = "Errore durante il salvataggio.";
    errorEl.classList.remove("hidden");
  }
});

// ── RIMUOVI ADMIN ────────────────────────────────────────────────
window.deleteAdmin = async (key) => {
  if (key === currentUser) return;
  if (!confirm(`Rimuovere l'admin "${key}"?`)) return;
  await remove(ref(db, `admins/${key}`));
};
