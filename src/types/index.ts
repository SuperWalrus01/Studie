export type ExamType = 'written_test' | 'assignment';

export interface Exam {
  id: string;
  name: string;
  date: string; // ISO date string
  exam_type?: ExamType;
  opted_out?: boolean; // If true, exam is excluded from study plans
  created_at?: string;
}

export type AssignmentPartStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_review'
  | 'completed';

export type AssignmentPartPriority = 'low' | 'medium' | 'high';

export interface AssignmentComponent {
  id: string;
  exam_id: string;
  name: string;
  notes?: string | null;
  due_date?: string | null;
  priority?: AssignmentPartPriority | null;
  estimated_minutes?: number | null;
  status: AssignmentPartStatus;
  created_at?: string;
}

export interface Topic {
  id: string;
  exam_id: string;
  name: string;
  difficulty: number; // 1-5
  confidence: number; // 1-5
  last_reviewed?: string; // ISO date string or null
  interval_days: number;
  ease: number;
  next_review?: string; // ISO date string or null
  created_at?: string;
  // Relations (populated by joins)
  exam?: Exam;
  subtopics?: Subtopic[];
}

export interface Subtopic {
  id: string;
  topic_id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'understood';
  notes?: string | null;
  created_at?: string;
}

export interface PastPaper {
  id: string;
  topic_id: string;
  title: string;
  year?: number | null;
  url?: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  created_at?: string;
}

export interface ReviewEntry {
  id: string;
  topic_id: string;
  date: string; // ISO date string
  rating: 'again' | 'hard' | 'good' | 'easy';
  created_at?: string;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface SpacedRepetitionUpdate {
  interval_days: number;
  ease: number;
  last_reviewed: string;
  next_review: string;
}
