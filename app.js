import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// -------------------------------
// FIREBASE CONFIG
// -------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAAJgxXqBqKgvWnNIIBaG72iwiZ3PFykoU",
  authDomain: "put-away-log-cw.firebaseapp.com",
  projectId: "put-away-log-cw",
  storageBucket: "put-away-log-cw.firebasestorage.app",
  messagingSenderId: "23183103971",
  appId: "1:23183103971:web:75f097b4270cd38874f2d6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------------------
// DOM REFERENCES
// -------------------------------
const loginCard = document.getElementById('loginCard');
const appView = document.getElementById('appView');
const sessionBox = document.getElementById('sessionBox');
const sessionEmail = document.getElementById('sessionEmail');
const sessionRole = document.getElementById('sessionRole');
const adminSection = document.getElementById('adminSection');

const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
const signOutBtn = document.getElementById('signOutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const putAwayForm = document.getElementById('putAwayForm');
const workerName = document.getElementById('workerName');
const workDate = document.getElementById('workDate');
const lineItemsBody = document.getElementById('lineItemsBody');
const formMsg = document.getElementById('formMsg');
const usedLines = document.getElementById('usedLines');
const totalQty = document.getElementById('totalQty');
const clearBtn = document.getElementById('clearBtn');

const logsTableBody = document.getElementById('logsTableBody');
const searchInput = document.getElementById('searchInput');
const filterDate = document.getElementById('filterDate');
const exportBtn = document.getElementById('exportBtn');

const employeeForm = document.getElementById('employeeForm');
const employeeName = document.getElementById('employeeName');
const employeeMsg = document.getElementById('employeeMsg');
const employeeList = document.getElementById('employeeList');

let currentUserProfile = null;
let allLogs = [];
let activeEmployees = [];
let unsubs = [];

// -------------------------------
// HELPERS
// -------------------------------
function setToday() {
  workDate.value = new Date().toISOString().slice(0, 10);
}

function setMessage(el, text = '', type = '') {
  el.textContent = text;
  el.className = 'msg';
  if (type) el.classList.add(type);
}

function buildLineRows() {
  lineItemsBody.innerHTML = '';
  for (let i = 1; i <= 8; i += 1) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i}</td>
      <td><input type="text" class="item-input" data-row="${i}" placeholder="Item #" /></td>
      <td><input type="number" class="qty-input" data-row="${i}" min="0" step="1" placeholder="0" /></td>
      <td><input type="text" class="location-input" data-row="${i}" placeholder="A-10-1" /></td>
      <td><input type="text" class="notes-input" data-row="${i}" placeholder="Notes" /></td>
    `;
    lineItemsBody.appendChild(tr);
  }
  bindTotalListeners();
}

function getLineInputs() {
  return [...lineItemsBody.querySelectorAll('tr')].map((row, idx) => ({
    rowNumber: idx + 1,
    itemNumber: row.querySelector('.item-input').value.trim(),
    quantity: row.querySelector('.qty-input').value.trim(),
    location: row.querySelector('.location-input').value.trim().toUpperCase(),
    notes: row.querySelector('.notes-input').value.trim(),
  }));
}

function bindTotalListeners() {
  lineItemsBody.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', updateTotals);
  });
}

function updateTotals() {
  const lines = getLineInputs();
  const used = lines.filter((l) => l.itemNumber || l.quantity || l.location || l.notes);
  const qtySum = used.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  usedLines.textContent = String(used.length);
  totalQty.textContent = String(qtySum);
}

function clearForm() {
  putAwayForm.reset();
  setToday();
  buildLineRows();
  updateTotals();
  setMessage(formMsg);
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCSV(rows) {
  const header = ['date', 'name', 'line', 'itemNumber', 'quantity', 'location', 'notes'];
  const csv = [header.join(',')];

  rows.forEach((row) => {
    row.lines.forEach((line) => {
      csv.push([
        row.workDate,
        row.workerName,
        line.rowNumber,
        line.itemNumber,
        line.quantity,
        line.location,
        line.notes,
      ].map(csvEscape).join(','));
    });
  });

  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `put-away-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------
// RENDER
// -------------------------------
function renderEmployeeDropdown() {
  const current = workerName.value;
  workerName.innerHTML = '<option value="">Select worker</option>';

  activeEmployees.forEach((emp) => {
    const opt = document.createElement('option');
    opt.value = emp.name;
    opt.textContent = emp.name;
    workerName.appendChild(opt);
  });

  if ([...workerName.options].some((o) => o.value === current)) {
    workerName.value = current;
  }
}

function renderEmployeeList() {
  if (!employeeList) return;

  employeeList.innerHTML = '';

  if (!activeEmployees.length) {
    employeeList.innerHTML = '<div class="empty">No active workers yet.</div>';
    return;
  }

  activeEmployees.forEach((emp) => {
    const row = document.createElement('div');
    row.className = 'employee-row';
    row.innerHTML = `
      <div>
        <div class="name">${emp.name}</div>
        <div class="meta">Active worker dropdown option</div>
      </div>
      <button class="secondary" type="button">Remove</button>
    `;

    row.querySelector('button').addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'employees', emp.id), {
          active: false,
          updatedAt: serverTimestamp(),
        });
        setMessage(employeeMsg, 'Worker removed from dropdown.', 'success');
      } catch (err) {
        setMessage(employeeMsg, err.message, 'error');
      }
    });

    employeeList.appendChild(row);
  });
}

