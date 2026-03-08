// ── API Configuration ──
const API_URL = 'http://localhost:3000/api';
let students = [];

// ── Load Data from API ──
async function loadStudents() {
    try {
        const response = await fetch(`${API_URL}/students`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        students = await response.json();
    } catch (error) {
        console.error('Error loading students from API:', error);
    }
}

// ── Helpers ──
const COLORS = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    '#22c55e', '#3b82f6', '#a855f7', '#e11d48', '#0ea5e9'
];

// Track Chart.js instances so we can destroy them before re-creating
const CHARTS = {};

function count(arr, key) {
    return arr.reduce((acc, v) => { acc[v[key]] = (acc[v[key]] || 0) + 1; return acc; }, {});
}

function avg(arr) {
    // convert any string values to numbers (MySQL may return decimals as strings)
    const nums = arr.map(v => {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    });
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function gpaColor(gpa) {
    if (gpa >= 3.7) return 'badge-green';
    if (gpa >= 3.3) return 'badge-blue';
    if (gpa >= 3.0) return 'badge-amber';
    return 'badge-red';
}

function statusBadge(s) { return s === 'Graduated' ? 'badge-green' : 'badge-blue'; }

function initials(name) { return name.split(' ').map(n => n[0]).join('').toUpperCase(); }

// ── Document Helpers ──
function getDocIcon(type) {
    const icons = {
        'Resume': 'badge-blue',
        'Certificate': 'badge-green',
        'Diploma': 'badge-purple',
        'Transcript': 'badge-amber',
        'Portfolio': 'badge-cyan'
    };
    return icons[type] || 'badge-gray';
}

function downloadDocument(filePath) {
    // Create a link element and click it to trigger download
    const link = document.createElement('a');
    link.href = filePath;
    link.download = filePath.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function deleteDocument(docId, studentId) {
    if (!confirm('Delete this document? This action cannot be undone.')) return;
    try {
        const res = await fetch(`${API_URL}/documents/${docId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        await loadStudents();
        openModal(studentId);
    } catch (err) {
        console.error('Failed to delete document:', err);
        alert('Failed to delete document');
    }
}

function openUploadDocumentForm(studentId) {
    const types = ['Resume', 'Certificate', 'Diploma', 'Transcript', 'Portfolio', 'Other'];
    document.getElementById('modal-body').innerHTML = `
<form id="upload-document-form">
<div class="form-row">
<label>Document Type</label>
<select name="document_type">
${types.map(t => `<option>${t}</option>`).join('')}
</select>
</div>
<div class="form-row">
<label>Choose File</label>
<input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.zip" required/>
<small style="color:var(--text-muted);font-size:0.75rem;">Supported: PDF, Word, Excel, Images, ZIP (Max 50MB)</small>
</div>
<div style="margin-top:14px;display:flex;gap:8px;">
<button type="button" onclick="submitUploadDocument('${studentId}')" class="btn btn-primary">Upload</button>
<button type="button" onclick="openModal('${studentId}')" class="btn">Cancel</button>
</div>
</form>
`;
}

async function submitUploadDocument(studentId) {
    const form = document.getElementById('upload-document-form');
    if (!form) return;
    
    const fileInput = form.querySelector('input[name="file"]');
    if (!fileInput.files.length) {
        alert('Please select a file to upload');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('student_id', studentId);
    formData.append('document_type', form.querySelector('select[name="document_type"]').value);

    try {
        const res = await fetch(`${API_URL}/documents`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Upload failed');
        }
        await loadStudents();
        openModal(studentId);
    } catch (err) {
        console.error('Failed to upload document:', err);
        alert('Failed to upload document: ' + err.message);
    }
}

// ── Tab Switching ──
function switchTab(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    event.target.classList.add('active');
    window.scrollTo(0, 0);
}

// ── Overview KPIs ──
function buildKPIs() {
    const totalStudents = students.length;
    const gpas = students.map(s => s.academic_records.gpa);
    const avgGpa = avg(gpas).toFixed(2);
    const majors = [...new Set(students.map(s => s.academic_records.major))].length;
    const unis = [...new Set(students.map(s => s.academic_records.university))].length;
    const withExp = students.filter(s => s.work_experience.length > 0).length;

    document.getElementById('hdr-total').textContent = totalStudents;
    document.getElementById('hdr-avg-gpa').textContent = avgGpa;
    document.getElementById('hdr-majors').textContent = majors;
    document.getElementById('hdr-universities').textContent = unis;
    document.getElementById('hdr-with-exp').textContent = withExp;

    const kpis = [
        { icon: '&#128101;', cls: 'blue', val: students.length, lbl: 'Total Students' },
        { icon: '&#127891;', cls: 'purple', val: avgGpa, lbl: 'Average GPA' },
        { icon: '&#128188;', cls: 'green', val: withExp, lbl: 'Have Work Experience' },
        { icon: '&#127760;', cls: 'amber', val: students.filter(s => s.english_scores.level === 'Advanced').length, lbl: 'Advanced English Level' }
    ];

    const row = document.getElementById('kpi-row');
    row.innerHTML = kpis.map(k => `
<div class="kpi-card">
<div class="kpi-icon ${k.cls}">${k.icon}</div>
<div>
<div class="kpi-val">${k.val}</div>
<div class="kpi-lbl">${k.lbl}</div>
</div>
</div>
`).join('');
}

// ── Charts ──
function makeChart(id, type, labels, data, opts = {}) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const colors = opts.colors || COLORS;
    const cfg = {
        type,
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: type === 'line' ? 'rgba(79,70,229,0.12)' : colors.slice(0, labels.length),
                borderColor: type === 'line' ? '#4f46e5' : (type === 'bar' ? colors.slice(0, labels.length) : undefined),
                borderWidth: type === 'line' ? 2.5 : 1.5,
                fill: type === 'line',
                tension: 0.4,
                pointBackgroundColor: '#4f46e5',
                pointRadius: 4,
                borderRadius: type === 'bar' ? 6 : 0,
                ...(opts.datasetExtra || {})
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: opts.legend !== undefined ? opts.legend : (type === 'doughnut' || type === 'pie') },
                tooltip: { callbacks: opts.tooltipCb || {} }
            },
            scales: (type === 'bar' || type === 'line') ? {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35 } }
            } : {},
            ...(opts.extra || {})
        }
    };
    // if a chart instance already exists for this canvas id, destroy it first
    try {
        if (CHARTS[id]) {
            CHARTS[id].destroy();
            delete CHARTS[id];
        }
    } catch (e) {
        console.warn('Error destroying previous chart', e);
    }
    CHARTS[id] = new Chart(ctx, cfg);
}

function buildOverviewCharts() {
    // Major
    const majorCounts = count(students.map(s => ({ major: s.academic_records.major })), 'major');
    makeChart('chart-major', 'bar', Object.keys(majorCounts), Object.values(majorCounts));

    // University
    const uniCounts = count(students.map(s => ({ university: s.academic_records.university })), 'university');
    makeChart('chart-uni', 'doughnut', Object.keys(uniCounts), Object.values(uniCounts));

    // GPA Distribution
    const gpaBuckets = { '2.5-2.9': 0, '3.0-3.2': 0, '3.3-3.5': 0, '3.6-3.8': 0, '3.9-4.0': 0 };
    students.forEach(s => {
        const g = s.academic_records.gpa;
        if (g < 3.0) gpaBuckets['2.5-2.9']++;
        else if (g < 3.3) gpaBuckets['3.0-3.2']++;
        else if (g < 3.6) gpaBuckets['3.3-3.5']++;
        else if (g < 3.9) gpaBuckets['3.6-3.8']++;
        else gpaBuckets['3.9-4.0']++;
    });
    makeChart('chart-gpa-dist', 'bar', Object.keys(gpaBuckets), Object.values(gpaBuckets), {
        colors: ['#ef4444', '#f59e0b', '#06b6d4', '#4f46e5', '#10b981']
    });

    // English Test
    const testCounts = {};
    students.forEach(s => { const t = s.english_scores.test; testCounts[t] = (testCounts[t] || 0) + 1; });
    makeChart('chart-eng-test', 'pie', Object.keys(testCounts), Object.values(testCounts));

    // Enrollment Status
    const statusCounts = {};
    students.forEach(s => { const st = s.academic_records.enrollment_status; statusCounts[st] = (statusCounts[st] || 0) + 1; });
    makeChart('chart-status', 'doughnut', Object.keys(statusCounts), Object.values(statusCounts), {
        colors: ['#10b981', '#4f46e5']
    });

    // Work Experience Count
    const weCounts = { '0 jobs': 0, '1 job': 0, '2 jobs': 0, '3 jobs': 0 };
    students.forEach(s => {
        const n = s.work_experience.length;
        if (n === 0) weCounts['0 jobs']++;
        else if (n === 1) weCounts['1 job']++;
        else if (n === 2) weCounts['2 jobs']++;
        else weCounts['3 jobs']++;
    });
    makeChart('chart-work-count', 'bar', Object.keys(weCounts), Object.values(weCounts), {
        colors: ['#94a3b8', '#06b6d4', '#4f46e5', '#10b981']
    });
}

function buildAcademicsCharts() {
    // GPA by Major
    const majorGpa = {};
    students.forEach(s => {
        const m = s.academic_records.major;
        if (!majorGpa[m]) majorGpa[m] = [];
        majorGpa[m].push(s.academic_records.gpa);
    });
    const majLabels = Object.keys(majorGpa);
    const majAvg = majLabels.map(m => parseFloat(avg(majorGpa[m]).toFixed(2)));
    // majAvg now contains numeric values, since toFixed returns a string and charts expect numbers
    makeChart('chart-gpa-major', 'bar', majLabels, majAvg, {
        colors: COLORS,
        extra: { scales: { y: { min: 2.0, max: 4.0, grid: { color: '#f1f5f9' } }, x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35 } } } }
    });

    // Degree Types
    const degCounts = {};
    students.forEach(s => { const d = s.academic_records.degree; degCounts[d] = (degCounts[d] || 0) + 1; });
    makeChart('chart-degree', 'doughnut', Object.keys(degCounts), Object.values(degCounts), {
        colors: ['#4f46e5', '#06b6d4', '#10b981']
    });

    // Honors
    const honorCounts = {};
    let noHonorCount = 0;
    students.forEach(s => {
        const honors = s.academic_records.honors || [];
        if (honors.length === 0) {
            noHonorCount++;
        } else {
            honors.forEach(h => {
                honorCounts[h] = (honorCounts[h] || 0) + 1;
            });
        }
    });
    if (noHonorCount > 0) {
        honorCounts['None'] = noHonorCount;
    }
    // if honorCounts still empty just show placeholder
    if (Object.keys(honorCounts).length === 0) {
        honorCounts['No Honors Data'] = 1;
    }
    makeChart('chart-honors', 'bar', Object.keys(honorCounts), Object.values(honorCounts), {
        colors: ['#f59e0b', '#4f46e5', '#10b981', '#ef4444', '#06b6d4']
    });

    // Credits Distribution
    const creditBuckets = { '90-99': 0, '100-109': 0, '110-119': 0, '120-129': 0, '130-139': 0, '140+': 0 };
    students.forEach(s => {
        const c = s.academic_records.credits_completed;
        if (c < 100) creditBuckets['90-99']++;
        else if (c < 110) creditBuckets['100-109']++;
        else if (c < 120) creditBuckets['110-119']++;
        else if (c < 130) creditBuckets['120-129']++;
        else if (c < 140) creditBuckets['130-139']++;
        else creditBuckets['140+']++;
    });
    makeChart('chart-credits', 'bar', Object.keys(creditBuckets), Object.values(creditBuckets), {
        colors: ['#818cf8', '#6366f1', '#4f46e5', '#3730a3', '#312e81', '#1e1b4b']
    });

    // Academic Table
    const tbody = document.getElementById('academic-tbody');
    tbody.innerHTML = students.map(s => {
        const ar = s.academic_records;
        return `<tr>
<td><span class="badge badge-gray">${s.student_id}</span></td>
<td><strong>${s.basic_info.full_name}</strong></td>
<td>${ar.university}</td>
<td>${ar.major}</td>
<td>${ar.degree}</td>
<td><span class="badge ${gpaColor(ar.gpa)}">${ar.gpa}</span></td>
<td>${ar.credits_completed}</td>
<td>${ar.graduation_year}</td>
<td><span class="badge ${statusBadge(ar.enrollment_status)}">${ar.enrollment_status}</span></td>
</tr>`;
    }).join('');
}

function buildEnglishCharts() {
    // Score by test type (box-like bar)
    const testGroups = {};
    students.forEach(s => {
        const t = s.english_scores.test;
        if (!testGroups[t]) testGroups[t] = [];
        testGroups[t].push(s.english_scores.score);
    });

    // Normalize scores to 0-100 for comparison
    const normalize = (test, score) => {
        if (test === 'TOEFL') return (score / 120) * 100;
        if (test === 'IELTS') return (score / 9) * 100;
        return (score / 160) * 100;
    };

    const testLabels = Object.keys(testGroups);
    const testAvgNorm = testLabels.map(t => avg(testGroups[t].map(s => normalize(t, s))).toFixed(1));
    makeChart('chart-eng-scores', 'bar', testLabels, testAvgNorm, {
        colors: ['#4f46e5', '#06b6d4', '#10b981'],
        extra: { scales: { y: { min: 0, max: 100, grid: { color: '#f1f5f9' }, title: { display: true, text: 'Normalized Score (%)' } }, x: { grid: { display: false } } } },
        tooltipCb: { label: ctx => `Avg Normalized: ${ ctx.raw } %` }
    });

    // Proficiency Levels
    const levelCounts = {};
    students.forEach(s => { const l = s.english_scores.level; levelCounts[l] = (levelCounts[l] || 0) + 1; });
    makeChart('chart-eng-level', 'doughnut', Object.keys(levelCounts), Object.values(levelCounts), {
        colors: ['#10b981', '#4f46e5', '#f59e0b']
    });

    // Score vs GPA scatter
    const scatterData = students.map(s => ({
        x: s.academic_records.gpa,
        y: normalize(s.english_scores.test, s.english_scores.score)
    }));
    const ctx = document.getElementById('chart-eng-gpa');
    if (ctx) {
        const cfg = {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Students',
                    data: scatterData,
                    backgroundColor: 'rgba(79,70,229,0.6)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `GPA: ${ ctx.raw.x }, Eng: ${ ctx.raw.y.toFixed(1) } %` } }
                },
                scales: {
                    x: { title: { display: true, text: 'GPA' }, min: 2.4, max: 4.1, grid: { color: '#f1f5f9' } },
                    y: { title: { display: true, text: 'Normalized English Score (%)' }, min: 0, max: 100, grid: { color: '#f1f5f9' } }
                }
            }
        };
        try {
            if (CHARTS['chart-eng-gpa']) { CHARTS['chart-eng-gpa'].destroy(); delete CHARTS['chart-eng-gpa']; }
        } catch (e) { console.warn('Error destroying previous scatter chart', e); }
        CHARTS['chart-eng-gpa'] = new Chart(ctx, cfg);
    }

    // English Table
    const tbody = document.getElementById('english-tbody');
    tbody.innerHTML = students.map(s => {
        const e = s.english_scores;
        const lvlBadge = e.level === 'Advanced' ? 'badge-green' : (e.level === 'Upper-Intermediate' ? 'badge-blue' : 'badge-amber');
        return `<tr>
<td><span class="badge badge-gray">${s.student_id}</span></td>
<td><strong>${s.basic_info.full_name}</strong></td>
<td><span class="badge badge-purple">${e.test}</span></td>
<td><strong>${e.score}</strong></td>
<td><span class="badge ${lvlBadge}">${e.level}</span></td>
<td>${e.date_taken}</td>
<td>${s.academic_records.major}</td>
</tr>`;
    }).join('');
}

function buildWorkCharts() {
    const allExp = [];
    students.forEach(s => s.work_experience.forEach(w => allExp.push({ ...w, student: s })));

    // Top Employers
    const empCounts = {};
    allExp.forEach(w => { empCounts[w.company] = (empCounts[w.company] || 0) + 1; });
    const empSorted = Object.entries(empCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    makeChart('chart-employers', 'bar', empSorted.map(e => e[0]), empSorted.map(e => e[1]), { colors: COLORS });

    // Top Titles
    const titleCounts = {};
    allExp.forEach(w => { titleCounts[w.title] = (titleCounts[w.title] || 0) + 1; });
    const titleSorted = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    makeChart('chart-titles', 'bar', titleSorted.map(e => e[0]), titleSorted.map(e => e[1]), {
        colors: COLORS.slice(5)
    });

    // Work Table
    const tbody = document.getElementById('work-tbody');
    if (allExp.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No work experience records found.</td></tr>';
        return;
    }
    tbody.innerHTML = allExp.map(w => `<tr>
<td><span class="badge badge-gray">${w.student.student_id}</span></td>
<td><strong>${w.student.basic_info.full_name}</strong></td>
<td>${w.company}</td>
<td>${w.title}</td>
<td>${w.start_date}</td>
<td>${w.end_date}</td>
<td><span class="badge badge-blue">${w.duration_months} mo</span></td>
</tr>`).join('');
}

// ── Student Cards ──
let filteredStudents = [...students];

function buildStudentGrid(list) {
    const grid = document.getElementById('student-grid');
    document.getElementById('student-count').textContent = `${ list.length } student${ list.length !== 1 ? 's' : '' }`;
    if (list.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px;">No students match your search.</p>';
        return;
    }
    grid.innerHTML = list.map(s => {
        const ar = s.academic_records;
        const gpaFill = ((ar.gpa - 2.0) / 2.0 * 100).toFixed(0);
        const expCount = s.work_experience.length;
        return `
<div class="student-card" onclick="openModal('${s.student_id}')">
<div class="student-card-header">
<div class="student-avatar">${initials(s.basic_info.full_name)}</div>
<h3>${s.basic_info.full_name}</h3>
<p>${s.student_id} &bull; ${ar.major}</p>
</div>
<div class="student-card-body">
<div class="student-meta">
<div class="student-meta-row">
<span class="lbl">University</span>
<span class="val" style="font-size:0.78rem;text-align:right;max-width:140px;">${ar.university}</span>
</div>
<div class="student-meta-row">
<span class="lbl">GPA</span>
<span class="val"><span class="badge ${gpaColor(ar.gpa)}">${ar.gpa}</span></span>
</div>
<div class="gpa-bar"><div class="gpa-fill" style="width:${gpaFill}%"></div></div>
<div class="student-meta-row" style="margin-top:4px;">
<span class="lbl">Status</span>
<span class="badge ${statusBadge(ar.enrollment_status)}" style="font-size:0.72rem;">${ar.enrollment_status}</span>
</div>
<div class="student-meta-row">
<span class="lbl">English</span>
<span class="val">${s.english_scores.test} ${s.english_scores.score}</span>
</div>
<div class="student-meta-row">
<span class="lbl">Work Exp</span>
<span class="val">${expCount} position${expCount !== 1 ? 's' : ''}</span>
</div>
</div>
</div>
</div>`;
    }).join('');
}

function filterStudents() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const major = document.getElementById('filter-major').value;
    const status = document.getElementById('filter-status').value;
    filteredStudents = students.filter(s => {
        const matchQ = !q || s.basic_info.full_name.toLowerCase().includes(q)
            || s.academic_records.major.toLowerCase().includes(q)
            || s.academic_records.university.toLowerCase().includes(q)
            || s.student_id.toLowerCase().includes(q);
        const matchMajor = !major || s.academic_records.major === major;
        const matchStatus = !status || s.academic_records.enrollment_status === status;
        return matchQ && matchMajor && matchStatus;
    });
    buildStudentGrid(filteredStudents);
}

function populateMajorFilter() {
    const majors = [...new Set(students.map(s => s.academic_records.major))].sort();
    const sel = document.getElementById('filter-major');
    majors.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o); });
}

// ── Modal ──
function openModal(id) {
    const s = students.find(st => st.student_id === id);
    if (!s) return;
    const ar = s.academic_records;
    const bi = s.basic_info;
    const en = s.english_scores;

    document.getElementById('modal-name').textContent = bi.full_name;
    document.getElementById('modal-sub').textContent = `${ s.student_id } · ${ ar.major } · ${ ar.university }`;

    const lvlBadge = en.level === 'Advanced' ? 'badge-green' : (en.level === 'Upper-Intermediate' ? 'badge-blue' : 'badge-amber');

    document.getElementById('modal-body').innerHTML = `
<div class="modal-section">
<h3>Basic Information</h3>
<div class="info-grid">
<div class="info-item"><div class="lbl">Full Name</div><div class="val">${bi.full_name}</div></div>
<div class="info-item"><div class="lbl">Date of Birth</div><div class="val">${bi.date_of_birth}</div></div>
<div class="info-item"><div class="lbl">Gender</div><div class="val">${bi.gender}</div></div>
<div class="info-item"><div class="lbl">Nationality</div><div class="val">${bi.nationality}</div></div>
<div class="info-item"><div class="lbl">Email</div><div class="val">${bi.email}</div></div>
<div class="info-item"><div class="lbl">Phone</div><div class="val">${bi.phone}</div></div>
<div class="info-item" style="grid-column:1/-1"><div class="lbl">Address</div><div class="val">${bi.address}</div></div>
</div>
</div>

<div class="modal-section">
<h3>Academic Records</h3>
<div class="info-grid">
<div class="info-item"><div class="lbl">University</div><div class="val">${ar.university}</div></div>
<div class="info-item"><div class="lbl">Major</div><div class="val">${ar.major}</div></div>
<div class="info-item"><div class="lbl">Minor</div><div class="val">${ar.minor || 'None'}</div></div>
<div class="info-item"><div class="lbl">Degree</div><div class="val">${ar.degree}</div></div>
<div class="info-item"><div class="lbl">GPA</div><div class="val"><span class="badge ${gpaColor(ar.gpa)}">${ar.gpa} / 4.0</span></div></div>
<div class="info-item"><div class="lbl">Credits</div><div class="val">${ar.credits_completed}</div></div>
<div class="info-item"><div class="lbl">Graduation Year</div><div class="val">${ar.graduation_year}</div></div>
<div class="info-item"><div class="lbl">Status</div><div class="val"><span class="badge ${statusBadge(ar.enrollment_status)}">${ar.enrollment_status}</span></div></div>
</div>
<div style="margin-top:14px;">
<div class="lbl" style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">Courses</div>
<div class="course-tags">${ar.courses.map(c => `<span class="course-tag">${c}</span>`).join('')}</div>
</div>
${ar.honors.length > 0 ? `
<div style="margin-top:12px;">
<div class="lbl" style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">Honors &amp; Awards</div>
<div class="course-tags">${ar.honors.map(h => `<span class="honor-tag">&#127775; ${h}</span>`).join('')}</div>
</div>` : ''}
</div>

<div class="modal-section">
<h3>English Proficiency</h3>
<div class="english-score-box">
<div class="english-score-big">${en.score}</div>
<div class="english-score-info">
<div class="test">${en.test}</div>
<div class="level"><span class="badge ${lvlBadge}">${en.level}</span></div>
<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Taken: ${en.date_taken}</div>
</div>
</div>
</div>

<div class="modal-section">
<h3>Work Experience (${s.work_experience.length} position${s.work_experience.length !== 1 ? 's' : ''})</h3>
${s.work_experience.length === 0
                    ? '<p style="color:var(--text-muted);font-size:0.88rem;">No work experience recorded.</p>'
                    : s.work_experience.map(w => `
<div class="work-item">
<h4>${w.title}</h4>
<p><strong>${w.company}</strong> &bull; ${w.start_date} to ${w.end_date} &bull; <span class="badge badge-blue">${w.duration_months} months</span></p>
<p style="margin-top:6px;font-size:0.82rem;">${w.description}</p>
</div>`).join('')
                }
</div>

<div class="modal-section">
<h3>📄 Documents (${s.documents.length} document${s.documents.length !== 1 ? 's' : ''})</h3>
${s.documents.length === 0
                    ? '<p style="color:var(--text-muted);font-size:0.88rem;">No documents uploaded yet.</p>'
                    : `<div class="documents-list">
${s.documents.map(d => `
<div class="document-item">
<div class="doc-icon ${getDocIcon(d.document_type)}">
<span class="doc-type-badge">${d.document_type}</span>
</div>
<div class="doc-info">
<h4>${d.document_name}</h4>
<p style="font-size:0.78rem;color:var(--text-muted);">Uploaded: ${d.upload_date}</p>
</div>
<div class="doc-actions">
<button class="doc-btn-view" title="Download" onclick="downloadDocument('${d.file_path}')">⬇</button>
<button class="doc-btn-delete" title="Delete" onclick="deleteDocument(${d.id}, '${id}')">🗑</button>
</div>
</div>
`).join('')}
</div>
<div style="margin-top:14px;">
<button class="btn btn-secondary btn-small" onclick="openUploadDocumentForm('${id}')">+ Add Document</button>
</div>`
                }
</div>
`;

    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Store current student id on modal for action handlers
    const modal = document.getElementById('modal');
    modal.dataset.studentId = id;
    // Show edit/delete buttons and attach handlers
    const editBtn = document.getElementById('modal-edit-btn');
    const delBtn = document.getElementById('modal-delete-btn');
    if (editBtn && delBtn) {
        editBtn.style.display = '';
        delBtn.style.display = '';
        editBtn.onclick = () => showEditForm(id);
        delBtn.onclick = () => deleteStudent(id);
    }
}

function closeModal(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModalDirect();
}
function closeModalDirect() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
    // hide edit/delete buttons when closing
    const editBtn = document.getElementById('modal-edit-btn');
    const delBtn = document.getElementById('modal-delete-btn');
    if (editBtn) editBtn.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModalDirect(); });

// ── Init ──
window.addEventListener('DOMContentLoaded', async () => {
    await loadStudents();
    if (students.length === 0) {
        console.warn('No students loaded from API. Make sure the backend is running.');
        return;
    }
    buildKPIs();
    buildOverviewCharts();
    buildAcademicsCharts();
    buildEnglishCharts();
    buildWorkCharts();
    populateMajorFilter();
    buildStudentGrid(students);
});

// ── Edit / Delete Handlers ──
async function deleteStudent(id) {
    if (!confirm('Delete this student? This action cannot be undone.')) return;
    try {
        const res = await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        await loadStudents();
        buildKPIs(); buildOverviewCharts(); buildAcademicsCharts(); buildEnglishCharts(); buildWorkCharts(); populateMajorFilter(); buildStudentGrid(students);
        closeModalDirect();
        window.scrollTo(0, 0);
    } catch (err) {
        console.error('Failed to delete student:', err);
        alert('Failed to delete student');
        window.scrollTo(0, 0);
    }
}

function showEditForm(id) {
    const s = students.find(st => st.student_id === id);
    if (!s) return;
    const ar = s.academic_records;
    const bi = s.basic_info;

    document.getElementById('modal-name').textContent = 'Edit: ' + bi.full_name;
    document.getElementById('modal-sub').textContent = `${ s.student_id } · Edit mode`;

    document.getElementById('modal-body').innerHTML = `
<form id="edit-student-form">
<div class="form-row"><label>Full Name</label><input name="full_name" value="${bi.full_name}" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Email</label><input name="email" value="${bi.email}" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Phone</label><input name="phone" value="${bi.phone}" required/><span class="error-text">Required</span></div>

<!-- academic fields grouped -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">🎓 Academic Records</h3>
<div class="form-row"><label>University</label><input name="university" value="${ar.university}"/></div>
<div class="form-row"><label>Major</label><input name="major" value="${ar.major}"/></div>
<div class="form-row"><label>Minor</label><input name="minor" value="${ar.minor || ''}"/></div>
<div class="form-row"><label>Degree</label><input name="degree" value="${ar.degree || ''}"/></div>
<div class="form-row"><label>GPA</label><input name="gpa" type="number" step="0.01" min="0" max="4" value="${ar.gpa}"/></div>
<div class="form-row"><label>Status</label><select name="enrollment_status"><option${ar.enrollment_status==='Enrolled'?' selected':''}>Enrolled</option><option${ar.enrollment_status==='Graduated'?' selected':''}>Graduated</option></select></div>
<div class="form-row"><label>Credits Completed</label><input type="number" name="credits_completed" min="0" value="${ar.credits_completed || ''}"/></div>
<div class="form-row"><label>Graduation Year</label><input type="number" name="graduation_year" min="1900" max="2100" value="${ar.graduation_year || ''}"/></div>
</div>

<!-- english scores optional -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">🌐 English Scores (Optional)</h3>
<div class="form-row"><label>Test</label><select name="english_test"><option value=""></option><option${s.english_scores.test==='TOEFL'?' selected':''}>TOEFL</option><option${s.english_scores.test==='IELTS'?' selected':''}>IELTS</option><option${s.english_scores.test==='PTE'?' selected':''}>PTE</option></select></div>
<div class="form-row"><label>Score</label><input type="number" name="english_score" min="0" value="${s.english_scores.score || ''}"/></div>
<div class="form-row"><label>Level</label><select name="english_level"><option value=""></option><option${s.english_scores.level==='Beginner'?' selected':''}>Beginner</option><option${s.english_scores.level==='Intermediate'?' selected':''}>Intermediate</option><option${s.english_scores.level==='Upper-Intermediate'?' selected':''}>Upper-Intermediate</option><option${s.english_scores.level==='Advanced'?' selected':''}>Advanced</option></select></div>
<div class="form-row"><label>Date Taken</label><input type="date" name="english_date" value="${s.english_scores.date_taken || ''}"/></div>
</div>

<!-- work experience optional: show first record if exists -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">💼 Work Experience (Optional)</h3>
<div id="work-experience-container"></div>
<button type="button" class="btn" style="margin-top:8px;" onclick="addWorkExperienceRow()">+ Add Job</button>
</div>

<!-- courses optional -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">📘 Courses (Optional)</h3>
<div class="form-row"><label>Courses (comma separated)</label><textarea name="courses" rows="2" style="width:100%;">${ar.courses ? ar.courses.join(', ') : ''}</textarea></div>
</div>

<div style="margin-top:12px;display:flex;gap:8px;">
<button type="button" onclick="submitEditForm('${id}')" class="btn btn-primary">Save</button>
<button type="button" onclick="cancelEdit()" class="btn">Cancel</button>
</div>
</form>
`;

    // populate work experience entries if any
    if (s.work_experience && s.work_experience.length) {
        const container = document.getElementById('work-experience-container');
        s.work_experience.forEach(job => {
            addWorkExperienceRow();
            const last = container.lastElementChild;
            if (!last) return;
            const set = (name, value) => { const el = last.querySelector(`[name="${name}"]`); if (el) el.value = value || ''; };
            set('work_company', job.company);
            set('work_title', job.title);
            set('work_start_date', job.start_date);
            set('work_end_date', job.end_date);
            set('work_duration_months', job.duration_months);
            set('work_description', job.description);
        });
    }
}

function cancelEdit() {
    const id = document.getElementById('modal').dataset.studentId;
    if (id) openModal(id);
}

async function submitEditForm(id) {
    const form = document.getElementById('edit-student-form');
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    // Normalize numeric fields
    if (data.gpa) data.gpa = parseFloat(data.gpa);

    // convert english fields if present (names may vary)
    if (data.english_test) data.test = data.english_test;
    if (data.english_score) data.score = data.english_score;
    if (data.english_level) data.level = data.english_level;
    if (data.english_date) data.date_taken = data.english_date;

    // courses textarea
    if (data.courses) {
        // keep as string; server will parse comma list
    }

    // collect work experience rows
    const workEntries = [];
    document.querySelectorAll('#work-experience-container .work-entry').forEach(ent => {
        const job = {
            company: ent.querySelector('[name="work_company"]').value,
            title: ent.querySelector('[name="work_title"]').value,
            start_date: ent.querySelector('[name="work_start_date"]').value,
            end_date: ent.querySelector('[name="work_end_date"]').value,
            duration_months: ent.querySelector('[name="work_duration_months"]').value,
            description: ent.querySelector('[name="work_description"]').value
        };
        if (Object.values(job).some(v => v && v.toString().trim() !== '')) {
            workEntries.push(job);
        }
    });
    if (workEntries.length) {
        data.work_experience = JSON.stringify(workEntries);
    }

    try {
        const res = await fetch(`${API_URL}/students/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Update failed');
        await loadStudents();
        buildKPIs(); buildOverviewCharts(); buildAcademicsCharts(); buildEnglishCharts(); buildWorkCharts(); populateMajorFilter(); buildStudentGrid(students);
        openModal(id);
        window.scrollTo(0, 0);
    } catch (err) {
        console.error('Failed to update student:', err);
        alert('Failed to update student');
        window.scrollTo(0, 0);
    }
}

// ── Add New Student ──
function openAddStudentModal() {
    document.getElementById('modal-name').textContent = 'Add New Student';
    document.getElementById('modal-sub').textContent = 'Fill in the required information';
    
    document.getElementById('modal-body').innerHTML = `
<form id="add-student-form">
<div id="form-error" class="form-error" style="display:none;"></div>
<div class="form-row"><label>First Name</label><input name="first_name" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Last Name</label><input name="last_name" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Email</label><input type="email" name="email" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Phone</label><input name="phone" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Date of Birth</label><input type="date" name="date_of_birth" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Gender</label><select name="gender" required><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option></select><span class="error-text">Required</span></div>
<div class="form-row"><label>Nationality</label><input name="nationality" required/><span class="error-text">Required</span></div>
<div class="form-row"><label>Address</label><input name="address" required/><span class="error-text">Required</span></div>

<!-- academic fields moved into dedicated section -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">🎓 Academic Records</h3>
<div class="form-row"><label>University</label><input name="university"/></div>
<div class="form-row"><label>Major</label><input name="major"/></div>
<div class="form-row"><label>Minor</label><input name="minor"/></div>
<div class="form-row"><label>Degree</label><input name="degree" placeholder="e.g. Bachelor of Science"/></div>
<div class="form-row"><label>GPA</label><input type="number" step="0.01" min="0" max="4" name="gpa"/></div>
<div class="form-row"><label>Status</label><select name="enrollment_status">
<option value="Enrolled">Enrolled</option><option value="Graduated">Graduated</option></select></div>
<div class="form-row"><label>Credits Completed</label><input type="number" name="credits_completed" min="0"/></div>
<div class="form-row"><label>Graduation Year</label><input type="number" name="graduation_year" min="1900" max="2100"/></div>
</div>

<!-- english scores optional -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">🌐 English Scores (Optional)</h3>
<div class="form-row"><label>Test</label><select name="english_test"><option value="">Select...</option><option>TOEFL</option><option>IELTS</option><option>PTE</option></select></div>
<div class="form-row"><label>Score</label><input type="number" name="english_score" min="0"/></div>
<div class="form-row"><label>Level</label><select name="english_level"><option value="">Select...</option><option>Beginner</option><option>Intermediate</option><option>Upper-Intermediate</option><option>Advanced</option></select></div>
<div class="form-row"><label>Date Taken</label><input type="date" name="english_date"/></div>
</div>

<!-- work experience optional -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">💼 Work Experience (Optional)</h3>
<div id="work-experience-container"></div>
<button type="button" class="btn" style="margin-top:8px;" onclick="addWorkExperienceRow()">+ Add Job</button>
</div>

<!-- courses optional -->
<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">📘 Courses (Optional)</h3>
<div class="form-row"><label>Courses (comma separated)</label><textarea name="courses" rows="2" style="width:100%;"></textarea></div>
</div>

<div class="modal-section" style="margin-top:20px;">
<h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #ede9fe;">📄 Documents (Optional)</h3>
<div class="form-row">
<label>Resume</label>
<input type="file" name="resume" accept=".pdf,.doc,.docx,.txt"/>
<small style="color:var(--text-muted);font-size:0.75rem;">PDF, Word, or Text files only</small>
</div>
<div class="form-row">
<label>Certificate</label>
<input type="file" name="certificate" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"/>
<small style="color:var(--text-muted);font-size:0.75rem;">PDF, Word, or Image files</small>
</div>
<div class="form-row">
<label>Diploma</label>
<input type="file" name="diploma" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"/>
<small style="color:var(--text-muted);font-size:0.75rem;">PDF, Word, or Image files</small>
</div>
<div class="form-row">
<label>Portfolio</label>
<input type="file" name="portfolio" accept=".pdf,.doc,.docx,.zip,.rar"/>
<small style="color:var(--text-muted);font-size:0.75rem;">PDF, Word, or Archive files</small>
</div>
</div>

<div style="margin-top:12px;display:flex;gap:8px;">
<button type="button" onclick="submitAddStudentForm()" class="btn btn-primary">Create Student</button>
<button type="button" onclick="closeModalDirect()" class="btn">Cancel</button>
</div>
</form>
`;
    
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal').dataset.studentId = '';
    // Hide edit/delete buttons for add form
    const editBtn = document.getElementById('modal-edit-btn');
    const delBtn = document.getElementById('modal-delete-btn');
    if (editBtn) editBtn.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
}

function highlightFields(fields) {
    fields.forEach(f => {
        const el = document.querySelector(`[name="${f}"]`);
        if (el) {
            el.classList.add('input-error');
            const msg = el.parentElement.querySelector('.error-text');
            if (msg) msg.style.display = 'block';
        }
    });
}

// helper for dynamic work experience rows
function addWorkExperienceRow() {
    const container = document.getElementById('work-experience-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'work-entry';
    div.style.border = '1px solid var(--border)';
    div.style.padding = '12px';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <div class="form-row"><label>Company</label><input name="work_company"/></div>
        <div class="form-row"><label>Title</label><input name="work_title"/></div>
        <div class="form-row"><label>Start Date</label><input type="month" name="work_start_date"/></div>
        <div class="form-row"><label>End Date</label><input type="month" name="work_end_date"/></div>
        <div class="form-row"><label>Duration (months)</label><input type="number" name="work_duration_months" min="0"/></div>
        <div class="form-row"><label>Description</label><textarea name="work_description" rows="2" style="width:100%"></textarea></div>
    `;
    container.appendChild(div);
}

function clearFieldHighlights(form) {
    form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    form.querySelectorAll('.error-text').forEach(el => el.style.display = 'none');
}

function showFormError(message, fields) {
    const div = document.getElementById('form-error');
    if (!div) return;
    div.textContent = message;
    div.style.display = 'block';
    if (fields && fields.length) {
        highlightFields(fields);
    }
}

function clearFormError() {
    const div = document.getElementById('form-error');
    if (!div) return;
    div.textContent = '';
    div.style.display = 'none';
    // also clear any individual marks
    const form = document.getElementById('add-student-form') || document.getElementById('edit-student-form');
    if (form) clearFieldHighlights(form);
}

async function submitAddStudentForm() {
    const form = document.getElementById('add-student-form');
    if (!form) return;
    clearFormError();

    // client-side check for required fields (only basic personal info remains required)
    const requiredEls = Array.from(form.querySelectorAll('[required]'));
    const missing = requiredEls.filter(el => !el.value || el.value.toString().trim() === '');
    if (missing.length) {
        highlightFields(missing.map(el=>el.name));
        showFormError('Please fill out the required fields', missing.map(el=>el.name));
        window.scrollTo(0, 0);
        return;
    }
    
    const formData = new FormData(form);
    
    // Normalize numeric fields
    const gpa = formData.get('gpa');
    if (gpa) formData.set('gpa', parseFloat(gpa));

    // collect work experience entries if any
    const workEntries = [];
    document.querySelectorAll('#work-experience-container .work-entry').forEach(ent => {
        const job = {
            company: ent.querySelector('[name="work_company"]').value,
            title: ent.querySelector('[name="work_title"]').value,
            start_date: ent.querySelector('[name="work_start_date"]').value,
            end_date: ent.querySelector('[name="work_end_date"]').value,
            duration_months: ent.querySelector('[name="work_duration_months"]').value,
            description: ent.querySelector('[name="work_description"]').value
        };
        // only include if at least one field is present
        if (Object.values(job).some(v => v && v.toString().trim() !== '')) {
            workEntries.push(job);
        }
    });
    if (workEntries.length) {
        formData.append('work_experience', JSON.stringify(workEntries));
    }

    // add courses string if provided
    const coursesVal = form.querySelector('textarea[name="courses"]').value;
    if (coursesVal && coursesVal.toString().trim() !== '') {
        formData.append('courses', coursesVal);
    }

    // english fields: only append if any value entered
    const engTest = form.querySelector('[name="english_test"]').value;
    if (engTest) {
        formData.append('test', engTest);
        const engScore = form.querySelector('[name="english_score"]').value;
        if (engScore) formData.append('score', engScore);
        const engLevel = form.querySelector('[name="english_level"]').value;
        if (engLevel) formData.append('level', engLevel);
        const engDate = form.querySelector('[name="english_date"]').value;
        if (engDate) formData.append('date_taken', engDate);
    }

    try {
        const res = await fetch(`${API_URL}/students`, {
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (!res.ok) {
            // parse server missing fields message
            const msg = result.error || 'Create failed';
            const match = msg.match(/Missing required fields: (.+)/);
            if (match) {
                const fields = match[1].split(',').map(s=>s.trim());
                highlightFields(fields);
            }
            throw new Error(msg);
        }
        await loadStudents();
        buildKPIs(); buildOverviewCharts(); buildAcademicsCharts(); buildEnglishCharts(); buildWorkCharts(); populateMajorFilter(); buildStudentGrid(students);
        closeModalDirect();
        window.scrollTo(0, 0);
        alert('Student created successfully! ID: ' + result.student_id);
    } catch (err) {
        console.error('Failed to create student:', err);
        showFormError('Failed to create student: ' + err.message);
        window.scrollTo(0, 0);
    }
}
