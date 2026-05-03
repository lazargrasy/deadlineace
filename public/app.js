// ===== API HELPER =====
const API = '/api';
let TOKEN = localStorage.getItem('srb_token');

async function api(endpoint, method = 'GET', body = null, isFile = false) {
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  if (!isFile) headers['Content-Type'] = 'application/json';

  const config = { method, headers };
  if (body) {
    config.body = isFile ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || 'Error');
    return data;
  } catch (err) {
    console.error(err);
    // If unauthorized, force logout
    if (err.message.includes('token') || err.message.includes('Unauthorized')) handleLogout();
    return null;
  }
}

// ===== STATE =====
let currentUser = localStorage.getItem('srb_user') ? JSON.parse(localStorage.getItem('srb_user')) : null;
let selectedRole = 'student';
let currentPage = 'dashboard';
let isRegisterMode = false;

// ===== AUTH =====
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
}

function toggleAuthMode(register) {
  isRegisterMode = register;
  document.getElementById('name-group').classList.toggle('hidden', !register);
  document.getElementById('auth-title').textContent = register ? "Create Account" : "Welcome back";
  document.getElementById('auth-btn').textContent = register ? "Sign Up" : "Sign In";
}

function handleAuth() {
  isRegisterMode ? handleRegister() : handleLogin();
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');

  const data = await api('/login', 'POST', { username, password, role: selectedRole });
  if (!data) { err.textContent = 'Invalid credentials'; err.classList.remove('hidden'); return; }
  
  err.classList.add('hidden');
  localStorage.setItem('srb_token', data.token);
  localStorage.setItem('srb_user', JSON.stringify(data.user));
  currentUser = data.user;
  TOKEN = data.token;
  initApp();
}

async function handleRegister() {
  const name = document.getElementById('login-name').value.trim();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  
  const data = await api('/register', 'POST', { name, username, password, role: selectedRole });
  if (!data) { err.textContent = 'Error creating account'; err.classList.remove('hidden'); return; }

  localStorage.setItem('srb_token', data.token);
  localStorage.setItem('srb_user', JSON.stringify(data.user));
  currentUser = data.user;
  TOKEN = data.token;
  initApp();
}

function handleLogout() {
  currentUser = null; TOKEN = null;
  localStorage.removeItem('srb_token');
  localStorage.removeItem('srb_user');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');
  toggleAuthMode(false);
}

function initApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = currentUser.name;
  document.getElementById('sidebar-role').textContent = currentUser.role === 'admin' ? 'Faculty' : 'Student';
  document.getElementById('topbar-avatar').textContent = initials;
  
  buildNav();
  navigateTo('dashboard');
}

// ===== NAVIGATION =====
const navConfig = {
  student: [
    { id: 'dashboard', label: 'Dashboard', icon: homeIcon() },
    { id: 'deadlines', label: 'Deadlines', icon: calendarIcon() },
    { id: 'submissions', label: 'My Submissions', icon: uploadIcon() },
    { id: 'grades', label: 'My Grades', icon: starIcon() },
    { id: 'attendance', label: 'Attendance', icon: checkCircleIcon() },
    { id: 'queries', label: 'Queries', icon: chatIcon() },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: homeIcon() },
    { id: 'manage-assignments', label: 'Assignments', icon: calendarIcon() },
    { id: 'grade-submissions', label: 'Grade Submissions', icon: starIcon() },
    { id: 'attendance-admin', label: 'Mark Attendance', icon: checkCircleIcon() },
    { id: 'queries-admin', label: 'Student Queries', icon: chatIcon(), badge: true },
  ],
};

function buildNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = navConfig[currentUser.role].map(item => {
    // Note: Badge count logic needs async fetching, simplified here
    return `<button class="nav-item" data-page="${item.id}" onclick="navigateTo('${item.id}')">${item.icon}<span>${item.label}</span></button>`;
  }).join('');
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.page === page); });
  const titles = { dashboard: ['Dashboard', 'Home'], deadlines: ['Deadlines', 'Assignments'], submissions: ['My Submissions', 'Submissions'], grades: ['My Grades', 'Grades'], attendance: ['Attendance History', 'Attendance'], queries: ['Academic Queries', 'Queries'], 'manage-assignments': ['Manage Assignments', 'Assignments'], 'grade-submissions': ['Grade Submissions', 'Grading'], 'attendance-admin': ['Mark Attendance', 'Attendance'], 'queries-admin': ['Student Queries', 'Queries'] };
  const [title, crumb] = titles[page] || ['Dashboard', 'Home'];
  document.getElementById('page-title').textContent = title;
  document.getElementById('breadcrumb').textContent = crumb;
  document.getElementById('content-area').innerHTML = '';
  const pages = { dashboard: renderDashboard, deadlines: renderDeadlines, submissions: renderSubmissions, grades: renderGrades, attendance: renderAttendance, queries: renderQueries, 'manage-assignments': renderManageAssignments, 'grade-submissions': renderGradeSubmissions, 'attendance-admin': renderAttendanceAdmin, 'queries-admin': renderQueriesAdmin };
  if (pages[page]) pages[page]();
  closeSidebar();
}

// ===== DASHBOARD =====
async function renderDashboard() { 
  const area = document.getElementById('content-area'); 
  // Fetch users and assignments
  const assignments = await api('/assignments');
  const users = currentUser.role === 'admin' ? await api('/users') : [];
  
  if (currentUser.role === 'student') {
    const subs = await api('/submissions');
    area.innerHTML = `<div class="welcome-banner mb-24"><h2>Hello, ${currentUser.name}!</h2></div><div class="grid-4 mb-24"><div class="stat-card"><div class="stat-info"><div class="stat-value">${assignments?.length || 0}</div><div class="stat-label">Total Assignments</div></div></div><div class="stat-card"><div class="stat-info"><div class="stat-value">${subs?.filter(s=>s.studentId?._id === currentUser.id).length || 0}</div><div class="stat-label">Submitted</div></div></div></div>`;
  } else {
    area.innerHTML = `<div class="welcome-banner mb-24"><h2>Welcome, ${currentUser.name}!</h2></div><div class="grid-4 mb-24"><div class="stat-card"><div class="stat-info"><div class="stat-value">${users?.filter(u=>u.role==='student').length || 0}</div><div class="stat-label">Students</div></div></div><div class="stat-card"><div class="stat-info"><div class="stat-value">${assignments?.length || 0}</div><div class="stat-label">Assignments</div></div></div></div>`;
  }
}

// ===== ASSIGNMENTS (Student) =====
async function renderDeadlines() {
  const area = document.getElementById('content-area'); 
  const assignments = await api('/assignments');
  area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Active Deadlines</h3></div><div class="grid-2 mb-24">${(assignments || []).map(a => `
    <div class="deadline-card" onclick="viewAssignment('${a._id}')">
      <div class="deadline-title">${a.title}</div>
      <div class="text-xs text-dim">${a.subject}</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-secondary btn-sm" onclick="event.stopPropagation();viewAssignment('${a._id}')">View</button>
        <button class="btn-primary btn-sm" onclick="event.stopPropagation();openSubmitModal('${a._id}')">Submit</button>
      </div>
    </div>
  `).join('')}</div>`;
}

async function viewAssignment(id) { 
  const a = (await api('/assignments'))?.find(x => x._id === id);
  if (!a) return;
  openModal(`${a.title}`, `<p>${a.description}</p>${a.questionFile ? `<a href="http://localhost:5000/${a.questionFile}" target="_blank" class="file-attachment mt-12">📥 Download Question</a>` : ''}<div class="modal-actions"><button class="btn-primary" onclick="closeModal();openSubmitModal('${id}')">Submit</button></div>`);
}

async function openSubmitModal(assignmentId) { 
  openModal('Submit Assignment', `<div class="form-group"><label>Upload File</label><input type="file" id="file-input" class="form-input"/></div><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitAssignment('${assignmentId}')">Submit</button></div>`);
}

async function submitAssignment(assignmentId) { 
  const fileInput = document.getElementById('file-input');
  const formData = new FormData();
  formData.append('assignmentId', assignmentId);
  formData.append('method', 'online');
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

  const res = await api('/submissions', 'POST', formData, true);
  if (res) { closeModal(); showToast('Submitted!', 'success'); navigateTo('submissions'); }
}

