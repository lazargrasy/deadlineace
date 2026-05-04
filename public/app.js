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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || `Server Error: ${res.status}`);
    return data;
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
}

// ===== STATE =====
let currentUser = localStorage.getItem('srb_user') ? JSON.parse(localStorage.getItem('srb_user')) : null;
let selectedRole = 'student';
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
  document.getElementById('auth-toggle-text').classList.toggle('hidden', register);
  document.getElementById('auth-toggle-back').classList.toggle('hidden', !register);
}

function handleAuth() {
  isRegisterMode ? handleRegister() : handleLogin();
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  
  try {
    const data = await api('/login', 'POST', { username, password, role: selectedRole });
    err.classList.add('hidden');
    localStorage.setItem('srb_token', data.token);
    localStorage.setItem('srb_user', JSON.stringify(data.user));
    currentUser = data.user;
    TOKEN = data.token;
    initApp();
  } catch (e) {
    err.textContent = e.message || 'Login failed';
    err.classList.remove('hidden');
  }
}

async function handleRegister() {
  const name = document.getElementById('login-name').value.trim();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');

  try {
    const data = await api('/register', 'POST', { name, username, password, role: selectedRole });
    localStorage.setItem('srb_token', data.token);
    localStorage.setItem('srb_user', JSON.stringify(data.user));
    currentUser = data.user;
    TOKEN = data.token;
    initApp();
  } catch (e) {
    err.textContent = e.message || 'Registration failed';
    err.classList.remove('hidden');
  }
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
    { id: 'queries-admin', label: 'Student Queries', icon: chatIcon() },
  ],
};

function buildNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = navConfig[currentUser.role].map(item => {
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
  const assignments = await api('/assignments');
  const users = currentUser.role === 'admin' ? await api('/users') : [];
  
  if (currentUser.role === 'student') {
    const subs = await api('/submissions');
    area.innerHTML = `<div class="welcome-banner mb-24"><h2>Hello, ${currentUser.name}!</h2></div><div class="grid-4 mb-24"><div class="stat-card"><div class="stat-info"><div class="stat-value">${assignments?.length || 0}</div><div class="stat-label">Total Assignments</div></div></div><div class="stat-card"><div class="stat-info"><div class="stat-value">${subs?.filter(s=>s.studentId?._id === currentUser.id).length || 0}</div><div class="stat-label">Submitted</div></div></div></div>`;
  } else {
    area.innerHTML = `<div class="welcome-banner mb-24"><h2>Welcome, ${currentUser.name}!</h2></div><div class="grid-4 mb-24"><div class="stat-card"><div class="stat-info"><div class="stat-value">${users?.filter(u=>u.role==='student').length || 0}</div><div class="stat-label">Students</div></div></div><div class="stat-card"><div class="stat-info"><div class="stat-value">${assignments?.length || 0}</div><div class="stat-label">Assignments</div></div></div></div>`;
  }
}

// ===== STUDENT: DEADLINES & VIEW =====
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
  
  let rubricHtml = '';
  if(a.rubric && a.rubric.length > 0) {
      rubricHtml = `<div class="mt-16"><h4 class="text-sm fw-bold">Grading Rubric</h4><div class="rubric-list">${a.rubric.map(r => `
          <div class="scorecard-item"><span>${r.criterion}</span><span class="text-dim">(${r.maxMarks} pts)</span></div>
      `).join('')}</div></div>`;
  }

  openModal(`${a.title}`, `
    <div class="text-muted mb-12">${a.subject}</div>
    <div class="card mb-12" style="background:var(--bg-3)">
        <p>${a.description || 'No description provided.'}</p>
    </div>
    ${a.questionFile ? `<a href="${a.questionFile}" target="_blank" class="file-attachment mt-12">📥 Download Question File</a>` : '<div class="text-dim text-xs mt-12">No attachment provided.</div>'}
    ${rubricHtml}
    <div class="modal-actions"><button class="btn-primary" onclick="closeModal();openSubmitModal('${id}')">Submit Assignment</button></div>
  `);
}

async function openSubmitModal(assignmentId) { 
  openModal('Submit Assignment', `<div class="form-group"><label>Upload Answer File (PDF, DOC, ZIP, etc.)</label><input type="file" id="file-input" class="form-input"/></div><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitAssignment('${assignmentId}')">Submit</button></div>`);
}

