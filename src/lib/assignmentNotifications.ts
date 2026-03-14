import { format } from 'date-fns';
import { fetchExams, fetchAllAssignmentComponents } from './database';

const REMINDER_HOUR = 19; // 7 PM local time
const LAST_SENT_KEY = 'assignmentReminder.lastSentDate';

function getTodayKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

function getNextReminderDelayMs(now = new Date()): number {
  const next = new Date(now);
  next.setHours(REMINDER_HOUR, 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return Math.max(1000, next.getTime() - now.getTime());
}

async function sendAssignmentReminderNotification(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const [exams, assignmentParts] = await Promise.all([
    fetchExams(),
    fetchAllAssignmentComponents()
  ]);

  const assignmentExamIds = new Set(
    exams
      .filter((exam) => (exam.exam_type || 'written_test') === 'assignment')
      .map((exam) => exam.id)
  );

  const relevantParts = assignmentParts.filter((part) => assignmentExamIds.has(part.exam_id));
  const openParts = relevantParts.filter((part) => part.status !== 'completed');

  if (relevantParts.length === 0) {
    return;
  }

  const title = 'Assignment reminder';
  const body =
    openParts.length > 0
      ? `You have ${openParts.length}/${relevantParts.length} task parts still open.`
      : 'Nice work — all assignment task parts are completed.';

  new Notification(title, {
    body,
    tag: 'assignment-daily-reminder'
  });

  localStorage.setItem(LAST_SENT_KEY, getTodayKey());
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  return Notification.requestPermission();
}

export function startDailyAssignmentReminder(): () => void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return () => undefined;
  }

  let timeoutId: number | null = null;

  const scheduleNext = () => {
    const delay = getNextReminderDelayMs();
    timeoutId = window.setTimeout(async () => {
      try {
        const lastSentDate = localStorage.getItem(LAST_SENT_KEY);
        const today = getTodayKey();

        if (lastSentDate !== today) {
          await sendAssignmentReminderNotification();
        }
      } catch (error) {
        console.error('Assignment reminder failed:', error);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();

  return () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

export const assignmentReminderInternals = {
  getNextReminderDelayMs
};
