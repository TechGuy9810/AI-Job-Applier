// app.js
import express from 'express';
import auth from './routes/authRoutes';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', auth);

export default app;