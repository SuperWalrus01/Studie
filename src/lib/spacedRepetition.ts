import { addDays, format } from 'date-fns';
import type { Topic, ReviewRating, SpacedRepetitionUpdate } from '../types';

export function calculateNextReview(
  topic: Topic,
  rating: ReviewRating,
  today: string
): SpacedRepetitionUpdate {
  // First review ever
  if (!topic.last_reviewed) {
    return {
      interval_days: 1,
      ease: 2.5,
      last_reviewed: today,
      next_review: format(addDays(new Date(today), 1), 'yyyy-MM-dd')
    };
  }

  // Subsequent reviews
  let interval = topic.interval_days;
  let ease = topic.ease;

  switch (rating) {
    case 'again':
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
      break;
    case 'hard':
      interval = Math.max(1, interval * 1.2);
      ease = Math.max(1.3, ease - 0.05);
      break;
    case 'good':
      interval = interval * ease;
      break;
    case 'easy':
      interval = interval * (ease + 0.15);
      ease = ease + 0.05;
      break;
  }

  // Round interval to at least 1
  interval = Math.max(1, Math.round(interval));

  return {
    interval_days: interval,
    ease: Math.round(ease * 100) / 100, // Round to 2 decimal places
    last_reviewed: today,
    next_review: format(addDays(new Date(today), interval), 'yyyy-MM-dd')
  };
}
