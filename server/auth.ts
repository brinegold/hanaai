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

// Email notification functions
async function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Boolean(true),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

async function sendWelcomeEmail(user) {
  try {
    // Create nodemailer transporter with SMTP - reusing the same configuration as forgot-password
    const transporter = await createEmailTransporter();

    // Send welcome email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Welcome to Nebrix AI Trading!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
      </div>
    <!-- Header -->
    <h1 style="color: #2c3e50; text-align: center;">Welcome to Nebrix Ai Trading.
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
      <li>📢 Join our Telegram Channel: <a href="https://t.me/Nebrixdex" style="color: #2980b9; text-decoration: none;">Telegram</a></li>
      <li>📢 Follow us on X(Twitter): <a href="https://x.com/NebrixCoin"style="color: #2980b9; text-decoration: none;">X</a></li>
    </ul>
  
    <!-- Support -->
    <p style="color: #333; font-size: 16px;">If you have any questions or need assistance, please don't hesitate to contact our <a href="mailto:support@nebrix.dev" style="color: #2980b9; text-decoration: none;">Support Team</a>.</p>
  
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

// Function to create multi-tier referral relationships
async function createMultiTierReferrals(directReferrerId: number, newUserId: number, newUsername: string) {
  try {
    // Create direct referral (Tier 1)
    await storage.createReferral({
      referrerId: directReferrerId,
      referredId: newUserId,
      level: "1",
      commission: "0",
    });

    // Send notification to direct referrer
    await storage.createNotification({
      userId: directReferrerId,
      type: "referral",
      message: `New user ${newUsername} has joined using your referral code!`,
      isRead: false,
    });

    // Get the direct referrer to find their upline
    const directReferrer = await storage.getUser(directReferrerId);
    if (!directReferrer || !directReferrer.referrerId) return;

    // Create Tier 2 referral
    await storage.createReferral({
      referrerId: directReferrer.referrerId,
      referredId: newUserId,
      level: "2",
      commission: "0",
    });

    // Get Tier 2 referrer to find Tier 3
    const tier2Referrer = await storage.getUser(directReferrer.referrerId);
    if (!tier2Referrer || !tier2Referrer.referrerId) return;

    // Create Tier 3 referral
    await storage.createReferral({
      referrerId: tier2Referrer.referrerId,
      referredId: newUserId,
      level: "3",
      commission: "0",
    });

    // Get Tier 3 referrer to find Tier 4
    const tier3Referrer = await storage.getUser(tier2Referrer.referrerId);
    if (!tier3Referrer || !tier3Referrer.referrerId) return;

    // Create Tier 4 referral
    await storage.createReferral({
      referrerId: tier3Referrer.referrerId,
      referredId: newUserId,
      level: "4",
      commission: "0",
    });

  } catch (error) {
    console.error("Error creating multi-tier referrals:", error);
    // Don't throw - we don't want registration to fail if referral creation fails
  }
}

async function sendDepositNotification(user, amount, txHash) {
  try {
    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Deposit Successful - Nebrix AI Trading",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
          </div>
          <h1 style="color: #27ae60; text-align: center;">Deposit Successful!</h1>
          <p style="color: #333; font-size: 16px;">Hello <strong>${user.username || user.email}</strong>,</p>
          <p style="color: #333; font-size: 16px;">Your deposit has been successfully processed:</p>
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount} USDT</p>
            <p style="margin: 5px 0;"><strong>Transaction Hash:</strong> ${txHash}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Completed</p>
          </div>
          <p style="color: #333; font-size: 16px;">Your funds are now available in your account and ready for trading.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending deposit notification:', error);
  }
}

async function sendReferralNotification(referrer, newUser) {
  try {
    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: referrer.email,
      subject: "New Referral Joined - Nebrix AI Trading",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
          </div>
          <h1 style="color: #3498db; text-align: center;">New Referral Joined!</h1>
          <p style="color: #333; font-size: 16px;">Hello <strong>${referrer.username || referrer.email}</strong>,</p>
          <p style="color: #333; font-size: 16px;">Great news! Someone has joined using your referral link:</p>
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>New User:</strong> ${newUser.username || newUser.email}</p>
            <p style="margin: 5px 0;"><strong>Joined:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <p style="color: #333; font-size: 16px;">You'll earn commission when they make their first deposit. Keep sharing your referral link to earn more!</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending referral notification:', error);
  }
}

