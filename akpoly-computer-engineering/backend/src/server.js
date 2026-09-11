require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5500',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'akpoly-comp-eng-backend', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

// TODO (later phases): mount /api/students, /api/lecturers, /api/hod,
// /api/results, /api/courses, /api/timetable, /api/exams, /api/jobs,
// /api/files, /api/notifications, /api/admin, /api/system, /api/logs

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Akpoly Computer Engineering API listening on port ${PORT}`);
});
