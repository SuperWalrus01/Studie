import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { differenceInDays, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { fetchTopicsForExam, createTopic, deleteTopic } from '../lib/database';
import type { Exam, Topic } from '../types';
import { ProgressBar } from '../components/ProgressBar';

export function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState(3);

  useEffect(() => {
    loadData();
  }, [examId]);

  async function loadData() {
    if (!examId) return;
    
    try {
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();
      
      if (examError) throw examError;
      setExam(examData);

      const topicsData = await fetchTopicsForExam(examId);
      setTopics(topicsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicName || !examId) return;
    
    try {
      await createTopic(examId, newTopicName, newTopicDifficulty);
      setNewTopicName('');
      setNewTopicDifficulty(3);
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error creating topic:', error);
    }
  }

  async function handleDeleteTopic(id: string) {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    try {
      await deleteTopic(id);
      loadData();
    } catch (error) {
      console.error('Error deleting topic:', error);
    }
  }

  function getTopicProgress(topic: Topic): number {
    if (!topic.subtopics || topic.subtopics.length === 0) return 0;
    const understood = topic.subtopics.filter(s => s.status === 'understood').length;
    return (understood / topic.subtopics.length) * 100;
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!exam) return <div className="error">Exam not found</div>;

  const daysRemaining = differenceInDays(new Date(exam.date), new Date());

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">← Back to exams</Link>
          <h1>{exam.name}</h1>
          <p className="exam-meta">
            {format(new Date(exam.date), 'MMMM d, yyyy')} 
            <span className={daysRemaining <= 7 ? 'urgent' : ''}>
              {' • '}
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Today!' : 'Past'}
            </span>
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Topic'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateTopic} className="form-inline">
          <input
            type="text"
            placeholder="Topic name"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            required
          />
          <label>
            Difficulty:
            <select
              value={newTopicDifficulty}
              onChange={(e) => setNewTopicDifficulty(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button type="submit">Create</button>
        </form>
      )}

      <div className="topics-list">
        {topics.map(topic => {
          const progress = getTopicProgress(topic);
          const nextReviewDate = topic.next_review ? parseISO(topic.next_review) : null;
          const isDue = nextReviewDate ? differenceInDays(nextReviewDate, new Date()) <= 0 : false;
          
          return (
            <div key={topic.id} className="topic-card">
              <div className="topic-header">
                <Link to={`/topic/${topic.id}`}>
                  <h3>{topic.name}</h3>
                </Link>
                <button onClick={() => handleDeleteTopic(topic.id)} className="delete-btn">×</button>
              </div>
              
              <div className="topic-meta">
                <span>Difficulty: {topic.difficulty}/5</span>
                <span>Confidence: {topic.confidence}/5</span>
                {nextReviewDate && (
                  <span className={isDue ? 'due' : ''}>
                    Next review: {format(nextReviewDate, 'MMM d')}
                    {isDue && ' (Due!)'}
                  </span>
                )}
              </div>
              
              <ProgressBar value={progress} />
              
              {topic.subtopics && topic.subtopics.length > 0 && (
                <p className="subtopic-count">
                  {topic.subtopics.filter(s => s.status === 'understood').length}/{topic.subtopics.length} subtopics understood
                </p>
              )}
            </div>
          );
        })}
      </div>

      {topics.length === 0 && (
        <p className="empty-state">No topics yet. Add one to start studying!</p>
      )}
    </div>
  );
}
