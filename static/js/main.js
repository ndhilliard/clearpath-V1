// ── Helpers ──────────────────────────────────────────────────────

function showError(msg) {
    const el = document.getElementById('error-msg');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden'); // was el.ClassList (wrong capitalization)
    }
}

function saveToken(token) {
    localStorage.setItem('token', token);
}

function getToken() {
    return localStorage.getItem('token');
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
}

// ── Login ─────────────────────────────────────────────────────────

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const res = await fetch('/api/login', { // was 'api/login.' (missing slash, had a period)
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            saveToken(data.token);
            if (data.role === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }
        }
    });
}

// ── Register ──────────────────────────────────────────────────────

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const first_name = document.getElementById('first_name').value;
        const last_name = document.getElementById('last_name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value; // was missing entirely
        const confirm_password = document.getElementById('confirm_password').value;

        if (password !== confirm_password) {
            showError('Passwords do not match');
            return;
        }

        const res = await fetch('/api/register', { // this whole block was missing
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name, last_name, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            saveToken(data.token);
            window.location.href = '/dashboard';
        } else {
            showError(data.error || 'Registration failed');
        }
    });
}

// ── Dashboard ─────────────────────────────────────────────────────

async function loadDashboard() {
    const token = getToken();
    if (!token) {
        window.location.href = '/';
        return;
    }

    const res = await fetch('/api/me', { // was missing leading slash
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        logout();
        return;
    }

    const user = await res.json();
    const welcomeMsg = document.getElementById('welcome-msg');
    const navUsername = document.getElementById('nav-username');

    if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${user.first_name}!`; // was welcome.Msg and wrong quotes
    if (navUsername) navUsername.textContent = `${user.first_name} ${user.last_name}`; // was wrong quotes
}

if (document.getElementById('welcome-msg')) { // this was accidentally inside loadDashboard
    loadDashboard();
}

// ── Modals ────────────────────────────────────────────────────────

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    if (id === 'appointments-modal') {
        loadAppointments();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Close modal when clicking the overlay background
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
        }
    });
});

// ── Appointments ──────────────────────────────────────────────────

async function submitAppointment() {
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;
    const reason = document.getElementById('appt-reason').value;

    if (!date || !time || !reason) {
        const err = document.getElementById('appointment-error');
        err.textContent = 'Please fill in all fields';
        err.classList.remove('hidden');
        return;
    }

    const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ date, time, reason })
    });

    if (res.ok) {
        document.getElementById('appointment-error').classList.add('hidden');
        document.getElementById('appointment-success').classList.remove('hidden');
        document.getElementById('appt-date').value = '';
        document.getElementById('appt-time').value = '';
        document.getElementById('appt-reason').value = '';
    } else {
        const data = await res.json();
        const err = document.getElementById('appointment-error');
        err.textContent = data.error || 'Something went wrong';
        err.classList.remove('hidden');
    }
}

async function loadAppointments() {
    const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const appointments = await res.json();
    const list = document.getElementById('appointments-list');

    if (appointments.length === 0) {
        list.innerHTML = '<p class="no-appointments">No appointments found.</p>';
        return;
    }

    list.innerHTML = appointments.map(appt => `
        <div class="appointment-item">
            <h4>${appt.date} at ${appt.time}</h4>
            <p>${appt.reason}</p>
            <span class="status-badge status-${appt.status}">${appt.status}</span>
        </div>
    `).join('');
}

// ── Admin ─────────────────────────────────────────────────────────

async function loadAdminDashboard() {
    const token = getToken();
    if (!token) {
        window.location.href = '/';
        return;
    }

    const res = await fetch('/api/admin/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        logout();
        return;
    }

    const appointments = await res.json();
    const container = document.getElementById('appointments-container');

    if (appointments.length === 0) {
        container.innerHTML = '<p class="no-appointments">No appointment requests yet.</p>';
        return;
    }

    container.innerHTML = appointments.map(appt => `
        <div class="admin-appt-card" id="appt-${appt.id}">
            <div class="admin-appt-info">
                <h4>${appt.first_name} ${appt.last_name}</h4>
                <p class="appt-email">${appt.email}</p>
                <p>${appt.date} at ${appt.time}</p>
                <p class="appt-reason">${appt.reason}</p>
            </div>
            <div class="admin-appt-actions">
                <span class="status-badge status-${appt.status}">${appt.status}</span>
                ${appt.status === 'pending' ? `
                    <button class="btn-confirm" onclick="updateStatus(${appt.id}, 'confirmed')">✓ Confirm</button>
                    <button class="btn-cancel" onclick="updateStatus(${appt.id}, 'cancelled')">✕ Cancel</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function updateStatus(id, status) {
    const res = await fetch(`/api/admin/appointments/${id}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ status })
    });

    if (res.ok) {
        loadAdminDashboard();
    }
}

if (document.getElementById('appointments-container')) {
    loadAdminDashboard();
}