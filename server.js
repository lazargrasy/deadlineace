// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.log(err));

// --- MODELS ---
const UserSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'] }
});
const User = mongoose.model('User', UserSchema);

const AssignmentSchema = new mongoose.Schema({
  title: String,
  subject: String,
  description: String,
  dueDate: Date,
  priority: String,
  rubric: [{ criterion: String, maxMarks: Number }], // Added this
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileUrl: String
});
const Assignment = mongoose.model('Assignment', AssignmentSchema);

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { name, username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ name, username, password: hashedPassword, role });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) { res.status(400).json({ msg: "User already exists" }); }
});

app.post('/api/login', async (req, res) => {
  const { username, password, role } = req.body;
  const user = await User.findOne({ username, role });
  if (!user) return res.status(400).json({ msg: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
});

// --- ASSIGNMENT ROUTES ---
app.get('/api/assignments', async (req, res) => {
  const assignments = await Assignment.find();
  res.json(assignments);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
