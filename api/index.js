// Main API handler for Vercel serverless functions
import 'dotenv/config';

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

  const { url } = req;

  // Health check
  if (url === '/api/health' || url === '/api/') {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'TiBank API is running',
      endpoints: [
        '/api/auth/*',
        '/api/users/*',
        '/api/investments/*',
        '/api/transactions/*',
        '/api/crypto/prices',
        '/api/referrals/*',
        '/api/notifications/*',
        '/api/invite-codes/*',
        '/api/password-reset/*',
        '/api/ranks/*',
        '/api/admin/*'
      ]
    });
    return;
  }

  // Simulate earnings endpoint
  if (url === '/api/simulate-earnings' && req.method === 'POST') {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const dayOfWeek = now.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.json({
        success: false,
        message: "Earnings are only generated on weekdays (Monday to Friday)",
        dailyEarnings: 0,
        isWeekend: true
      });
    }

    // Simulate daily earnings calculation
    const simulatedEarnings = Math.random() * 100; // Random earnings for demo
    
    res.json({
      success: true,
      dailyEarnings: simulatedEarnings,
      message: "Daily earnings simulated successfully"
    });
    return;
  }

  // Verification upload endpoint
  if (url === '/api/verify/upload' && req.method === 'POST') {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    res.status(200).json({ message: "Document uploaded successfully" });
    return;
  }

  // Default response for unmatched routes
  res.status(404).json({ 
    error: 'Route not found',
    message: 'This endpoint is handled by specific serverless functions',
    availableEndpoints: [
      '/api/auth/* -> /api/auth.js',
      '/api/users/* -> /api/users.js',
      '/api/investments/* -> /api/investments.js',
      '/api/transactions/* -> /api/transactions.js',
      '/api/crypto/prices -> /api/crypto/prices.js',
      '/api/referrals/* -> /api/referrals.js',
      '/api/notifications/* -> /api/notifications.js',
      '/api/invite-codes/* -> /api/invite-codes.js',
      '/api/password-reset/* -> /api/password-reset.js',
      '/api/ranks/* -> /api/ranks.js',
      '/api/admin/* -> /api/admin.js'
    ]
  });
}
