const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure documents folder exists
const documentsDir = path.join(__dirname, 'documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: studentId_timestamp_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|zip/i;
    const extname = allowedTypes.test(path.extname(file.originalname));
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only document files are allowed'));
    }
  }
});

// Serve static files but exclude sensitive files
app.use(express.static('./', {
  dotfiles: 'deny', // Deny access to dotfiles like .env
  index: false // Don't serve index.html automatically since we have custom routing
}));
app.use('/documents', express.static(documentsDir));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// ── API ENDPOINTS ──

// Get all students with their related data
app.get('/api/students', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [students] = await connection.query('SELECT * FROM students');
    
    // Fetch related data for each student and massage into the shape expected by the
    // front‑end (basic_info + academic_records.courses,honors etc.)
    const studentsWithData = await Promise.all(students.map(async (student) => {
      const [academics] = await connection.query(
        'SELECT * FROM academic_records WHERE student_id = ?',
        [student.student_id]
      );
      const [workExp] = await connection.query(
        'SELECT * FROM work_experience WHERE student_id = ?',
        [student.student_id]
      );
      const [englishScores] = await connection.query(
        'SELECT * FROM english_scores WHERE student_id = ?',
        [student.student_id]
      );
      const [coursesRows] = await connection.query(
        'SELECT course_name FROM courses WHERE student_id = ?',
        [student.student_id]
      );
      const [honorsRows] = await connection.query(
        'SELECT honor_name FROM honors WHERE student_id = ?',
        [student.student_id]
      );
      const [documentsRows] = await connection.query(
        'SELECT * FROM documents WHERE student_id = ?',
        [student.student_id]
      );

      const basicInfo = {
        first_name: student.first_name,
        last_name: student.last_name,
        full_name: `${student.first_name} ${student.last_name}`,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        nationality: student.nationality,
        email: student.email,
        phone: student.phone,
        address: student.address
      };

      return {
        student_id: student.student_id,
        basic_info: basicInfo,
        academic_records: {
          ...academics[0],
          courses: coursesRows.map(r => r.course_name),
          honors: honorsRows.map(r => r.honor_name)
        },
        work_experience: workExp || [],
        english_scores: englishScores[0] || {},
        documents: documentsRows || []
      };
    }));
    
    connection.release();
    res.json(studentsWithData);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student by ID with all details
app.get('/api/students/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [students] = await connection.query(
      'SELECT * FROM students WHERE student_id = ?',
      [req.params.id]
    );
    
    if (students.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = students[0];
    const [academics] = await connection.query(
      'SELECT * FROM academic_records WHERE student_id = ?',
      [req.params.id]
    );
    
    const [workExp] = await connection.query(
      'SELECT * FROM work_experience WHERE student_id = ?',
      [req.params.id]
    );
    
    const [englishScores] = await connection.query(
      'SELECT * FROM english_scores WHERE student_id = ?',
      [req.params.id]
    );
    const [coursesRows] = await connection.query(
      'SELECT course_name FROM courses WHERE student_id = ?',
      [req.params.id]
    );
    const [honorsRows] = await connection.query(
      'SELECT honor_name FROM honors WHERE student_id = ?',
      [req.params.id]
    );
    const [documentsRows] = await connection.query(
      'SELECT * FROM documents WHERE student_id = ?',
      [req.params.id]
    );

    const basicInfo = {
      first_name: student.first_name,
      last_name: student.last_name,
      full_name: `${student.first_name} ${student.last_name}`,
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      nationality: student.nationality,
      email: student.email,
      phone: student.phone,
      address: student.address
    };

    connection.release();
    
    res.json({
      student_id: student.student_id,
      basic_info: basicInfo,
      academic_records: {
        ...academics[0],
        courses: coursesRows.map(r => r.course_name),
        honors: honorsRows.map(r => r.honor_name)
      },
      work_experience: workExp || [],
      english_scores: englishScores[0] || {},
      documents: documentsRows || []
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Get all academics
app.get('/api/academics', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [academics] = await connection.query(`
      SELECT s.student_id, s.first_name, s.last_name, CONCAT(s.first_name, ' ', s.last_name) AS full_name,
             a.* FROM academic_records a
      JOIN students s ON a.student_id = s.student_id
    `);
    connection.release();
    res.json(academics);
  } catch (error) {
    console.error('Error fetching academics:', error);
    res.status(500).json({ error: 'Failed to fetch academics' });
  }
});

// Get all english scores
app.get('/api/english', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [english] = await connection.query(`
      SELECT s.student_id, s.first_name, s.last_name, CONCAT(s.first_name, ' ', s.last_name) AS full_name,
             a.major, e.* FROM english_scores e
      JOIN students s ON e.student_id = s.student_id
      JOIN academic_records a ON a.student_id = s.student_id
    `);
    connection.release();
    res.json(english);
  } catch (error) {
    console.error('Error fetching english scores:', error);
    res.status(500).json({ error: 'Failed to fetch english scores' });
  }
});

