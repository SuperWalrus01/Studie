import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import {
  fetchExams,
  createExam,
  updateExamDate,
  deleteExam,
  fetchAllTopics,
  toggleExamOptOut,
  fetchAllAssignmentComponents
} from '../lib/database';
import type { Exam, Topic, ExamType, AssignmentComponent } from '../types';
import { ProgressBar } from '../components/ProgressBar';

export function ExamOverviewPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [assignmentParts, setAssignmentParts] = useState<AssignmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamType, setNewExamType] = useState<ExamType>('written_test');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsData, topicsData, assignmentPartsData] = await Promise.all([
        fetchExams(),
        fetchAllTopics(),
        fetchAllAssignmentComponents()
      ]);
      setExams(examsData);
      setTopics(topicsData);
      setAssignmentParts(assignmentPartsData);
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
      await createExam(newExamName, newExamDate, newExamType);
      setNewExamName('');
      setNewExamDate('');
      setNewExamType('written_test');
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
    const { done, total } = getWrittenPartsStats(examId);
    return total > 0 ? (done / total) * 100 : 0;
  }

  function getWrittenPartsStats(examId: string): { done: number; total: number } {
    const examTopics = topics.filter(t => t.exam_id === examId);
    if (examTopics.length === 0) return { done: 0, total: 0 };
    
    let totalSubtopics = 0;
    let understoodSubtopics = 0;
    
    examTopics.forEach(topic => {
      if (topic.subtopics) {
        totalSubtopics += topic.subtopics.length;
        understoodSubtopics += topic.subtopics.filter(s => s.status === 'understood').length;
      }
    });

    return { done: understoodSubtopics, total: totalSubtopics };
  }

  function getAssignmentPartsStats(examId: string): { done: number; total: number } {
    const parts = assignmentParts.filter((part) => part.exam_id === examId);
    const done = parts.filter((part) => part.status === 'completed').length;
    return { done, total: parts.length };
  }

  function getAssignmentProgress(examId: string): number {
    const { done, total } = getAssignmentPartsStats(examId);
    return total > 0 ? (done / total) * 100 : 0;
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
          <select
            value={newExamType}
            onChange={(e) => setNewExamType(e.target.value as ExamType)}
            aria-label="Exam type"
          >
            <option value="written_test">Written test</option>
            <option value="assignment">Assignment</option>
          </select>
          <button type="submit">Create</button>
        </form>
      )}

      <div className="exam-grid">
        {exams.map(exam => {
          const daysRemaining = getDaysRemaining(exam.date);
          const isUrgent = daysRemaining <= 7;
          const examType = exam.exam_type || 'written_test';
          const isAssignment = examType === 'assignment';
          const writtenStats = getWrittenPartsStats(exam.id);
          const assignmentStats = getAssignmentPartsStats(exam.id);
          const done = isAssignment ? assignmentStats.done : writtenStats.done;
          const total = isAssignment ? assignmentStats.total : writtenStats.total;
          const progress = isAssignment ? getAssignmentProgress(exam.id) : getExamProgress(exam.id);
          
          return (
            <div key={exam.id} className={`exam-card ${isUrgent ? 'urgent' : ''} ${exam.opted_out ? 'opted-out' : ''}`}>
              <div className="exam-card-header">
                <div>
                  <Link to={`/exam/${exam.id}`}>
                    <h3>{exam.name}</h3>
                  </Link>
                  <span className={`exam-type-chip ${isAssignment ? 'assignment' : 'written'}`}>
                    {isAssignment ? 'Assignment' : 'Written test'}
                  </span>
                </div>
                <div className="exam-card-actions">
                  {!isAssignment && (
                    <button 
                      onClick={() => handleToggleOptOut(exam.id, exam.opted_out || false)} 
                      className={`opt-out-btn ${exam.opted_out ? 'opted-out' : ''}`}
                      title={exam.opted_out ? 'Re-enable this exam' : 'Opt out of studying for this exam'}
                    >
                      {exam.opted_out ? '✓' : '○'}
                    </button>
                  )}
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
              <p className="parts-done-summary">{done}/{total} parts done</p>
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