async function sendWithdrawalNotification(user, amount, address, txHash) {
  try {
    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Withdrawal Processed - Nebrix AI Trading",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
          </div>
          <h1 style="color: #e67e22; text-align: center;">Withdrawal Processed!</h1>
          <p style="color: #333; font-size: 16px;">Hello <strong>${user.username || user.email}</strong>,</p>
          <p style="color: #333; font-size: 16px;">Your withdrawal has been successfully processed:</p>
          <div style="background-color: #fef9e7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount} USDT</p>
            <p style="margin: 5px 0;"><strong>Destination:</strong> ${address}</p>
            <p style="margin: 5px 0;"><strong>Transaction Hash:</strong> ${txHash}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Completed</p>
          </div>
          <p style="color: #333; font-size: 16px;">Your funds have been sent to your specified wallet address.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending withdrawal notification:', error);
  }
}

// Export email notification functions for use in other modules
export { sendDepositNotification, sendReferralNotification, sendWithdrawalNotification };

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
          return done(null, false, { message: "You have been banned please contact support: Support@nebrix.dev" });
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
              message: "You have been banned please contact support: Support@nebrix.dev",
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

      // If no invite code provided, use default "NebrixAi" referral code
      let inviteCodeToUse = userData.inviteCode;
      if (!inviteCodeToUse) {
        // Find NebrixAi user's invite code
        const nebrixUser = await storage.getUserByUsername("NebrixAi");
        if (nebrixUser && nebrixUser.referralCode) {
          inviteCodeToUse = nebrixUser.referralCode;
        } else {
          return res.status(400).json({ message: "Default referral system not available" });
        }
      }

      // Validate invite code
      const inviteCode = await storage.getInviteCode(inviteCodeToUse);
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

      // Create user with proper referrerId handling
      const userCreateData = {
        ...userData,
        password: hashedPassword,
        securityPassword: hashedSecurityPassword,
        referralCode: newInviteCode,
        inviteCode: inviteCodeToUse, // Store the invite code used (could be default NebrixAi)
      };

      // Only add referrerId if it exists and is not null
      if (inviteCode.createdById && inviteCode.createdById !== null) {
        userCreateData.referrerId = inviteCode.createdById;
      }

      const user = await storage.createUser(userCreateData);

      await sendWelcomeEmail(user);

      // Create invite code entry for the new user
      await storage.createInviteCode({
        code: newInviteCode,
        createdById: user.id,
      });

      // Validate the invite code is valid
      await storage.useInviteCode(inviteCodeToUse, user.id);

      // Add multi-tier referral relationships if the invite code has a creator
      if (inviteCode.createdById && inviteCode.createdById !== null) {
        await createMultiTierReferrals(inviteCode.createdById, user.id, user.username);
        
        // Send referral notification to the referrer
        const referrer = await storage.getUserById(inviteCode.createdById);
        if (referrer) {
          await sendReferralNotification(referrer, user);
        }
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
  app.post("/api/login/username", (req, res, next) => {
    passport.authenticate("local-username", (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        // Return user without sensitive data
        const { password, securityPassword, ...userWithoutPasswords } = user;
        res.status(200).json(userWithoutPasswords);
      });
    })(req, res, next);
  });

  app.post("/api/login/email", (req, res, next) => {
    passport.authenticate("local-email", (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        // Return user without sensitive data
        const { password, securityPassword, ...userWithoutPasswords } = user;
        res.status(200).json(userWithoutPasswords);
      });
    })(req, res, next);
  });

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
      if (err && err.message) {
        res.status(401).json({ message: err.message });
      } else {
        res.status(401).json({ message: "Invalid phone or password" });
      }
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
      if (err && err.message) {
        res.status(401).json({ message: err.message });
      } else {
        res.status(401).json({ message: "Invalid Telegram ID or password" });
      }
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
