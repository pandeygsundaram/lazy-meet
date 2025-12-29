import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import authRoutes from './routes/auth';
import recordingsRoutes from './routes/recordings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/recordings', recordingsRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`POST /auth/signup - Create new user account`);
  console.log(`POST /auth/login - Login with email and password`);
  console.log(`POST /recordings/upload - Upload audio (returns immediately, processes in background)`);
  console.log(`GET /recordings - Get all user recordings (requires auth)`);
  console.log(`GET /recordings/:id - Get specific recording (requires auth)`);
  console.log(`DELETE /recordings/:id - Delete recording (requires auth)`);
  console.log(`GET /health - Check server status`);

  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }
});
