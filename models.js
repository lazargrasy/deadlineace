const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], required: true },
  name: { type: String, required: true }
});

const AssignmentSchema = new mongoose.Schema({
  title: String,
  subject: String,
  description: String,
  dueDate: String,
  priority: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  questionFile: String, // URL to file
  rubric: [{
    id: String,
    criterion: String,
    maxMarks: Number,
    description: String
  }]
});

const SubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileName: String,
  filePath: String,
  submittedAt: String,
  method: { type: String, enum: ['online', 'in-person'] },
  status: { type: String, default: 'Pending' },
  grades: { type: Map, of: Number },
  feedback: String
});

const AttendanceSchema = new mongoose.Schema({
  date: String,
  records: { type: Map, of: [String] } // Map of userID to array of 'P'/'A'
});

const QuerySchema = new mongoose.Schema({
  text: String,
  postedAt: String,
  status: { type: String, default: 'pending' },
  answer: String
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Assignment: mongoose.model('Assignment', AssignmentSchema),
  Submission: mongoose.model('Submission', SubmissionSchema),
  Attendance: mongoose.model('Attendance', AttendanceSchema),
  Query: mongoose.model('Query', QuerySchema)
};