async function renderSubmissions() { 
  const area = document.getElementById('content-area'); 
  const subs = await api('/submissions');
  const mySubs = (subs || []).filter(s => s.studentId?._id === currentUser.id);
  
  area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">My Submissions</h3></div>${mySubs.length === 0 ? emptyStateHTML('No submissions') : mySubs.map(s => `
    <div class="card mb-12">
      <div style="display:flex;justify-content:space-between">
        <div><div class="fw-bold">${s.assignmentId?.title}</div><div class="text-xs text-dim">${s.submittedAt}</div></div>
        <span class="badge ${s.status === 'Verified' ? 'badge-green' : 'badge-amber'}">${s.status}</span>
      </div>
      ${s.filePath ? `<a href="http://localhost:5000/${s.filePath}" target="_blank" class="file-attachment mt-12">📥 ${s.fileName}</a>` : ''}
    </div>
  `).join('')}`;
}

// ===== ADMIN: MANAGE ASSIGNMENTS =====
async function renderManageAssignments() { 
  const area = document.getElementById('content-area'); 
  const assignments = await api('/assignments');
  area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Assignments</h3><button class="btn-primary" onclick="openCreateAssignment()">+ Create</button></div>${(assignments || []).map(a => `
    <div class="card mb-12"><div style="display:flex;justify-content:space-between"><div><div class="fw-bold">${a.title}</div><div class="text-xs text-dim">${a.subject}</div></div><button class="btn-danger btn-sm" onclick="deleteAssignment('${a._id}')">Delete</button></div></div>
  `).join('')}`;
}

function openCreateAssignment() { 
  openModal('Create Assignment', `<div class="form-group"><label>Title</label><input class="form-input" id="ca-title"/></div><div class="form-group"><label>Subject</label><input class="form-input" id="ca-subject"/></div><div class="form-group"><label>Description</label><textarea class="form-input" id="ca-desc" rows="2"></textarea></div><div class="form-group"><label>File (Optional)</label><input type="file" id="ca-file" class="form-input"/></div><div class="grid-2"><input type="date" class="form-input" id="ca-due"/><select class="form-input" id="ca-priority"><option>High</option><option>Medium</option></select></div><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="createAssignment()">Create</button></div>`, true); 
}

async function createAssignment() { 
  const title = document.getElementById('ca-title').value.trim();
  const subject = document.getElementById('ca-subject').value.trim();
  const desc = document.getElementById('ca-desc').value.trim();
  const due = document.getElementById('ca-due').value;
  const priority = document.getElementById('ca-priority').value;
  const fileInput = document.getElementById('ca-file');

  if (!title || !subject || !due) { showToast('Fill required fields', 'error'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('subject', subject);
  formData.append('description', desc);
  formData.append('dueDate', due);
  formData.append('priority', priority);
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

  const res = await api('/assignments', 'POST', formData, true);
  if (res) { closeModal(); showToast('Created!', 'success'); navigateTo('manage-assignments'); }
}

async function deleteAssignment(id) { 
  if(confirm('Delete?')) { 
    await api(`/assignments/${id}`, 'DELETE'); 
    showToast('Deleted', 'info'); navigateTo('manage-assignments'); 
  } 
}

// ===== ADMIN: GRADE SUBMISSIONS =====
async function renderGradeSubmissions() { 
  const area = document.getElementById('content-area'); 
  const subs = await api('/submissions');
  area.innerHTML = `
    <div class="section-header mb-20">
        <h3 class="section-title">Grade Submissions</h3>
        <button class="btn-success btn-sm" onclick="openManualModal()">Record In-Person</button>
    </div>
    ${(subs || []).map(s => `
    <div class="card mb-12">
      <div style="display:flex;justify-content:space-between">
        <div>
          <div class="fw-bold">${s.studentId?.name}</div>
          <div class="text-xs text-dim">${s.assignmentId?.title} <span class="badge badge-${s.method==='online'?'blue':'purple'}">${s.method}</span></div>
        </div>
        <div>
            ${s.status === 'Verified' ? '<span class="badge badge-green">Graded</span>' : ''}
            <button class="btn-primary btn-sm" onclick="openGradeModal('${s._id}')">Grade</button>
        </div>
      </div>
      ${s.filePath ? `<a href="http://localhost:5000/${s.filePath}" target="_blank" class="file-attachment mt-12">📥 ${s.fileName}</a>` : ''}
    </div>
  `).join('')}`;
}

async function openGradeModal(id) { 
  // Fetch single submission details? For simplicity we use cached list or just ID
  openModal('Grade Submission', `
    <div class="form-group"><label>Score (0-100)</label><input type="number" id="grade-score" class="form-input" min="0" max="100"/></div>
    <div class="form-group"><label>Feedback</label><textarea id="grade-feedback" class="form-input" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-success" onclick="saveGrade('${id}')">Save</button></div>
  `);
}

async function saveGrade(id) { 
  const score = document.getElementById('grade-score').value;
  const feedback = document.getElementById('grade-feedback').value;
  const body = { grades: { r1: parseInt(score) }, feedback, status: 'Verified' };
  await api(`/submissions/${id}`, 'PUT', body);
  closeModal(); showToast('Saved!', 'success'); navigateTo('grade-submissions');
}

async function openManualModal() {
    const users = await api('/users');
    const assignments = await api('/assignments');
    openModal('Record In-Person', `
        <div class="form-group">
            <label>Student</label>
            <select id="manual-student" class="form-input">${(users||[]).filter(u=>u.role==='student').map(u=>`<option value="${u._id}">${u.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>Assignment</label>
            <select id="manual-assign" class="form-input">${(assignments||[]).map(a=>`<option value="${a._id}">${a.title}</option>`).join('')}</select>
        </div>
        <div class="modal-actions"><button class="btn-primary" onclick="createManual()">Create</button></div>
    `);
}

async function createManual() {
    const studentId = document.getElementById('manual-student').value;
    const assignmentId = document.getElementById('manual-assign').value;
    await api('/submissions/admin', 'POST', { studentId, assignmentId });
    closeModal();
    showToast('Recorded!', 'success');
    navigateTo('grade-submissions');
}

// ===== ATTENDANCE, QUERIES, ETC (Simplified for brevity) =====
async function renderAttendance() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="welcome-banner mb-24"><h2>Attendance</h2><p>Loading...</p></div>`; /* Similar fetch logic */ }
async function renderQueries() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Queries</h3></div>`; /* Similar fetch logic */ }
async function renderGrades() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Grades</h3></div>`; }
async function renderAttendanceAdmin() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Mark Attendance</h3></div>`; }
async function renderQueriesAdmin() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Manage Queries</h3></div>`; }

// ===== UTILITIES =====
function openModal(t, b, w) { document.getElementById('modal-title').textContent = t; document.getElementById('modal-body').innerHTML = b; document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal(e) { if(e && e.target !== document.getElementById('modal-overlay')) return; document.getElementById('modal-overlay').classList.add('hidden'); }
function showToast(m, t) { const c = document.getElementById('toast-container'); const el = document.createElement('div'); el.className = `toast ${t}`; el.innerHTML = `<span>${m}</span>`; c.appendChild(el); setTimeout(() => el.remove(), 3000); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('visible'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('visible'); }
function toggleTheme() { const isDark = document.documentElement.getAttribute('data-theme') === 'dark'; document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark'); document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️'; }
function toggleNotif() { showToast('No new notifications.', 'info'); }
function emptyStateHTML(t, d) { return `<div class="empty-state"><h3>${t}</h3></div>`; }
// Icons
function homeIcon() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`; }
function calendarIcon() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/></svg>`; }
function uploadIcon() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>`; }
function starIcon() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`; }
function checkCircleIcon() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`; }
function chatIcon() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`; }

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  selectRole('student');
  if (TOKEN) {
    try { 
      currentUser = JSON.parse(localStorage.getItem('srb_user')); 
      initApp(); 
    } catch(e) { handleLogout(); }
  }
});