function renderLogs() {
  const search = searchInput.value.trim().toLowerCase();
  const dateValue = filterDate.value;

  const filtered = allLogs.filter((log) => {
    const haystack = [
      log.workerName,
      log.workDate,
      ...log.lines.map((l) => `${l.itemNumber} ${l.location} ${l.notes}`),
    ].join(' ').toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesDate = !dateValue || log.workDate === dateValue;
    return matchesSearch && matchesDate;
  });

  logsTableBody.innerHTML = '';

  if (!filtered.length) {
    logsTableBody.innerHTML = '<tr><td colspan="5" class="empty">No matching logs.</td></tr>';
    return;
  }

  filtered.forEach((log) => {
    const total = log.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    const preview = log.lines
      .slice(0, 2)
      .map((l) => `${l.itemNumber || '-'} / ${l.location || '-'}`)
      .join(' • ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${log.workDate}</td>
      <td>${log.workerName}</td>
      <td>${log.lines.length}</td>
      <td>${total}</td>
      <td>${preview || '-'}</td>
    `;
    logsTableBody.appendChild(tr);
  });
}

// -------------------------------
// FIREBASE LOADERS
// -------------------------------
async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));

  if (!snap.exists()) {
    throw new Error('No user profile found in Firestore users collection.');
  }

  const data = snap.data();

  if (data.active === false) {
    throw new Error('Your account has been turned off.');
  }

  return { id: snap.id, ...data };
}

function watchEmployees() {
  const q = query(
    collection(db, 'employees'),
    where('active', '==', true),
    orderBy('name')
  );

  return onSnapshot(q, (snapshot) => {
    activeEmployees = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderEmployeeDropdown();
    renderEmployeeList();
  });
}

function watchLogs() {
  const q = query(
    collection(db, 'putAwayLogs'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    allLogs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderLogs();
  });
}

// -------------------------------
// EVENTS
// -------------------------------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage(loginMsg, 'Signing in...');

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
    setMessage(loginMsg, 'Signed in.', 'success');
  } catch (err) {
    setMessage(loginMsg, err.message, 'error');
  }
});

signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

clearBtn.addEventListener('click', clearForm);
searchInput.addEventListener('input', renderLogs);
filterDate.addEventListener('input', renderLogs);
exportBtn.addEventListener('click', () => downloadCSV(allLogs));

putAwayForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage(formMsg);

  const lines = getLineInputs()
    .filter((l) => l.itemNumber || l.quantity || l.location || l.notes)
    .map((l) => ({
      ...l,
      quantity: Number(l.quantity) || 0,
    }));

  if (!workerName.value) {
    setMessage(formMsg, 'Pick a worker name.', 'error');
    return;
  }

  if (!workDate.value) {
    setMessage(formMsg, 'Choose a date.', 'error');
    return;
  }

  if (!lines.length) {
    setMessage(formMsg, 'Enter at least one line.', 'error');
    return;
  }

  const badLine = lines.find((l) => !l.itemNumber || !l.location || !l.quantity);

  if (badLine) {
    setMessage(formMsg, 'Each used line needs item number, quantity, and location.', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'putAwayLogs'), {
      workerName: workerName.value,
      workDate: workDate.value,
      lines,
      submittedByUid: auth.currentUser.uid,
      submittedByEmail: auth.currentUser.email,
      createdAt: serverTimestamp(),
    });

    setMessage(formMsg, 'Put away log submitted.', 'success');
    clearForm();
  } catch (err) {
    setMessage(formMsg, err.message, 'error');
  }
});

employeeForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUserProfile || !['admin', 'lead'].includes(currentUserProfile.role)) {
    setMessage(employeeMsg, 'You do not have permission for that.', 'error');
    return;
  }

  const newName = employeeName.value.trim();
  if (!newName) {
    setMessage(employeeMsg, 'Enter a worker name.', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'employees'), {
      name: newName,
      active: true,
      createdAt: serverTimestamp(),
      createdByUid: auth.currentUser.uid,
    });

    employeeName.value = '';
    setMessage(employeeMsg, 'Worker added to dropdown.', 'success');
  } catch (err) {
    setMessage(employeeMsg, err.message, 'error');
  }
});

// -------------------------------
// AUTH STATE
// -------------------------------
onAuthStateChanged(auth, async (user) => {
  unsubs.forEach((fn) => fn());
  unsubs = [];

  if (!user) {
    currentUserProfile = null;
    loginCard.classList.remove('hidden');
    appView.classList.add('hidden');
    sessionBox.classList.add('hidden');
    adminSection.classList.add('hidden');
    setMessage(loginMsg);
    return;
  }

  try {
    currentUserProfile = await loadUserProfile(user.uid);

    loginCard.classList.add('hidden');
    appView.classList.remove('hidden');
    sessionBox.classList.remove('hidden');

    sessionEmail.textContent = user.email;
    sessionRole.textContent = currentUserProfile.role || 'worker';

    adminSection.classList.toggle(
      'hidden',
      !['admin', 'lead'].includes(currentUserProfile.role)
    );

    unsubs.push(watchEmployees());
    unsubs.push(watchLogs());
  } catch (err) {
    await signOut(auth);
    setMessage(loginMsg, err.message, 'error');
  }
});

// -------------------------------
// INIT
// -------------------------------
setToday();
buildLineRows();
updateTotals();
