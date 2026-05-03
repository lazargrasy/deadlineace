require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { User, Assignment, Submission, Attendance, Query } = require('./models');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token, auth denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// ====== ROUTES ======

// Auth
app.post('/api/register', async (req, res) => {
  const { name, username, password, role } = req.body;
  let user = await User.findOne({ username });
  if (user) return res.status(400).json({ msg: 'User exists' });
  
  const hashed = await bcrypt.hash(password, 10);
  user = new User({ name, username, password: hashed, role });
  await user.save();
  
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET);
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
});

app.post('/api/login', async (req, res) => {
  const { username, password, role } = req.body;
  const user = await User.findOne({ username, role });
  if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });
  
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });
  
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET);
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
});

// Assignments
app.get('/api/assignments', auth, async (req, res) => {
  const items = await Assignment.find();
  res.json(items);
});

app.post('/api/assignments', auth, upload.single('file'), async (req, res) => {
  const { title, subject, description, dueDate, priority, rubric } = req.body;
  const newItem = new Assignment({
    title, subject, description, dueDate, priority, 
    questionFile: req.file ? req.file.path : null,
    createdBy: req.user.id,
    rubric: rubric ? JSON.parse(rubric) : []
  });
  await newItem.save();
  res.json(newItem);
});

app.delete('/api/assignments/:id', auth, async (req, res) => {
  await Assignment.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Deleted' });
});

// Submissions
app.get('/api/submissions', auth, async (req, res) => {
  const items = await Submission.find().populate('studentId assignmentId');
  res.json(items);
});

app.post('/api/submissions', auth, upload.single('file'), async (req, res) => {
  const { assignmentId, method } = req.body;
  const newItem = new Submission({
    assignmentId, studentId: req.user.id, method,
    fileName: req.file ? req.file.originalname : null,
    filePath: req.file ? req.file.path : null,
    submittedAt: new Date().toISOString().split('T')[0],
    status: 'Pending'
  });
  await newItem.save();
  res.json(newItem);
});

// Admin: Create Submission for Student (In-Person)
app.post('/api/submissions/admin', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
  const { studentId, assignmentId } = req.body;
  
  let sub = await Submission.findOne({ studentId, assignmentId });
  if (sub) return res.json(sub); // Already exists

  sub = new Submission({
    studentId, assignmentId, method: 'in-person',
    submittedAt: new Date().toISOString().split('T')[0], status: 'Pending'
  });
  await sub.save();
  res.json(sub);
});

app.put('/api/submissions/:id', auth, async (req, res) => {
  const { grades, feedback, status } = req.body;
  const sub = await Submission.findByIdAndUpdate(req.params.id, 
    { grades, feedback, status }, { new: true });
  res.json(sub);
});

// Queries
app.get('/api/queries', auth, async (req, res) => {
  res.json(await Query.find());
});

app.post('/api/queries', auth, async (req, res) => {
  const q = new Query({ text: req.body.text, postedAt: new Date().toISOString().split('T')[0] });
  await q.save();
  res.json(q);
});

app.put('/api/queries/:id', auth, async (req, res) => {
  const q = await Query.findByIdAndUpdate(req.params.id, { answer: req.body.answer, status: 'answered' }, { new: true });
  res.json(q);
});

// Attendance
app.get('/api/attendance', auth, async (req, res) => {
  res.json(await Attendance.find());
});

app.post('/api/attendance', auth, async (req, res) => {
  const { date, records } = req.body;
  let att = await Attendance.findOne({ date });
  if (att) {
    att.records = records;
    await att.save();
  } else {
    att = new Attendance({ date, records });
    await att.save();
  }
  res.json(att);
});

// Users List (Admin)
app.get('/api/users', auth, async (req, res) => {
  res.json(await User.find());
});

// Serve Frontend (Build step or static)
// For simplicity, we will put the HTML/CSS/JS in a 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

app.listen(5000, () => console.log('Server running on port 5000'));