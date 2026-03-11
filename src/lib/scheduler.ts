import { differenceInDays, addDays, parseISO } from 'date-fns';
import type { Exam, Topic, Subtopic } from '../types';

/**
 * Represents a single topic scheduled for a day.
 */
export type DailyPlanTopic = {
  topicId: string;
  examId: string;
  topicName: string;
  examName: string;
  difficulty: number;
  subtopics: {
    id: string;
    name: string;
    status: string;
  }[];
};

/**
 * Represents a day's study plan.
 */
export type DailyPlan = {
  date: string;
  topics: DailyPlanTopic[];
};

/**
 * Difficulty-based weights determine how frequently a topic is scheduled.
 * Higher difficulty = more sessions needed during the 14-day window.
 */
function getDifficultyWeight(difficulty: number): number {
  const weights: Record<number, number> = {
    1: 0.5,
    2: 1.0,
    3: 1.3,
    4: 1.7,
    5: 2.0
  };
  return weights[difficulty] ?? 1.0;
}

/**
 * Compute target number of sessions for a topic over the 14-day window.
 * Base: 3 sessions per topic, scaled by difficulty weight.
 * Adjust baseSessionsPerTopic to change how often topics appear overall.
 */
function computeTargetSessions(difficulty: number): number {
  const baseSessionsPerTopic = 3;
  const weight = getDifficultyWeight(difficulty);
  return Math.round(baseSessionsPerTopic * weight);
}

/**
 * Count how many times a topic has already been scheduled across all previous plans.
 */
