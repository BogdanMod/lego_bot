import { getProcessingBroadcasts, getScheduledBroadcasts, updateBroadcast } from '../db/broadcasts';
import { processBroadcastAsync } from './broadcast-processor';

export async function processScheduledBroadcasts() {
  const now = new Date();
  const broadcasts = await getScheduledBroadcasts(now);
  const processingBroadcasts = await getProcessingBroadcasts();

  for (const broadcast of broadcasts) {
    await updateBroadcast(broadcast.id, { status: 'processing' });
    processBroadcastAsync(broadcast.id);
  }

  for (const broadcast of processingBroadcasts) {
    processBroadcastAsync(broadcast.id);
  }
}
