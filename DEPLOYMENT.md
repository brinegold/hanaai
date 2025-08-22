# TiBank Vercel Deployment Guide

This guide explains how to deploy the TiBank application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Database**: Set up a PostgreSQL database (recommended: Neon, Supabase, or PlanetScale)
3. **Environment Variables**: Prepare all required environment variables

## Environment Variables

Set these environment variables in your Vercel dashboard:

### Required Variables
```
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-super-secret-session-key-here
NODE_ENV=production
```

### Optional Variables (for full functionality)
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
API_BASE_URL=https://your-app.vercel.app/api
```

## Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from project root**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new one
   - Set environment variables when prompted

### Method 2: GitHub Integration

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Optimize for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

## Database Setup

1. **Run migrations**:
   ```bash
   npm run db:push
   ```

2. **Verify database connection** in your deployed app

## Post-Deployment Checklist

- [ ] Test user registration/login
- [ ] Verify API endpoints work
- [ ] Check database connectivity
- [ ] Test investment functionality
- [ ] Verify email functionality (if configured)
- [ ] Test payment processing (if configured)

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Verify TypeScript compilation
   - Check for missing environment variables

2. **API Errors**:
   - Verify database connection string
   - Check serverless function timeout limits
   - Ensure all environment variables are set

3. **Database Issues**:
   - Verify connection string format
   - Check database permissions
   - Ensure database is accessible from Vercel

### Performance Optimization

- Database queries are optimized for serverless
- Frontend assets are bundled and minified
- Static assets are served via Vercel's CDN
- API routes use serverless functions for scalability

## Monitoring

- Use Vercel Analytics for performance monitoring
- Set up error tracking (Sentry recommended)
- Monitor database performance and connection pooling

## Security Notes

- All sensitive data is stored in environment variables
- Database connections use SSL
- Session management is configured for production
- CORS is properly configured for your domain

## Support

For deployment issues, check:
1. Vercel deployment logs
2. Function logs in Vercel dashboard
3. Database connection logs
4. Browser console for frontend errors
