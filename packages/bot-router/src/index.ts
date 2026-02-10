import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.ROUTER_PORT || 3001;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'bot-router' });
});

// Bot router logic will be implemented here
// This service will handle routing for multiple bots

app.listen(PORT, () => {
  console.log(`Bot router is running on port ${PORT}`);
});

