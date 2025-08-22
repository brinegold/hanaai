import 'dotenv/config';
import { db } from '../server/db.js';
import { inviteCodes, users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

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
  const path = url.replace('/api/invite-codes', '');

  try {
    if (method === 'GET' && path === '') {
      // Get user's invite codes
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const codes = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.createdById, parseInt(userId)));

      res.json({ codes });
    } else if (method === 'POST' && path === '') {
      // Generate new invite code
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create new invite code and update user's codes
      const [inviteCode] = await Promise.all([
        db.insert(inviteCodes).values({
          code,
          createdById: parseInt(userId),
        }).returning(),
        db.update(users).set({
          inviteCode: code,
          referralCode: code,
          updatedAt: new Date(),
        }).where(eq(users.id, parseInt(userId))),
      ]);

      res.json({
        ...inviteCode[0],
        inviteCode: code,
        referralCode: code,
      });
    } else if (method === 'POST' && path === '/verify') {
      // Verify and store invite code
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Invite code is required" });
      }

      // Check if code already exists
      const existingCodeResult = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));
      const existingCode = existingCodeResult[0];
      
      if (!existingCode) {
        // Generate a new code if none exists
        const newCode = await db.insert(inviteCodes).values({
          code: code,
          createdById: 1, // System user
        }).returning();
        
        if (!newCode || newCode.length === 0) {
          throw new Error("Failed to create invite code");
        }
      }
      
      res.status(200).json({ success: true });
    } else if (method === 'GET' && path === '/welcome-code') {
      // Generate welcome code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create welcome invite code
      const welcomeCode = await db.insert(inviteCodes).values({
        code,
        createdById: 1, // System user
      }).returning();
      
      res.json({ code: welcomeCode[0].code });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Invite codes API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
