import { processScheduledBroadcasts } from '../../src/services/scheduled-broadcasts';

export default async function handler(req: any, res: any) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await processScheduledBroadcasts();
  res.json({ success: true });
}
