import 'dotenv/config';
import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import nodemailer from 'nodemailer';

const scryptAsync = promisify(scrypt);

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
  const path = url.replace('/api/password-reset', '');

  try {
    if (method === 'POST' && path === '/forgot') {
      // Forgot password
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const userResult = await db.select().from(users).where(eq(users.email, email));
      const user = userResult[0];

      if (user) {
        // Generate reset token
        const resetToken = randomBytes(32).toString("hex");
        const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

        // Store reset token and expiry in the database
        await db.update(users).set({
          resetToken: resetToken,
          resetTokenExpiry: resetExpiry,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        // Create nodemailer transporter with SMTP
        if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          const transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_PORT === '465',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
            tls: {
              rejectUnauthorized: false,
            },
          });

          // Send reset email
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset Request",
            html: `
              <h1>Password Reset</h1>
              <p>You requested a password reset. Click the link below to reset your password:</p>
              <a href="${process.env.API_BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}">Reset Password</a>
              <p>This link will expire in 1 hour.</p>
              <p>If you did not request this reset, please ignore this email.</p>
            `,
          });
        }
      }

      // Always return success to prevent email enumeration
      res.json({
        message: "If an account exists with this email, you will receive reset instructions",
      });
    } else if (method === 'POST' && path === '/reset') {
      // Reset password
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      // Find user by reset token and check if it's still valid
      const userResult = await db.select().from(users).where(eq(users.resetToken, token));
      const user = userResult[0];

      if (
        !user ||
        !user.resetTokenExpiry ||
        new Date() > new Date(user.resetTokenExpiry)
      ) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash the new password
      const salt = randomBytes(16).toString("hex");
      const hashedPassword = await scryptAsync(password, salt, 64);
      const newHashedPassword = `${hashedPassword.toString("hex")}.${salt}`;

      // Update user's password and clear reset token
      await db.update(users).set({
        password: newHashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      res.json({ message: "Password reset successful" });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Password reset API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
