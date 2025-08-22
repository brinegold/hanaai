import 'dotenv/config';
import { db } from '../server/db.js';
import { investments, users, transactions } from '../shared/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { insertInvestmentSchema } from '../shared/schema.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, url } = req;
  const path = url.replace('/api/investments', '');

  try {
    if (method === 'GET' && path === '/plans') {
      // Return single AI Trading plan based on memory
      res.json({
        plans: [{
          id: 1,
          name: "AI Trading",
          dailyReturn: 1.5,
          minAmount: 1,
          maxAmount: 500000,
          description: "Advanced AI-powered trading system with 1.5% daily returns"
        }]
      });
    } else if (method === 'POST' && path === '') {
      // Create new investment
      const { amount, planId } = req.body;
      
      // Validate input
      const validation = insertInvestmentSchema.safeParse({ amount, planId });
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors });
      }

      // For now, return success without user authentication
      // In production, you'd need to implement proper session management
      const investment = {
        id: Date.now(), // Simple ID generation
        amount: validation.data.amount,
        planId: validation.data.planId,
        status: 'active',
        createdAt: new Date(),
        dailyReturn: 1.5
      };

      res.json({ investment });
    } else if (method === 'GET' && path === '') {
      // Get user investments
      // For now, return empty array
      res.json({ investments: [] });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Investment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
