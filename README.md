# TiBank - Cryptocurrency Investment Platform

A full-stack web application for cryptocurrency investment and trading with referral system, built with React, TypeScript, Express.js, and PostgreSQL.

## 🚀 Features

### Core Functionality
- **User Authentication**: Secure login/registration with password hashing and session management
- **Investment Plans**: Two VIP tiers with different daily return rates (VIP 1: 3%, VIP 2: 1%)
- **Real-time Crypto Prices**: Fetches live cryptocurrency prices from multiple exchanges (Binance, OKX, Huobi, Coinbase)
- **Transaction Management**: Deposit, withdrawal, and profit tracking with transaction history
- **Referral System**: Multi-level referral program with commission tracking
- **Admin Panel**: Administrative controls for user and system management

### User Features
- **Dashboard**: Overview of assets, earnings, and investment performance
- **Profile Management**: Update personal information and account settings
- **Investment Tracking**: Monitor active investments and daily earnings
- **Notification System**: Real-time notifications for transactions and system updates
- **Password Recovery**: Email-based password reset functionality
- **Multi-language Support**: Google Translate integration

## 🏗️ Architecture

### Frontend (`/client`)
- **React 18** with TypeScript
- **Wouter** for routing
- **TanStack Query** for server state management
- **Tailwind CSS** + **Radix UI** for styling and components
- **Framer Motion** for animations
- **React Hook Form** with Zod validation

### Backend (`/server`)
- **Express.js** with TypeScript
- **Passport.js** for authentication
- **Drizzle ORM** with PostgreSQL
- **Nodemailer** for email services
- **Session-based authentication** with express-session

### Database Schema (`/shared`)
Key tables:
- `users` - User accounts with financial data
- `investments` - Investment records and plans
- `transactions` - Financial transaction history
- `referrals` - Referral relationship tracking
- `notifications` - User notification system
- `invite_codes` - Invitation code management

## 🛠️ Tech Stack

**Frontend:**
- React, TypeScript, Vite
- Tailwind CSS, Radix UI, Framer Motion
- TanStack Query, React Hook Form, Zod

**Backend:**
- Node.js, Express.js, TypeScript
- Drizzle ORM, PostgreSQL (Neon)
- Passport.js, Express Session
- Nodemailer, Crypto

**Development:**
- ESBuild, TSX, Drizzle Kit
- PostCSS, Autoprefixer

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tibank-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file with:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   SESSION_SECRET=your_session_secret
   SMTP_HOST=your_smtp_host
   SMTP_PORT=your_smtp_port
   SMTP_USER=your_smtp_username
   SMTP_PASSWORD=your_smtp_password
   APP_URL=your_app_url
   ```

4. **Database Setup**
   ```bash
   npm run db:push
   ```

5. **Development**
   ```bash
   npm run dev
   ```

6. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## 🔧 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Investment
- `GET /api/investment/plans` - Get available investment plans
- `POST /api/investment` - Create new investment
- `GET /api/investment` - Get user investments

### Transactions
- `POST /api/transaction` - Create transaction (deposit/withdrawal)
- `GET /api/transactions` - Get transaction history

### User Management
- `GET /api/account` - Get user account info
- `PATCH /api/account` - Update account information
- `GET /api/profile` - Get user profile with referrals

### Crypto Data
- `GET /api/crypto/prices` - Get real-time cryptocurrency prices

### Referrals
- `GET /api/referrals` - Get user referrals
- `POST /api/invite-code` - Generate invite code
- `POST /api/invite-code/verify` - Verify invite code

## 🔐 Security Features

- **Password Hashing**: Using scrypt with salt
- **Session Management**: Secure session handling
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: Drizzle ORM parameterized queries
- **Rate Limiting**: Investment creation limited to once per 24 hours
- **Authentication Guards**: Protected routes and API endpoints

## 💰 Investment System

### VIP Plans
- **VIP 1**: 3% daily returns, minimum $50 investment
- **VIP 2**: 1% daily returns, minimum $10 investment

### Commission Structure
- Multi-level referral system
- Instant profit calculation on investment creation
- Daily earnings simulation for active investments

## 🚀 Deployment

The application is configured for deployment on platforms like Replit with:
- Production build optimization
- Environment variable configuration
- Database connection pooling
- Static file serving

## 📝 License

MIT License
