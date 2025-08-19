import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";

async function sendWelcomeEmail(user) {
  try {
    // Create nodemailer transporter with SMTP - reusing the same configuration as forgot-password
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Boolean(process.env.SMTP_SECURE), // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Send welcome email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Welcome to Tibank Quantitative Trading!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 30px;">
      TIBANK
      </div>
    <!-- Header -->
    <h1 style="color: #2c3e50; text-align: center;">Welcome to Tibank Quantitative Trading.
        !</h1>
  
    <!-- Greeting -->
    <p style="color: #333; font-size: 16px;">Hello <strong>${user.username || user.email}</strong>,</p>
  
    <!-- Message Body -->
    <p style="color: #333; font-size: 16px;">Thank you for registering with us. We're excited to have you on board!</p>
    <p style="color: #333; font-size: 16px;">Here are some things you can do:</p>
  
    <!-- List of Actions -->
    <ul style="color: #333; font-size: 16px; padding-left: 20px; line-height: 1.6;">
      <li>💰 Make your first deposit and start investing</li>
      <li>👥 Generate your referral code and invite friends</li>
      <li>📢 Join our Telegram Channel: <a href="https://t.me/Tibankofficial1" style="color: #2980b9; text-decoration: none;">Telegram</a></li>
    </ul>
  
    <!-- Support -->
    <p style="color: #333; font-size: 16px;">If you have any questions or need assistance, please don't hesitate to contact our <a href="mailto:support@tibank.vip" style="color: #2980b9; text-decoration: none;">Support Team</a>.</p>
  
    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated message, please do not reply directly to this email.</p>
    </div>
  </div>
  
  
      `,
    });

    console.log(`Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw the error - we don't want registration to fail if email sending fails
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || randomUUID(),
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure multiple local strategies for different login methods
  passport.use(
    "local-username",
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        if (user.isBanned) {
          return done(null, false, { message: "Your account has been banned" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.use(
    "local-email",
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (user.isBanned) {
            return done(null, false, {
              message: "Your account has been banned",
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.use(
    "local-phone",
    new LocalStrategy(
      { usernameField: "phone" },
      async (phone, password, done) => {
        try {
          const user = await storage.getUserByPhone(phone);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid phone or password" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.use(
    "local-telegram",
    new LocalStrategy(
      { usernameField: "telegram" },
      async (telegram, password, done) => {
        try {
          const user = await storage.getUserByTelegram(telegram);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, {
              message: "Invalid Telegram ID or password",
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Register route
  app.post("/api/register", async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Validate invite code
      const inviteCode = await storage.getInviteCode(userData.inviteCode);
      if (!inviteCode) {
        return res.status(400).json({ message: "Invalid invite code" });
      }

      // Check if user exists
      if (userData.username) {
        const existingUsername = await storage.getUserByUsername(
          userData.username,
        );
        if (existingUsername) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }

      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }

      if (userData.phone) {
        const existingPhone = await storage.getUserByPhone(userData.phone);
        if (existingPhone) {
          return res.status(400).json({ message: "Phone already exists" });
        }
      }

      if (userData.telegram) {
        const existingTelegram = await storage.getUserByTelegram(
          userData.telegram,
        );
        if (existingTelegram) {
          return res
            .status(400)
            .json({ message: "Telegram ID already exists" });
        }
      }

      // Hash the passwords
      const hashedPassword = await hashPassword(userData.password);
      const hashedSecurityPassword = await hashPassword(
        userData.securityPassword,
      );

      // Generate a new invite code for the user
      const newInviteCode = storage.generateReferralCode();

      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        securityPassword: hashedSecurityPassword,
        referralCode: newInviteCode,
        inviteCode: userData.inviteCode, // Store the invite code used
        referrerId: inviteCode.createdById || null, // Store referrer ID directly
      });

      await sendWelcomeEmail(user);

      // Create invite code entry for the new user
      await storage.createInviteCode({
        code: newInviteCode,
        createdById: user.id,
      });

      // Validate the invite code is valid
      await storage.useInviteCode(userData.inviteCode, user.id);

      // Add referral if the invite code has a creator
      if (inviteCode.createdById) {
        // Create referral relationship
        await storage.createReferral({
          referrerId: inviteCode.createdById,
          referredId: user.id,
          level: "1",
          commission: "0",
        });

        // Send notification to referrer
        await storage.createNotification({
          userId: inviteCode.createdById,
          type: "referral",
          message: `New user ${user.username} has joined using your referral code!`,
          isRead: false,
        });
      }

      // Login the user
      req.login(user, (err) => {
        if (err) return next(err);

        // Return user without sensitive data
        const { password, securityPassword, ...userWithoutPasswords } = user;
        res.status(201).json(userWithoutPasswords);
      });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Login routes for different auth methods
  app.post(
    "/api/login/username",
    passport.authenticate("local-username", { failWithError: true }),
    (req, res) => {
      // Return user without sensitive data
      const { password, securityPassword, ...userWithoutPasswords } =
        req.user as SelectUser;
      res.status(200).json(userWithoutPasswords);
    },
    (err, req, res, next) => {
      res.status(401).json({ message: "Invalid username or password" });
    },
  );

  app.post(
    "/api/login/email",
    passport.authenticate("local-email", { failWithError: true }),
    (req, res) => {
      // Return user without sensitive data
      const { password, securityPassword, ...userWithoutPasswords } =
        req.user as SelectUser;
      res.status(200).json(userWithoutPasswords);
    },
    (err, req, res, next) => {
      res.status(401).json({ message: "Invalid email or password" });
    },
  );

  app.post(
    "/api/login/phone",
    passport.authenticate("local-phone", { failWithError: true }),
    (req, res) => {
      // Return user without sensitive data
      const { password, securityPassword, ...userWithoutPasswords } =
        req.user as SelectUser;
      res.status(200).json(userWithoutPasswords);
    },
    (err, req, res, next) => {
      res.status(401).json({ message: "Invalid phone or password" });
    },
  );

  app.post(
    "/api/login/telegram",
    passport.authenticate("local-telegram", { failWithError: true }),
    (req, res) => {
      // Return user without sensitive data
      const { password, securityPassword, ...userWithoutPasswords } =
        req.user as SelectUser;
      res.status(200).json(userWithoutPasswords);
    },
    (err, req, res, next) => {
      res.status(401).json({ message: "Invalid Telegram ID or password" });
    },
  );

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Return user without sensitive data
    const { password, securityPassword, ...userWithoutPasswords } =
      req.user as SelectUser;
    res.json(userWithoutPasswords);
  });
}