async function submitAssignment(assignmentId) { 
  const fileInput = document.getElementById('file-input');
  const formData = new FormData();
  formData.append('assignmentId', assignmentId);
  formData.append('method', 'online');
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
  else { showToast('Please select a file', 'error'); return; }

  const res = await api('/submissions', 'POST', formData, true);
  if (res) { closeModal(); showToast('Submitted Successfully!', 'success'); navigateTo('submissions'); }
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
      ${s.filePath ? `<a href="${s.filePath}" target="_blank" class="file-attachment mt-12">📥 ${s.fileName}</a>` : ''}
      ${s.status === 'Verified' ? `<div class="mt-12 text-sm text-green">Graded: ${s.feedback || 'No feedback'}</div>` : ''}
    </div>
  `).join('')}`;
}

// ===== ADMIN: MANAGE ASSIGNMENTS (WITH RUBRIC) =====
async function renderManageAssignments() { 
  const area = document.getElementById('content-area'); 
  const assignments = await api('/assignments');
  area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Assignments</h3><button class="btn-primary" onclick="openCreateAssignment()">+ Create</button></div>${(assignments || []).map(a => `
    <div class="card mb-12"><div style="display:flex;justify-content:space-between"><div><div class="fw-bold">${a.title}</div><div class="text-xs text-dim">${a.subject}</div></div><button class="btn-danger btn-sm" onclick="deleteAssignment('${a._id}')">Delete</button></div></div>
  `).join('')}`;
}

let rubricCounter = 0;
function openCreateAssignment() { 
  rubricCounter = 0;
  openModal('Create Assignment', `
    <div class="form-group"><label>Title</label><input class="form-input" id="ca-title"/></div>
    <div class="form-group"><label>Subject</label><input class="form-input" id="ca-subject"/></div>
    <div class="form-group"><label>Description / Text Question</label><textarea class="form-input" id="ca-desc" rows="3"></textarea></div>
    <div class="form-group"><label>Upload Question File (Optional)</label><input type="file" id="ca-file" class="form-input"/></div>
    <div class="grid-2"><input type="date" class="form-input" id="ca-due"/><select class="form-input" id="ca-priority"><option>High</option><option>Medium</option><option>Low</option></select></div>
    
    <div class="divider mt-16"></div>
    <div class="section-title text-sm mt-16 mb-12">Grading Rubric</div>
    <div id="rubric-list-container"></div>
    <button class="btn-secondary btn-sm full-width mt-8" onclick="addRubricRow()">+ Add Criterion</button>

    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="createAssignment()">Create</button></div>
  `, true); 
}

function addRubricRow() {
    const container = document.getElementById('rubric-list-container');
    const row = document.createElement('div');
    row.className = 'rubric-row';
    row.id = `rubric-${rubricCounter}`;
    row.innerHTML = `
        <input type="text" class="form-input" placeholder="Criterion (e.g. Code Quality)" data-type="crit">
        <input type="number" class="form-input" placeholder="Max Marks" data-type="max">
        <button class="btn-danger btn-sm" onclick="document.getElementById('rubric-${rubricCounter}').remove()">✕</button>
    `;
    container.appendChild(row);
    rubricCounter++;
}

async function createAssignment() { 
  const title = document.getElementById('ca-title').value.trim();
  const subject = document.getElementById('ca-subject').value.trim();
  const desc = document.getElementById('ca-desc').value.trim();
  const due = document.getElementById('ca-due').value;
  const priority = document.getElementById('ca-priority').value;
  const fileInput = document.getElementById('ca-file');

  if (!title || !subject || !due) { showToast('Fill required fields', 'error'); return; }

  // Collect Rubric
  const rubricRows = document.querySelectorAll('#rubric-list-container .rubric-row');
  const rubricData = [];
  rubricRows.forEach((row, i) => {
      const crit = row.querySelector('[data-type="crit"]').value;
      const max = row.querySelector('[data-type="max"]').value;
      if(crit && max) {
          rubricData.push({ id: `r${i}`, criterion: crit, maxMarks: parseInt(max) });
      }
  });

  const formData = new FormData();
  formData.append('title', title);
  formData.append('subject', subject);
  formData.append('description', desc);
  formData.append('dueDate', due);
  formData.append('priority', priority);
  formData.append('rubric', JSON.stringify(rubricData)); // Stringify array for backend
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

  const res = await api('/assignments', 'POST', formData, true);
  if (res) { closeModal(); showToast('Created!', 'success'); navigateTo('manage-assignments'); }
}

async function deleteAssignment(id) { 
  if(confirm('Delete this assignment?')) { 
    await api(`/assignments/${id}`, 'DELETE'); 
    showToast('Deleted', 'info'); navigateTo('manage-assignments'); 
  } 
}

// ===== ADMIN: GRADE SUBMISSIONS (WITH RUBRIC VIEW) =====
async function renderGradeSubmissions() { 
  const area = document.getElementById('content-area'); 
  const subs = await api('/submissions');
  area.innerHTML = `
    <div class="section-header mb-20">
        <h3 class="section-title">Grade Submissions</h3>
    </div>
    ${(subs || []).filter(s => s.status !== 'Verified').map(s => `
    <div class="card mb-12">
      <div style="display:flex;justify-content:space-between">
        <div>
          <div class="fw-bold">${s.studentId?.name}</div>
          <div class="text-xs text-dim">${s.assignmentId?.title} <span class="badge badge-${s.method==='online'?'blue':'purple'}">${s.method}</span></div>
        </div>
        <div>
            <button class="btn-primary btn-sm" onclick="openGradeModal('${s._id}', '${s.assignmentId?._id}')">Grade</button>
        </div>
      </div>
      ${s.filePath ? `<a href="${s.filePath}" target="_blank" class="file-attachment mt-12">📥 View Answer: ${s.fileName}</a>` : ''}
    </div>
  `).join('')}`;
}

async function openGradeModal(submissionId, assignmentId) { 
  // Fetch assignment details to get Rubric
  const assignments = await api('/assignments');
  const assignment = assignments.find(a => a._id === assignmentId);
  
  let rubricHtml = '';
  if(assignment && assignment.rubric && assignment.rubric.length > 0) {
      rubricHtml = assignment.rubric.map(r => `
          <div class="rubric-row">
              <div>
                  <div class="fw-bold">${r.criterion}</div>
                  <div class="text-xs text-dim">Max: ${r.maxMarks}</div>
              </div>
              <input type="number" class="form-input" style="width:80px" id="grade-${r.id}" placeholder="Score" max="${r.maxMarks}">
          </div>
      `).join('');
  } else {
      rubricHtml = `
          <div class="rubric-row">
              <div>Total Score</div>
              <input type="number" class="form-input" style="width:80px" id="grade-total" placeholder="Score">
          </div>`;
  }

  openModal('Grade Submission', `
    <div class="form-group">
        <label>Feedback Comments</label>
        <textarea id="grade-feedback" class="form-input" rows="3" placeholder="Optional feedback for student..."></textarea>
    </div>
    
    <div class="divider mt-16"></div>
    <div class="section-title text-sm mt-16 mb-12">Scores</div>
    ${rubricHtml}

    <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-success" onclick="saveGrade('${submissionId}', '${assignmentId}')">Verify & Save</button>
    </div>
  `);
}

async function saveGrade(submissionId, assignmentId) { 
  const feedback = document.getElementById('grade-feedback').value;
  const gradesMap = {};
  
  // Fetch assignment again to check rubric logic (simplified here)
  const assignments = await api('/assignments');
  const assignment = assignments.find(a => a._id === assignmentId);
  
  if(assignment && assignment.rubric && assignment.rubric.length > 0) {
      assignment.rubric.forEach(r => {
          const val = document.getElementById(`grade-${r.id}`).value;
          if(val) gradesMap[r.id] = parseInt(val);
      });
  } else {
      const total = document.getElementById('grade-total').value;
      if(total) gradesMap['total'] = parseInt(total);
  }

  const body = { grades: gradesMap, feedback, status: 'Verified' };
  
  await api(`/submissions/${submissionId}`, 'PUT', body);
  closeModal(); 
  showToast('Graded Successfully!', 'success'); 
  navigateTo('grade-submissions');
}

// ===== PLACEHOLDER PAGES =====
async function renderAttendance() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="welcome-banner mb-24"><h2>Attendance</h2><p>Feature coming soon.</p></div>`; }
async function renderQueries() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Queries</h3></div><p>Feature coming soon.</p>`; }
async function renderGrades() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Grades</h3></div><p>Feature coming soon.</p>`; }
async function renderAttendanceAdmin() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Mark Attendance</h3></div><p>Feature coming soon.</p>`; }
async function renderQueriesAdmin() { const area = document.getElementById('content-area'); area.innerHTML = `<div class="section-header mb-20"><h3 class="section-title">Manage Queries</h3></div><p>Feature coming soon.</p>`; }

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