function countAssignedSessionsFromHistory(
  topicId: string,
  previousPlans: DailyPlan[]
): number {
  let count = 0;
  for (const plan of previousPlans) {
    for (const topic of plan.topics) {
      if (topic.topicId === topicId) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Get topics that were studied yesterday, to avoid repetition.
 */
function getYesterdayTopics(
  todayString: string,
  previousPlans: DailyPlan[]
): Set<string> {
  const today = parseISO(todayString);
  const yesterday = addDays(today, -1);
  const yesterdayString = yesterday.toISOString().split('T')[0];

  const yesterdayPlan = previousPlans.find((p) => p.date === yesterdayString);
  if (!yesterdayPlan) {
    return new Set();
  }

  return new Set(yesterdayPlan.topics.map((t) => t.topicId));
}

/**
 * Determine if a topic is fully mastered.
 * A topic is considered mastered if confidence is 5 AND all subtopics are "understood".
 */
function isTopicMastered(topic: Topic): boolean {
  const allSubtopicsUnderstood =
    topic.subtopics && topic.subtopics.length > 0
      ? topic.subtopics.every((s) => s.status === 'understood')
      : true; // No subtopics = consider it understood

  return topic.confidence === 5 && allSubtopicsUnderstood;
}

/**
 * Get candidate topics (not fully mastered) for exams within 14 days.
 */
function getCandidateTopics(
  exams: Exam[],
  topics: Topic[],
  today: Date
): Array<
  Topic & {
    exam: Exam;
    daysUntilExam: number;
  }
> {
  const candidates: Array<
    Topic & {
      exam: Exam;
      daysUntilExam: number;
    }
  > = [];

  // Filter exams within 14 days (and not opted out)
  const relevantExams = exams.filter((exam) => {
    const daysUntil = differenceInDays(parseISO(exam.date), today);
    return !exam.opted_out && daysUntil >= 0 && daysUntil <= 14;
  });

  // Collect topics for those exams that aren't fully mastered
  for (const exam of relevantExams) {
    const examTopics = topics.filter((t) => t.exam_id === exam.id);
    const daysUntilExam = differenceInDays(parseISO(exam.date), today);

    for (const topic of examTopics) {
      if (!isTopicMastered(topic)) {
        candidates.push({
          ...topic,
          exam,
          daysUntilExam
        });
      }
    }
  }

  return candidates;
}

/**
 * Score a topic based on:
 * 1. Exam proximity (sooner exams = higher priority)
 * 2. Remaining sessions needed (topics needing more sessions = higher priority)
 * 3. Difficulty (harder topics = higher priority)
 *
 * Adjust weights in the final calculation to change scheduling behavior.
 */
function scoreTopicForSelection(
  topic: Topic & { exam: Exam; daysUntilExam: number },
  assignedSessions: number
): number {
  const targetSessions = computeTargetSessions(topic.difficulty);
  const remainingSessions = Math.max(0, targetSessions - assignedSessions);

  // Exam proximity score: prioritize exams with fewer days left (scale: 0-100)
  // A topic 0 days from exam gets 100, a topic 14 days away gets 2
  const examProximityScore = Math.max(0, 100 - topic.daysUntilExam * 7);

  // Remaining sessions score: prioritize topics needing more sessions (scale: 0-100)
  // Scale: each remaining session is worth ~20 points (so up to 100 for 5+ remaining)
  const remainingSessionsScore = Math.min(100, remainingSessions * 20);

  // Difficulty score: scale to 0-100 based on difficulty 1-5
  const difficultyScore = (topic.difficulty / 5) * 100;

  // Weighted combination
  // - Exam proximity: 40% - most important, don't miss exams
  // - Remaining sessions: 40% - distribute sessions fairly
  // - Difficulty: 20% - still prioritize harder topics
  const score =
    examProximityScore * 0.4 +
    remainingSessionsScore * 0.4 +
    difficultyScore * 0.2;

  return score;
}

/**
 * Select subtopics for a topic:
 * - If ≤4 subtopics: include all
 * - If >4: include ceil(count/2), prioritizing not_started > in_progress > understood
 */
function selectSubtopicsForToday(subtopics: Subtopic[]): Subtopic[] {
  if (subtopics.length <= 4) {
    return subtopics;
  }

  // Prioritize by status
  const statusPriority = {
    not_started: 0,
    in_progress: 1,
    understood: 2
  };

  const sorted = [...subtopics].sort((a, b) => {
    const priorityA = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
    const priorityB = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
    return priorityA - priorityB;
  });

  const selectCount = Math.ceil(subtopics.length / 2);
  return sorted.slice(0, selectCount);
}

/**
 * Main function: Generate today's study plan.
 *
 * @param exams - All exams
 * @param topics - All topics with their subtopics
 * @param todayString - ISO date string for today (e.g., '2026-03-11')
 * @param previousPlans - History of all previous daily plans (for session counting and avoiding yesterday's topics)
 * @returns A DailyPlan for today with ~2 topics and their selected subtopics
 *
 * Algorithm:
 * 1. Collect candidate topics: not fully mastered, exams within 14 days
 * 2. Get yesterday's topics to avoid repeating the same topic on consecutive days
 * 3. Score candidates based on exam proximity, remaining sessions, and difficulty
 * 4. Prefer topics not studied yesterday; use fallback if needed
 * 5. Select ~2 topics for today
 * 6. For each topic, select subtopics (all if ≤4, ceil(count/2) if >4)
 * 7. Return the daily plan
 */
export function generateDailyPlan(
  exams: Exam[],
  topics: Topic[],
  todayString: string,
  previousPlans: DailyPlan[] = []
): DailyPlan {
  const today = parseISO(todayString);

  // Step 1: Get candidate topics (not fully mastered, exams within 14 days)
  const candidates = getCandidateTopics(exams, topics, today);

  if (candidates.length === 0) {
    // No topics to study
    return { date: todayString, topics: [] };
  }

  // Step 2: Get yesterday's topics to avoid repetition
  const yesterdayTopicIds = getYesterdayTopics(todayString, previousPlans);

  // Step 3: Score all candidates and separate into preferred (not yesterday) and fallback (yesterday)
  const candidatesWithScores = candidates.map((topic) => {
    const assignedSessions = countAssignedSessionsFromHistory(topic.id, previousPlans);
    const score = scoreTopicForSelection(topic, assignedSessions);
    const isFromYesterday = yesterdayTopicIds.has(topic.id);

    return { topic, score, isFromYesterday, assignedSessions };
  });

  // Separate into preferred and fallback
  const preferred = candidatesWithScores.filter((c) => !c.isFromYesterday);
  const fallback = candidatesWithScores.filter((c) => c.isFromYesterday);

  // Sort by score (descending)
  preferred.sort((a, b) => b.score - a.score);
  fallback.sort((a, b) => b.score - a.score);

  // Step 4: Select approximately 2 topics
  const targetTopicCount = 2;
  const selectedEntries: typeof candidatesWithScores = [];

  // First, add from preferred list
  for (const entry of preferred) {
    if (selectedEntries.length >= targetTopicCount) break;
    selectedEntries.push(entry);
  }

  // If we don't have enough, add from fallback (yesterday's topics as last resort)
  if (selectedEntries.length < targetTopicCount) {
    for (const entry of fallback) {
      if (selectedEntries.length >= targetTopicCount) break;
      selectedEntries.push(entry);
    }
  }

  // Step 5: Build the daily plan with selected topics and subtopics
  const dailyTopics: DailyPlanTopic[] = selectedEntries.map((entry) => {
    const { topic } = entry;
    const selectedSubtopics = selectSubtopicsForToday(topic.subtopics || []);

    return {
      topicId: topic.id,
      examId: topic.exam_id,
      topicName: topic.name,
      examName: topic.exam?.name || 'Unknown Exam',
      difficulty: topic.difficulty,
      subtopics: selectedSubtopics.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status
      }))
    };
  });

  return {
    date: todayString,
    topics: dailyTopics
  };
}

/**
 * Generate a full 14-day schedule preview.
 * This generates a plan for each of the next 14 days, accumulating history as it goes.
 * Each day's plan is aware of previous days, so it avoids repeating topics and
 * properly tracks how many sessions each topic has been assigned.
 *
 * Useful for showing the user their full study plan ahead of time.
 */
export function generateFullSchedulePreview(
  exams: Exam[],
  topics: Topic[],
  todayString: string
): DailyPlan[] {
  const allPlans: DailyPlan[] = [];
  const today = parseISO(todayString);

  for (let i = 0; i < 14; i++) {
    const currentDate = addDays(today, i);
    const dateStr = currentDate.toISOString().split('T')[0];

    // Generate plan for this day, passing all previous plans as history
    // This ensures the scheduler is aware of what was studied before
    const plan = generateDailyPlan(exams, topics, dateStr, allPlans);

    if (plan.topics.length > 0) {
      allPlans.push(plan);
    }
  }

  return allPlans;
}
