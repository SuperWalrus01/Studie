import { format } from 'date-fns';
import { fetchExams, fetchAllAssignmentComponents, fetchAllTopics } from './database';
import { generateFullSchedulePreview } from './scheduler';

const REMINDER_HOURS = [8, 19] as const; // 8 AM and 7 PM local time
const LAST_SENT_KEY_PREFIX = 'dailySummary.lastSentDate';

function getTodayKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

function getLastSentKey(hour: number): string {
  return `${LAST_SENT_KEY_PREFIX}.${hour}`;
}

function getLatestDueReminderHour(now = new Date()): number | null {
  for (let i = REMINDER_HOURS.length - 1; i >= 0; i -= 1) {
    const hour = REMINDER_HOURS[i];
    const slotTime = new Date(now);
    slotTime.setHours(hour, 0, 0, 0);

    if (now >= slotTime) {
      return hour;
    }
  }

  return null;
}

function getNextReminderDelayMs(now = new Date()): number {
  let nextTimestamp = Number.POSITIVE_INFINITY;

  for (const hour of REMINDER_HOURS) {
    const candidate = new Date(now);
    candidate.setHours(hour, 0, 0, 0);

    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }

    nextTimestamp = Math.min(nextTimestamp, candidate.getTime());
  }

  return Math.max(1000, nextTimestamp - now.getTime());
}

function buildSummaryBody(topicCount: number, openAssignmentCount: number): string {
  if (topicCount === 0 && openAssignmentCount === 0) {
    return 'No tasks due today. You are all caught up.';
  }

  if (topicCount > 0 && openAssignmentCount > 0) {
    return `Today: ${topicCount} study topic(s) and ${openAssignmentCount} open assignment task(s).`;
  }

  if (topicCount > 0) {
    return `Today: ${topicCount} study topic(s) planned.`;
  }

  return `Today: ${openAssignmentCount} open assignment task(s).`;
}

async function sendDailySummaryNotification(reminderHour: number): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const [exams, topics, assignmentParts] = await Promise.all([
    fetchExams(),
    fetchAllTopics(),
    fetchAllAssignmentComponents()
  ]);

  const today = getTodayKey();
  const fullSchedule = generateFullSchedulePreview(exams, topics, today);
  const todaysPlan = fullSchedule.find((plan) => plan.date === today);
  const todayTopicCount = todaysPlan?.topics.length ?? 0;

  const assignmentExamIds = new Set(
    exams
      .filter((exam) => (exam.exam_type || 'written_test') === 'assignment')
      .map((exam) => exam.id)
  );

  const relevantParts = assignmentParts.filter((part) => assignmentExamIds.has(part.exam_id));
  const openParts = relevantParts.filter((part) => part.status !== 'completed');

  const title = 'Daily study summary';
  const body = buildSummaryBody(todayTopicCount, openParts.length);

  new Notification(title, {
    body,
    tag: `daily-summary-reminder-${reminderHour}`
  });

  localStorage.setItem(getLastSentKey(reminderHour), getTodayKey());
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

  const maybeSendDueSummary = async () => {
    const now = new Date();
    const dueHour = getLatestDueReminderHour(now);

    if (dueHour === null) {
      return;
    }

    const today = getTodayKey(now);
    const lastSentDate = localStorage.getItem(getLastSentKey(dueHour));

    if (lastSentDate !== today) {
      await sendDailySummaryNotification(dueHour);
    }
  };

  const scheduleNext = () => {
    const delay = getNextReminderDelayMs();
    timeoutId = window.setTimeout(async () => {
      try {
        const dueHour = getLatestDueReminderHour();

        if (dueHour !== null) {
          const lastSentDate = localStorage.getItem(getLastSentKey(dueHour));
          const today = getTodayKey();

          if (lastSentDate !== today) {
            await sendDailySummaryNotification(dueHour);
          }
        }
      } catch (error) {
        console.error('Daily summary reminder failed:', error);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  void maybeSendDueSummary().catch((error) => {
    console.error('Initial daily summary reminder failed:', error);
  });

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
