import 'dotenv/config';
import { db } from '../server/db.js';
import { notifications } from '../shared/schema.js';
import { eq, desc } from 'drizzle-orm';

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
  const pathMatch = url.match(/\/api\/notifications(?:\/(\d+))?(?:\/(.+))?/);
  const notificationId = pathMatch?.[1];
  const action = pathMatch?.[2];

  try {
    if (method === 'GET' && !notificationId) {
      // Get user notifications
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, parseInt(userId)))
        .orderBy(desc(notifications.createdAt));

      res.json({ notifications: userNotifications });
    } else if (method === 'POST' && notificationId && action === 'read') {
      // Mark notification as read
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, parseInt(notificationId)));

      res.json({ success: true });
    } else if (method === 'DELETE' && notificationId) {
      // Delete notification
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      await db
        .delete(notifications)
        .where(eq(notifications.id, parseInt(notificationId)));

      res.status(200).json({ message: "Notification deleted successfully" });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Notifications API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
