require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// ===== MODELS (Included directly to prevent 'Module Not Found' errors) =====
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], required: true },
  name: { type: String, required: true }
});

const AssignmentSchema = new mongoose.Schema({
  title: String, subject: String, description: String, dueDate: String, priority: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  questionFile: String,
  rubric: [{ id: String, criterion: String, maxMarks: Number, description: String }]
});

const SubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileName: String, filePath: String, submittedAt: String,
  method: { type: String, enum: ['online', 'in-person'] },
  status: { type: String, default: 'Pending' },
  grades: { type: Map, of: Number }, feedback: String
});

const AttendanceSchema = new mongoose.Schema({ date: String, records: { type: Map, of: [String] } });
const QuerySchema = new mongoose.Schema({ text: String, postedAt: String, status: { type: String, default: 'pending' }, answer: String });

const User = mongoose.model('User', UserSchema);
const Assignment = mongoose.model('Assignment', AssignmentSchema);
const Submission = mongoose.model('Submission', SubmissionSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Query = mongoose.model('Query', QuerySchema);
// ===== END MODELS =====

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected' });
});

// ===== DATABASE CONNECTION =====
const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing');
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // AUTO-CREATE USERS
        const count = await User.countDocuments();
        if (count === 0) {
            console.log('Creating default users...');
            const hashedStudent = await bcrypt.hash('student123', 10);
            const hashedAdmin = await bcrypt.hash('admin123', 10);
            await User.create([
                { username: 'student', password: hashedStudent, role: 'student', name: 'Student Demo' },
                { username: 'admin', password: hashedAdmin, role: 'admin', name: 'Admin Demo' }
            ]);
            console.log('Users created!');
        }
    } catch (err) {
        console.error('DB Error:', err.message);
    }
};

connectDB();

// ===== CLOUDINARY =====
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'smartboard_uploads', resource_type: 'auto' },
});
const upload = multer({ storage: storage });

// Auth Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ msg: 'No token' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        next();
    } catch (e) {
        res.status(401).json({ msg: 'Invalid token' });
    }
};

// ====== ROUTES ======
app.post('/api/register', async (req, res) => {
    try {
        const { name, username, password, role } = req.body;
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: 'User exists' });
        const hashed = await bcrypt.hash(password, 10);
        user = new User({ name, username, password: hashed, role });
        await user.save();
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET || 'default_secret');
        res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
    } catch(err) { res.status(500).json({ msg: 'Error' }) }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const user = await User.findOne({ username, role });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET || 'default_secret');
        res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
    } catch(err) { res.status(500).json({ msg: 'Error' }) }
});

// Assignments
app.get('/api/assignments', auth, async (req, res) => res.json(await Assignment.find()));
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
app.get('/api/submissions', auth, async (req, res) => res.json(await Submission.find().populate('studentId assignmentId')));
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
app.post('/api/submissions/admin', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Denied' });
    const { studentId, assignmentId } = req.body;
    let sub = await Submission.findOne({ studentId, assignmentId });
    if (sub) return res.json(sub);
    sub = new Submission({ studentId, assignmentId, method: 'in-person', submittedAt: new Date().toISOString().split('T')[0], status: 'Pending' });
    await sub.save();
    res.json(sub);
});
app.put('/api/submissions/:id', auth, async (req, res) => {
    const { grades, feedback, status } = req.body;
    res.json(await Submission.findByIdAndUpdate(req.params.id, { grades, feedback, status }, { new: true }));
});

// Queries
app.get('/api/queries', auth, async (req, res) => res.json(await Query.find()));
app.post('/api/queries', auth, async (req, res) => {
    const q = new Query({ text: req.body.text, postedAt: new Date().toISOString().split('T')[0] });
    await q.save();
    res.json(q);
});
app.put('/api/queries/:id', auth, async (req, res) => {
    res.json(await Query.findByIdAndUpdate(req.params.id, { answer: req.body.answer, status: 'answered' }, { new: true }));
});

// Attendance
app.get('/api/attendance', auth, async (req, res) => res.json(await Attendance.find()));
app.post('/api/attendance', auth, async (req, res) => {
    const { date, records } = req.body;
    let att = await Attendance.findOne({ date });
    if (att) { att.records = records; await att.save(); }
    else { att = new Attendance({ date, records }); await att.save(); }
    res.json(att);
});

// Users
app.get('/api/users', auth, async (req, res) => res.json(await User.find()));

// ====== SERVE FRONTEND ======
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