// Get all work experience
app.get('/api/work-experience', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [work] = await connection.query(`
      SELECT s.student_id, s.first_name, s.last_name, CONCAT(s.first_name, ' ', s.last_name) AS full_name,
             w.* FROM work_experience w
      JOIN students s ON w.student_id = s.student_id
    `);
    connection.release();
    res.json(work);
  } catch (error) {
    console.error('Error fetching work experience:', error);
    res.status(500).json({ error: 'Failed to fetch work experience' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Update student (basic info and academic records)
app.put('/api/students/:id', async (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update students table (email, phone, name)
    if (payload.full_name || payload.email || payload.phone) {
      if (payload.full_name) {
        const parts = payload.full_name.trim().split(/\s+/);
        const first = parts.shift() || '';
        const last = parts.join(' ') || '';
        await connection.query('UPDATE students SET first_name = ?, last_name = ? WHERE student_id = ?', [first, last, id]);
      }
      if (payload.email) {
        await connection.query('UPDATE students SET email = ? WHERE student_id = ?', [payload.email, id]);
      }
      if (payload.phone) {
        await connection.query('UPDATE students SET phone = ? WHERE student_id = ?', [payload.phone, id]);
      }
    }

    // Update academic_records table (university, major, gpa, enrollment_status and extras)
    const arFields = [];
    const arValues = [];
    if (payload.university !== undefined) { arFields.push('university = ?'); arValues.push(payload.university); }
    if (payload.major !== undefined) { arFields.push('major = ?'); arValues.push(payload.major); }
    if (payload.minor !== undefined) { arFields.push('minor = ?'); arValues.push(payload.minor); }
    if (payload.degree !== undefined) { arFields.push('degree = ?'); arValues.push(payload.degree); }
    if (payload.gpa !== undefined) { arFields.push('gpa = ?'); arValues.push(payload.gpa); }
    if (payload.credits_completed !== undefined) { arFields.push('credits_completed = ?'); arValues.push(payload.credits_completed); }
    if (payload.graduation_year !== undefined) { arFields.push('graduation_year = ?'); arValues.push(payload.graduation_year); }
    if (payload.enrollment_status !== undefined) { arFields.push('enrollment_status = ?'); arValues.push(payload.enrollment_status); }
    if (arFields.length > 0) {
      arValues.push(id);
      const sql = `UPDATE academic_records SET ${arFields.join(', ')} WHERE student_id = ?`;
      await connection.query(sql, arValues);
    }

    // update english_scores if provided
    const engFields = [];
    const engVals = [];
    if (payload.test !== undefined) { engFields.push('test = ?'); engVals.push(payload.test); }
    if (payload.score !== undefined) { engFields.push('score = ?'); engVals.push(payload.score); }
    if (payload.level !== undefined) { engFields.push('level = ?'); engVals.push(payload.level); }
    if (payload.date_taken !== undefined) { engFields.push('date_taken = ?'); engVals.push(payload.date_taken); }
    if (engFields.length > 0) {
      engVals.push(id);
      const sql = `UPDATE english_scores SET ${engFields.join(', ')} WHERE student_id = ?`;
      await connection.query(sql, engVals);
    }

    // replace courses if provided
    if (payload.courses !== undefined) {
      await connection.query('DELETE FROM courses WHERE student_id = ?', [id]);
      let coursesArr = [];
      if (Array.isArray(payload.courses)) {
        coursesArr = payload.courses;
      } else if (typeof payload.courses === 'string') {
        coursesArr = payload.courses.split(',').map(s => s.trim()).filter(Boolean);
      }
      for (const course of coursesArr) {
        await connection.query('INSERT INTO courses (student_id, course_name) VALUES (?, ?)', [id, course]);
      }
    }

    // replace work experience if provided (expect JSON string or array)
    if (payload.work_experience !== undefined) {
      await connection.query('DELETE FROM work_experience WHERE student_id = ?', [id]);
      let workArr = [];
      if (Array.isArray(payload.work_experience)) {
        workArr = payload.work_experience;
      } else {
        try { workArr = JSON.parse(payload.work_experience); } catch (_) { workArr = []; }
      }
      if (Array.isArray(workArr)) {
        for (const w of workArr) {
          await connection.query(
            'INSERT INTO work_experience (student_id, company, title, start_date, end_date, duration_months, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, w.company || '', w.title || '', w.start_date || '', w.end_date || '', w.duration_months ? parseInt(w.duration_months, 10) : 0, w.description || '']
          );
        }
      }
    }

    await connection.commit();
    connection.release();
    res.json({ status: 'updated' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student and related records
app.delete('/api/students/:id', async (req, res) => {
  const id = req.params.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Remove related records
    await connection.query('DELETE FROM courses WHERE student_id = ?', [id]);
    await connection.query('DELETE FROM honors WHERE student_id = ?', [id]);
    await connection.query('DELETE FROM documents WHERE student_id = ?', [id]);
    await connection.query('DELETE FROM work_experience WHERE student_id = ?', [id]);
    await connection.query('DELETE FROM english_scores WHERE student_id = ?', [id]);
    await connection.query('DELETE FROM academic_records WHERE student_id = ?', [id]);
    await connection.query('DELETE FROM students WHERE student_id = ?', [id]);

    await connection.commit();
    connection.release();
    res.json({ status: 'deleted' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Create new student with optional document uploads
app.post('/api/students', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'certificate', maxCount: 1 },
  { name: 'diploma', maxCount: 1 },
  { name: 'portfolio', maxCount: 1 }
]), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const payload = req.body || {};

    // Ensure all required fields are present (minor and documents are optional)
    // only basic personal fields are mandatory now; academic, english, etc. are optional
    const required = ['first_name','last_name','email','phone','date_of_birth','gender','nationality','address'];
    const missing = required.filter(f => !payload[f] || payload[f].toString().trim() === '');
    if (missing.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Missing required fields: ' + missing.join(', ') });
    }

    // generate a new student_id in the STU0001 style
    const [rows] = await connection.query('SELECT student_id FROM students ORDER BY student_id DESC LIMIT 1');
    let newId;
    if (rows.length === 0) {
      newId = 'STU0001';
    } else {
      const last = rows[0].student_id || '';
      const num = parseInt(last.replace(/\D/g, ''), 10) || 0;
      newId = 'STU' + String(num + 1).padStart(4, '0');
    }

    // Insert into students table (ignore any id from client)
    await connection.query(
      'INSERT INTO students (student_id, first_name, last_name, date_of_birth, gender, nationality, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newId,
        payload.first_name,
        payload.last_name,
        payload.date_of_birth,
        payload.gender,
        payload.nationality,
        payload.email,
        payload.phone,
        payload.address
      ]
    );

    // Insert into academic_records table (payload fields may be blank strings)
    await connection.query(
      'INSERT INTO academic_records (student_id, university, major, minor, degree, gpa, credits_completed, graduation_year, enrollment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newId,
        payload.university || '',
        payload.major || '',
        payload.minor || '',
        payload.degree || '',
        parseFloat(payload.gpa) || 0,
        payload.credits_completed || 0,
        payload.graduation_year || (payload.gpa ? new Date().getFullYear() : null),
        payload.enrollment_status || ''
      ]
    );

    // Insert into english_scores table; use provided values when available
    await connection.query(
      'INSERT INTO english_scores (student_id, test, score, level, date_taken) VALUES (?, ?, ?, ?, ?)',
      [
        newId,
        payload.test || 'TOEFL',
        payload.score ? parseInt(payload.score, 10) : 0,
        payload.level || 'Beginner',
        payload.date_taken || new Date().toISOString().split('T')[0]
      ]
    );

    // optionally insert courses if provided (comma separated or array)
    if (payload.courses) {
      let coursesArr = [];
      if (Array.isArray(payload.courses)) {
        coursesArr = payload.courses;
      } else {
        coursesArr = payload.courses.toString().split(',').map(s => s.trim()).filter(Boolean);
      }
      for (const course of coursesArr) {
        await connection.query(
          'INSERT INTO courses (student_id, course_name) VALUES (?, ?)',
          [newId, course]
        );
      }
    }

    // optionally insert work experience entries if payload contains JSON
    if (payload.work_experience) {
      let workArr = [];
      try {
        workArr = JSON.parse(payload.work_experience);
      } catch (e) {
        // ignore parsing failure
      }
      if (Array.isArray(workArr)) {
        for (const w of workArr) {
          await connection.query(
            'INSERT INTO work_experience (student_id, company, title, start_date, end_date, duration_months, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              newId,
              w.company || '',
              w.title || '',
              w.start_date || '',
              w.end_date || '',
              w.duration_months ? parseInt(w.duration_months, 10) : 0,
              w.description || ''
            ]
          );
        }
      }
    }

    // Handle document uploads
    const documentTypes = ['resume', 'certificate', 'diploma', 'portfolio'];
    for (const docType of documentTypes) {
      if (req.files && req.files[docType] && req.files[docType][0]) {
        const file = req.files[docType][0];
        const filePath = `/documents/${file.filename}`;
        
        await connection.query(
          'INSERT INTO documents (student_id, document_type, document_name, file_path, upload_date) VALUES (?, ?, ?, ?, ?)',
          [
            newId,
            docType.charAt(0).toUpperCase() + docType.slice(1), // Capitalize first letter
            file.originalname,
            filePath,
            new Date().toISOString().split('T')[0]
          ]
        );
      }
    }

    await connection.commit();
    connection.release();
    res.json({ status: 'created', student_id: newId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    
    // Delete uploaded files if database transaction fails
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        fileArray.forEach(file => {
          if (fs.existsSync(path.join(documentsDir, file.filename))) {
            fs.unlinkSync(path.join(documentsDir, file.filename));
          }
        });
      });
    }
    
    console.error('Error creating student:', err);
    res.status(500).json({ error: 'Failed to create student: ' + err.message });
  }
});

// Add document endpoint with file upload
app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const connection = await pool.getConnection();
    const filePath = `/documents/${req.file.filename}`;
    
    const [result] = await connection.query(
      'INSERT INTO documents (student_id, document_type, document_name, file_path, upload_date) VALUES (?, ?, ?, ?, ?)',
      [
        req.body.student_id,
        req.body.document_type,
        req.file.originalname,
        filePath,
        new Date().toISOString().split('T')[0]
      ]
    );
    
    connection.release();
    res.json({ 
      status: 'created', 
      id: result.insertId,
      file_path: filePath,
      file_name: req.file.originalname
    });
  } catch (err) {
    if (req.file) {
      // Delete uploaded file if database insert fails
      fs.unlink(path.join(documentsDir, req.file.filename), (unlinkErr) => {
        if (unlinkErr) console.error('Failed to delete file:', unlinkErr);
      });
    }
    console.error('Error uploading document:', err);
    res.status(500).json({ error: 'Failed to upload document: ' + err.message });
  }
});

// Delete document endpoint
app.delete('/api/documents/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Get document info to get file path
    const [docs] = await connection.query('SELECT file_path FROM documents WHERE id = ?', [req.params.id]);
    
    if (docs.length > 0 && docs[0].file_path) {
      // Extract filename from path and delete the file
      const filename = path.basename(docs[0].file_path);
      const filePath = path.join(documentsDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await connection.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ status: 'deleted' });
  } catch (err) {
    connection.release();
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
