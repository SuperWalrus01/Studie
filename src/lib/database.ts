import { supabase } from './supabase';
import type { Exam, Topic, Subtopic, ReviewEntry, ReviewRating, PastPaper } from '../types';
import { calculateNextReview } from './spacedRepetition.ts';

// Exams
export async function fetchExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('date', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function createExam(name: string, date: string): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .insert({ name, date })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateExamDate(id: string, date: string): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .update({ date })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function toggleExamOptOut(id: string, optedOut: boolean): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .update({ opted_out: optedOut })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Topics
export async function fetchTopicsForExam(examId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select(`
      *,
      subtopics(*)
    `)
    .eq('exam_id', examId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function fetchAllTopics(): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select(`
      *,
      exam:exams(*),
      subtopics(*)
    `)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function createTopic(examId: string, name: string, difficulty: number): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .insert({
      exam_id: examId,
      name,
      difficulty,
      confidence: 1,
      interval_days: 0,
      ease: 2.5
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateTopicConfidence(topicId: string, confidence: number): Promise<void> {
  const { error } = await supabase
    .from('topics')
    .update({ confidence })
    .eq('id', topicId);
  
  if (error) throw error;
}

export async function updateTopicAfterReview(
  topicId: string,
  rating: ReviewRating,
  topic: Topic
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const update = calculateNextReview(topic, rating, today);
  
  // Update topic with new spaced repetition values
  const { error: topicError } = await supabase
    .from('topics')
    .update({
      last_reviewed: update.last_reviewed,
      interval_days: update.interval_days,
      ease: update.ease,
      next_review: update.next_review
    })
    .eq('id', topicId);
  
  if (topicError) throw topicError;
  
  // Log the review
  const { error: reviewError } = await supabase
    .from('review_entries')
    .insert({
      topic_id: topicId,
      date: today,
      rating
    });
  
  if (reviewError) throw reviewError;
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Subtopics
export async function createSubtopic(topicId: string, name: string): Promise<Subtopic> {
  const { data, error } = await supabase
    .from('subtopics')
    .insert({
      topic_id: topicId,
      name,
      status: 'not_started'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateSubtopicStatus(
  subtopicId: string,
  status: 'not_started' | 'in_progress' | 'understood'
): Promise<void> {
  const { error } = await supabase
    .from('subtopics')
    .update({ status })
    .eq('id', subtopicId);
  
  if (error) throw error;
}

export async function updateSubtopicNotes(subtopicId: string, notes: string): Promise<void> {
  // Check if a row already exists for this subtopic
  const { data: existing } = await supabase
    .from('subtopic_notes')
    .select('id')
    .eq('subtopic_id', subtopicId)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update the existing row
    const { error } = await supabase
      .from('subtopic_notes')
      .update({ note: notes })
      .eq('subtopic_id', subtopicId);

    if (error) {
      console.error('Error updating subtopic_notes:', error);
      throw error;
    }
  } else {
    // Insert a new row
    const { error } = await supabase
      .from('subtopic_notes')
      .insert({ subtopic_id: subtopicId, note: notes });

    if (error) {
      console.error('Error inserting subtopic_notes:', error);
      throw error;
    }
  }
}

export async function fetchSubtopicNotes(subtopicIds: string[]): Promise<Record<string, string>> {
  if (subtopicIds.length === 0) return {};

  const { data, error } = await supabase
    .from('subtopic_notes')
    .select('subtopic_id, note')
    .in('subtopic_id', subtopicIds);

  if (error) {
    console.error('Error fetching subtopic_notes:', error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.subtopic_id] = row.note || '';
  }
  return map;
}

export async function deleteSubtopic(id: string): Promise<void> {
  const { error } = await supabase
    .from('subtopics')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Review history
export async function fetchReviewHistory(topicId: string): Promise<ReviewEntry[]> {
  const { data, error } = await supabase
    .from('review_entries')
    .select('*')
    .eq('topic_id', topicId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Past papers
export async function fetchPastPapersForTopic(topicId: string): Promise<PastPaper[]> {
  const { data, error } = await supabase
    .from('past_papers')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPastPaper(
  topicId: string,
  title: string,
  year?: number,
  url?: string
): Promise<PastPaper> {
  const { data, error } = await supabase
    .from('past_papers')
    .insert({
      topic_id: topicId,
      title,
      year: year || null,
      url: url || null,
      status: 'not_started'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePastPaperStatus(
  pastPaperId: string,
  status: 'not_started' | 'in_progress' | 'completed'
): Promise<void> {
  const { error } = await supabase
    .from('past_papers')
    .update({ status })
    .eq('id', pastPaperId);

  if (error) throw error;
}

export async function deletePastPaper(id: string): Promise<void> {
  const { error } = await supabase
    .from('past_papers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
