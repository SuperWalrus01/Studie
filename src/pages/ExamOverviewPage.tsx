import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { fetchExams, createExam, updateExamDate, deleteExam, fetchAllTopics, toggleExamOptOut } from '../lib/database';
import type { Exam, Topic } from '../types';
import { ProgressBar } from '../components/ProgressBar';

export function ExamOverviewPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsData, topicsData] = await Promise.all([
        fetchExams(),
        fetchAllTopics()
      ]);
      setExams(examsData);
      setTopics(topicsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    if (!newExamName || !newExamDate) return;
    
    try {
      await createExam(newExamName, newExamDate);
      setNewExamName('');
      setNewExamDate('');
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error creating exam:', error);
    }
  }

  async function handleDeleteExam(id: string) {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    try {
      await deleteExam(id);
      loadData();
    } catch (error) {
      console.error('Error deleting exam:', error);
    }
  }

  async function handleToggleOptOut(id: string, currentOptedOut: boolean) {
    try {
      await toggleExamOptOut(id, !currentOptedOut);
      loadData();
    } catch (error) {
      console.error('Error toggling opt-out:', error);
    }
  }

  function handleStartEditDate(exam: Exam) {
    setEditingExamId(exam.id);
    setEditingDate(exam.date.split('T')[0]);
  }

  function handleCancelEditDate() {
    setEditingExamId(null);
    setEditingDate('');
  }

  async function handleSaveEditDate(examId: string) {
    if (!editingDate) return;

    try {
      await updateExamDate(examId, editingDate);
      setEditingExamId(null);
      setEditingDate('');
      loadData();
    } catch (error) {
      console.error('Error updating exam date:', error);
    }
  }

  function getExamProgress(examId: string): number {
    const examTopics = topics.filter(t => t.exam_id === examId);
    if (examTopics.length === 0) return 0;
    
    let totalSubtopics = 0;
    let understoodSubtopics = 0;
    
    examTopics.forEach(topic => {
      if (topic.subtopics) {
        totalSubtopics += topic.subtopics.length;
        understoodSubtopics += topic.subtopics.filter(s => s.status === 'understood').length;
      }
    });
    
    return totalSubtopics > 0 ? (understoodSubtopics / totalSubtopics) * 100 : 0;
  }

  function getDaysRemaining(examDate: string): number {
    return differenceInDays(new Date(examDate), new Date());
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Exams</h1>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Exam'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateExam} className="form-inline">
          <input
            type="text"
            placeholder="Exam name"
            value={newExamName}
            onChange={(e) => setNewExamName(e.target.value)}
            required
          />
          <input
            type="date"
            value={newExamDate}
            onChange={(e) => setNewExamDate(e.target.value)}
            required
          />
          <button type="submit">Create</button>
        </form>
      )}

      <div className="exam-grid">
        {exams.map(exam => {
          const daysRemaining = getDaysRemaining(exam.date);
          const progress = getExamProgress(exam.id);
          const isUrgent = daysRemaining <= 7;
          
          return (
            <div key={exam.id} className={`exam-card ${isUrgent ? 'urgent' : ''} ${exam.opted_out ? 'opted-out' : ''}`}>
              <div className="exam-card-header">
                <Link to={`/exam/${exam.id}`}>
                  <h3>{exam.name}</h3>
                </Link>
                <div className="exam-card-actions">
                  <button 
                    onClick={() => handleToggleOptOut(exam.id, exam.opted_out || false)} 
                    className={`opt-out-btn ${exam.opted_out ? 'opted-out' : ''}`}
                    title={exam.opted_out ? 'Re-enable this exam' : 'Opt out of studying for this exam'}
                  >
                    {exam.opted_out ? '✓' : '○'}
                  </button>
                  <button onClick={() => handleDeleteExam(exam.id)} className="delete-btn">×</button>
                </div>
              </div>
              {editingExamId === exam.id ? (
                <div className="exam-date-editor">
                  <input
                    type="date"
                    value={editingDate}
                    onChange={(e) => setEditingDate(e.target.value)}
                  />
                  <button onClick={() => handleSaveEditDate(exam.id)} className="save-date-btn">Save</button>
                  <button onClick={handleCancelEditDate} className="cancel-date-btn">Cancel</button>
                </div>
              ) : (
                <>
                  <p className="exam-date">
                    {format(new Date(exam.date), 'MMM d, yyyy')} 
                    <span className="days-remaining">
                      ({daysRemaining > 0 ? `${daysRemaining} days` : daysRemaining === 0 ? 'Today!' : 'Past'})
                    </span>
                  </p>
                  <button onClick={() => handleStartEditDate(exam)} className="edit-date-btn">Edit date</button>
                </>
              )}
              <ProgressBar value={progress} />
            </div>
          );
        })}
      </div>

      {exams.length === 0 && (
        <p className="empty-state">No exams yet. Add one to get started!</p>
      )}
    </div>
  );
}
