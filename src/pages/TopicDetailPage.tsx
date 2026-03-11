import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { differenceInDays, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  createSubtopic,
  updateSubtopicStatus,
  updateSubtopicNotes,
  deleteSubtopic,
  updateTopicConfidence,
  updateTopicAfterReview,
  fetchPastPapersForTopic,
  createPastPaper,
  updatePastPaperStatus,
  deletePastPaper
} from '../lib/database';
import type { Exam, Topic, Subtopic, ReviewRating, PastPaper } from '../types';
import { RevisionModal } from '../components/RevisionModal';

export function TopicDetailPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [subtopicNoteDrafts, setSubtopicNoteDrafts] = useState<Record<string, string>>({});
  const [newPastPaperTitle, setNewPastPaperTitle] = useState('');
  const [newPastPaperYear, setNewPastPaperYear] = useState('');
  const [newPastPaperUrl, setNewPastPaperUrl] = useState('');

  useEffect(() => {
    loadData();
  }, [topicId]);

  async function loadData() {
    if (!topicId) return;
    
    try {
      const { data: topicData, error: topicError } = await supabase
        .from('topics')
        .select(`
          *,
          exam:exams(*)
        `)
        .eq('id', topicId)
        .single();
      
      if (topicError) throw topicError;
      setTopic(topicData);
      setExam(topicData.exam);

      const { data: subtopicsData, error: subtopicsError } = await supabase
        .from('subtopics')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });
      
      if (subtopicsError) throw subtopicsError;
      setSubtopics(subtopicsData || []);
      const draftMap = (subtopicsData || []).reduce((acc, subtopic) => {
        acc[subtopic.id] = subtopic.notes || '';
        return acc;
      }, {} as Record<string, string>);
      setSubtopicNoteDrafts(draftMap);

      const pastPapersData = await fetchPastPapersForTopic(topicId);
      setPastPapers(pastPapersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSubtopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtopicName || !topicId) return;
    
    try {
      await createSubtopic(topicId, newSubtopicName);
      setNewSubtopicName('');
      loadData();
    } catch (error) {
      console.error('Error creating subtopic:', error);
    }
  }

  async function handleStatusChange(subtopicId: string, status: 'not_started' | 'in_progress' | 'understood') {
    try {
      await updateSubtopicStatus(subtopicId, status);
      loadData();
    } catch (error) {
      console.error('Error updating subtopic:', error);
    }
  }

  async function handleDeleteSubtopic(id: string) {
    try {
      await deleteSubtopic(id);
      loadData();
    } catch (error) {
      console.error('Error deleting subtopic:', error);
    }
  }

  async function handleSaveSubtopicNotes(subtopicId: string) {
    const notes = subtopicNoteDrafts[subtopicId] ?? '';
    try {
      await updateSubtopicNotes(subtopicId, notes);
      setSubtopics((prev) =>
        prev.map((subtopic) =>
          subtopic.id === subtopicId ? { ...subtopic, notes } : subtopic
        )
      );
    } catch (error) {
      console.error('Error saving subtopic notes:', error);
    }
  }

  async function handleConfidenceChange(confidence: number) {
    if (!topicId) return;
    try {
      await updateTopicConfidence(topicId, confidence);
      loadData();
    } catch (error) {
      console.error('Error updating confidence:', error);
    }
  }

  async function handleAddPastPaper(e: React.FormEvent) {
    e.preventDefault();
    if (!topicId || !newPastPaperTitle.trim()) return;

    try {
      const parsedYear = newPastPaperYear ? Number(newPastPaperYear) : undefined;
      await createPastPaper(topicId, newPastPaperTitle.trim(), parsedYear, newPastPaperUrl.trim());
      setNewPastPaperTitle('');
      setNewPastPaperYear('');
      setNewPastPaperUrl('');
      loadData();
    } catch (error) {
      console.error('Error creating past paper:', error);
    }
  }

  async function handlePastPaperStatusChange(
    pastPaperId: string,
    status: 'not_started' | 'in_progress' | 'completed'
  ) {
    try {
      await updatePastPaperStatus(pastPaperId, status);
      loadData();
    } catch (error) {
      console.error('Error updating past paper status:', error);
    }
  }

  async function handleDeletePastPaper(pastPaperId: string) {
    try {
      await deletePastPaper(pastPaperId);
      loadData();
    } catch (error) {
      console.error('Error deleting past paper:', error);
    }
  }

  async function handleRevisionComplete(rating: ReviewRating) {
    if (!topicId || !topic) return;
    try {
      await updateTopicAfterReview(topicId, rating, topic);
      setShowRevisionModal(false);
      loadData();
    } catch (error) {
      console.error('Error completing revision:', error);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!topic || !exam) return <div className="error">Topic not found</div>;

  const daysRemaining = differenceInDays(new Date(exam.date), new Date());
  const nextReviewDate = topic.next_review ? parseISO(topic.next_review) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to={`/exam/${exam.id}`} className="back-link">← Back to {exam.name}</Link>
          <h1>{topic.name}</h1>
          <p className="exam-meta">
            Exam in {daysRemaining > 0 ? `${daysRemaining} days` : daysRemaining === 0 ? 'today' : 'the past'}
          </p>
        </div>
        <button onClick={() => setShowRevisionModal(true)} className="primary">
          Start Revision Session
        </button>
      </div>

      <div className="topic-details">
        <div className="detail-card">
          <h3>Confidence Level</h3>
          <div className="confidence-slider">
            <input
              type="range"
              min="1"
              max="5"
              value={topic.confidence}
              onChange={(e) => handleConfidenceChange(Number(e.target.value))}
            />
            <span className="confidence-value">{topic.confidence}/5</span>
          </div>
        </div>

        <div className="detail-card">
          <h3>Spaced Repetition</h3>
          {topic.last_reviewed ? (
            <>
              <p>Last reviewed: {format(parseISO(topic.last_reviewed), 'MMM d, yyyy')}</p>
              <p>Interval: {topic.interval_days} days</p>
              <p>Ease: {topic.ease.toFixed(2)}</p>
              {nextReviewDate && (
                <p className={differenceInDays(nextReviewDate, new Date()) <= 0 ? 'due' : ''}>
                  Next review: {format(nextReviewDate, 'MMM d, yyyy')}
                </p>
              )}
            </>
          ) : (
            <p>Not reviewed yet</p>
          )}
        </div>
      </div>

      <div className="topic-workspace">
        <div className="subtopics-section">
          <h2>Subtopics</h2>

          <form onSubmit={handleAddSubtopic} className="form-inline">
            <input
              type="text"
              placeholder="Add subtopic..."
              value={newSubtopicName}
              onChange={(e) => setNewSubtopicName(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>

          <div className="subtopics-list">
            {subtopics.map((subtopic) => (
              <div key={subtopic.id} className="subtopic-item">
                <div className="subtopic-top-row">
                  <span className="subtopic-name">{subtopic.name}</span>
                  <div className="subtopic-controls">
                    <select
                      value={subtopic.status}
                      onChange={(e) => handleStatusChange(subtopic.id, e.target.value as any)}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="understood">Understood</option>
                    </select>
                    <button onClick={() => handleDeleteSubtopic(subtopic.id)} className="delete-btn">×</button>
                  </div>
                </div>

                <div className="subtopic-notes">
                  <label htmlFor={`notes-${subtopic.id}`}>Notes</label>
                  <textarea
                    id={`notes-${subtopic.id}`}
                    placeholder="Add notes for this subtopic..."
                    value={subtopicNoteDrafts[subtopic.id] ?? ''}
                    onChange={(e) =>
                      setSubtopicNoteDrafts((prev) => ({
                        ...prev,
                        [subtopic.id]: e.target.value
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSaveSubtopicNotes(subtopic.id)}
                  >
                    Save notes
                  </button>
                </div>
              </div>
            ))}
          </div>

          {subtopics.length === 0 && (
            <p className="empty-state">No subtopics yet. Add some to organize your study!</p>
          )}
        </div>

        <div className="past-papers-section">
          <h2>Past Papers</h2>

          <form onSubmit={handleAddPastPaper} className="form-inline past-paper-form">
            <input
              type="text"
              placeholder="Paper title (e.g. Midterm 2023)"
              value={newPastPaperTitle}
              onChange={(e) => setNewPastPaperTitle(e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Year"
              min="2000"
              max="2100"
              value={newPastPaperYear}
              onChange={(e) => setNewPastPaperYear(e.target.value)}
            />
            <input
              type="url"
              placeholder="Link (optional)"
              value={newPastPaperUrl}
              onChange={(e) => setNewPastPaperUrl(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>

          <div className="past-papers-list">
            {pastPapers.map((paper) => (
              <div key={paper.id} className="past-paper-item">
                <div className="past-paper-info">
                  <p className="past-paper-title">{paper.title}</p>
                  <p className="past-paper-meta">
                    {paper.year ? `Year: ${paper.year}` : 'Year: n/a'}
                    {paper.url && (
                      <>
                        {' • '}
                        <a href={paper.url} target="_blank" rel="noreferrer">Open paper</a>
                      </>
                    )}
                  </p>
                </div>
                <div className="past-paper-controls">
                  <select
                    value={paper.status}
                    onChange={(e) =>
                      handlePastPaperStatusChange(
                        paper.id,
                        e.target.value as 'not_started' | 'in_progress' | 'completed'
                      )
                    }
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button onClick={() => handleDeletePastPaper(paper.id)} className="delete-btn">×</button>
                </div>
              </div>
            ))}
          </div>

          {pastPapers.length === 0 && (
            <p className="empty-state">No past papers yet. Add one for this topic.</p>
          )}
        </div>
      </div>

      {showRevisionModal && (
        <RevisionModal
          topicName={topic.name}
          examName={exam.name}
          onClose={() => setShowRevisionModal(false)}
          onComplete={handleRevisionComplete}
        />
      )}
    </div>
  );
}
