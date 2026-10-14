import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import connectDB from './src/config/db.js';
import { errorHandler } from './src/middleware/errorMiddleware.js';
import routes from './src/routes/index.js';
import { PORT, CLIENT_URL } from './src/config/env.js';

const app = express();

// Core middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Central error handler
app.use(errorHandler);

// Start application
const startServer = async () => {
  try {
    // 1. Connect to MongoDB first
    await connectDB();

    // 2. Start server only after DB connection succeeds
    app.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT} [${process.env.NODE_ENV}]`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();