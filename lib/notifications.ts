import * as Notifications from 'expo-notifications';

export async function scheduleSessionReminder(
  clientName: string,
  scheduledAt: Date,
  identifier: string,
): Promise<void> {
  const triggerAt = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
  if (triggerAt <= new Date()) return; // less than 1hr away, skip reminder

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const timeStr = scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: '📅 Session in 1 hour',
      body: `Session with ${clientName} starts at ${timeStr}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
    },
  });
}

export async function cancelSessionReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // notification may not exist if it already fired
  }
}
