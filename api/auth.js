import 'dotenv/config';
import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { scrypt, timingSafeEqual, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Helper function to compare passwords
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

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
  const path = url.replace('/api/auth', '');

  try {
    if (method === 'POST' && path === '/login') {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      
      if (user.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await comparePasswords(password, user[0].password);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Return user data (excluding password)
      const { password: _, ...userData } = user[0];
      res.json({ user: userData });
    } else if (method === 'POST' && path === '/register') {
      const { username, email, password, inviteCode } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
      }

      // Hash password
      const salt = randomBytes(16).toString('hex');
      const hashedPassword = await scryptAsync(password, salt, 64);
      const passwordHash = `${hashedPassword.toString('hex')}.${salt}`;

      const newUser = await db.insert(users).values({
        username,
        email,
        password: passwordHash,
        balance: 0,
        inviteCode: inviteCode || null
      }).returning();

      const { password: _, ...userData } = newUser[0];
      res.json({ user: userData });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
