import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { differenceInDays, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  fetchTopicsForExam,
  createTopic,
  deleteTopic,
  fetchExams,
  updateSubtopicStatus,
  fetchAssignmentComponentsForExam,
  createAssignmentComponent,
  updateAssignmentComponentStatus,
  deleteAssignmentComponent,
  transferSubtopicsBetweenWrittenExams
} from '../lib/database';
import { ProgressBar } from '../components/ProgressBar';
import type {
  AssignmentComponent,
  AssignmentPartPriority,
  AssignmentPartStatus,
  Exam,
  Topic
} from '../types';

export function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [components, setComponents] = useState<AssignmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState(3);
  const [writtenSourceExams, setWrittenSourceExams] = useState<Exam[]>([]);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferSourceExamId, setTransferSourceExamId] = useState('');
  const [transferMode, setTransferMode] = useState<'copy' | 'migrate'>('copy');
  const [isTransferring, setIsTransferring] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentDueDate, setNewComponentDueDate] = useState('');
  const [newComponentPriority, setNewComponentPriority] = useState<AssignmentPartPriority>('medium');
  const [newComponentEstimatedMinutes, setNewComponentEstimatedMinutes] = useState('');
  const [newComponentNotes, setNewComponentNotes] = useState('');

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

      const allExams = await fetchExams();
      const otherWrittenExams = allExams.filter(
        (candidateExam) =>
          candidateExam.id !== examId && (candidateExam.exam_type || 'written_test') === 'written_test'
      );
      setWrittenSourceExams(otherWrittenExams);

      const examType = examData.exam_type || 'written_test';
      if (examType === 'assignment') {
        const componentData = await fetchAssignmentComponentsForExam(examId);
        setComponents(componentData);
        setTopics([]);
      } else {
        const topicsData = await fetchTopicsForExam(examId);
        setTopics(topicsData);
        setComponents([]);
      }
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

  async function handleWrittenSubtopicStatusChange(
    subtopicId: string,
    status: 'not_started' | 'in_progress' | 'understood'
  ) {
    const previousTopics = topics;
    setTopics((prev) =>
      prev.map((topic) => ({
        ...topic,
        subtopics: (topic.subtopics || []).map((subtopic) =>
          subtopic.id === subtopicId ? { ...subtopic, status } : subtopic
        )
      }))
    );

    try {
      await updateSubtopicStatus(subtopicId, status);
    } catch (error) {
      console.error('Error updating subtopic status:', error);
      setTopics(previousTopics);
    }
  }

  async function handleCreateComponent(e: React.FormEvent) {
    e.preventDefault();
    if (!examId || !newComponentName.trim()) return;

    try {
      const parsedEstimatedMinutes = newComponentEstimatedMinutes
        ? Number(newComponentEstimatedMinutes)
        : undefined;
      await createAssignmentComponent(
        examId,
        newComponentName.trim(),
        newComponentDueDate || undefined,
        newComponentPriority,
        parsedEstimatedMinutes,
        newComponentNotes.trim() || undefined
      );
      setNewComponentName('');
      setNewComponentDueDate('');
      setNewComponentPriority('medium');
      setNewComponentEstimatedMinutes('');
      setNewComponentNotes('');
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error creating assignment part:', error);
    }
  }

  async function handleUpdateComponentStatus(
    componentId: string,
    status: AssignmentPartStatus
  ) {
    try {
      await updateAssignmentComponentStatus(componentId, status);
      loadData();
    } catch (error) {
      console.error('Error updating assignment part status:', error);
    }
  }

  async function handleDeleteComponent(componentId: string) {
    if (!confirm('Are you sure you want to delete this task part?')) return;
    try {
      await deleteAssignmentComponent(componentId);
      loadData();
    } catch (error) {
      console.error('Error deleting assignment part:', error);
    }
  }

  async function handleTransferSubtopics(e: React.FormEvent) {
    e.preventDefault();
    if (!examId || !transferSourceExamId) return;

    if (transferMode === 'migrate') {
      const shouldContinue = confirm(
        'Migrate will move topics and subtopics from the source exam to this exam. Continue?'
      );
      if (!shouldContinue) return;
    }

    setIsTransferring(true);
    try {
      const result = await transferSubtopicsBetweenWrittenExams(
        transferSourceExamId,
        examId,
        transferMode
      );

      alert(
        `${transferMode === 'copy' ? 'Copied' : 'Migrated'} successfully. ` +
          `${result.topicsCreated} new topics created, ${result.topicsMerged} merged, ` +
          `${result.subtopicsCreated} subtopics added.`
      );

      setShowTransferForm(false);
      setTransferSourceExamId('');
      setTransferMode('copy');
      loadData();
    } catch (error) {
      console.error('Error transferring subtopics:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to transfer subtopics: ${message}`);
    } finally {
      setIsTransferring(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!exam) return <div className="error">Exam not found</div>;

  const daysRemaining = differenceInDays(new Date(exam.date), new Date());
  const isAssignment = (exam.exam_type || 'written_test') === 'assignment';

  function getWrittenExamProgress(): number {
    const subtopics = topics.flatMap((topic) => topic.subtopics || []);
    if (subtopics.length === 0) return 0;

    const totalScore = subtopics.reduce((sum, subtopic) => {
      if (subtopic.status === 'understood') return sum + 1;
      if (subtopic.status === 'in_progress') return sum + 0.5;
      return sum;
    }, 0);

    return (totalScore / subtopics.length) * 100;
  }

  function getAssignmentExamProgress(): number {
    if (components.length === 0) return 0;

    const statusScoreMap: Record<AssignmentPartStatus, number> = {
      not_started: 0,
      in_progress: 0.5,
      blocked: 0,
      ready_for_review: 0.75,
      completed: 1
    };

    const totalScore = components.reduce((sum, component) => sum + statusScoreMap[component.status], 0);
    return (totalScore / components.length) * 100;
  }

  const overallProgress = isAssignment ? getAssignmentExamProgress() : getWrittenExamProgress();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">← Back to exams</Link>
          <h1>{exam.name}</h1>
          <p className="exam-type-label">{isAssignment ? 'Assignment' : 'Written test'}</p>
          <p className="exam-meta">
            {format(new Date(exam.date), 'MMMM d, yyyy')} 
            <span className={daysRemaining <= 7 ? 'urgent' : ''}>
              {' • '}
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Today!' : 'Past'}
            </span>
          </p>
        </div>
        <div className="exam-detail-actions">
          {!isAssignment && (
            <button
              type="button"
              className="secondary"
              onClick={() => setShowTransferForm(!showTransferForm)}
            >
              {showTransferForm ? 'Cancel Transfer' : 'Copy/Migrate Subtopics'}
            </button>
          )}
          <button type="button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : isAssignment ? 'Add Task Part' : 'Add Topic'}
          </button>
        </div>
      </div>

      <div className="exam-top-progress">
        <ProgressBar value={overallProgress} />
      </div>

      {!isAssignment && showTransferForm && (
        <form onSubmit={handleTransferSubtopics} className="form-inline transfer-subtopics-form">
          <select
            value={transferSourceExamId}
            onChange={(e) => setTransferSourceExamId(e.target.value)}
            required
          >
            <option value="">Select source written test</option>
            {writtenSourceExams.map((sourceExam) => (
              <option key={sourceExam.id} value={sourceExam.id}>
                {sourceExam.name}
              </option>
            ))}
          </select>

          <select
            value={transferMode}
            onChange={(e) => setTransferMode(e.target.value as 'copy' | 'migrate')}
          >
            <option value="copy">Copy</option>
            <option value="migrate">Migrate</option>
          </select>

          <button type="submit" disabled={isTransferring || writtenSourceExams.length === 0}>
            {isTransferring ? 'Working...' : transferMode === 'copy' ? 'Copy Now' : 'Migrate Now'}
          </button>

          {writtenSourceExams.length === 0 && (
            <span className="transfer-subtopics-hint">No other written tests available.</span>
          )}
        </form>
      )}

      {showForm && (
        isAssignment ? (
          <form onSubmit={handleCreateComponent} className="form-inline assignment-component-form">
            <input
              type="text"
              placeholder="Task part name"
              value={newComponentName}
              onChange={(e) => setNewComponentName(e.target.value)}
              required
            />
            <input
              type="date"
              value={newComponentDueDate}
              onChange={(e) => setNewComponentDueDate(e.target.value)}
            />
            <select
              value={newComponentPriority}
              onChange={(e) => setNewComponentPriority(e.target.value as AssignmentPartPriority)}
              aria-label="Task part priority"
            >
              <option value="low">Priority: Low</option>
              <option value="medium">Priority: Medium</option>
              <option value="high">Priority: High</option>
            </select>
            <input
              type="number"
              min="0"
              step="5"
              placeholder="Estimated minutes"
              value={newComponentEstimatedMinutes}
              onChange={(e) => setNewComponentEstimatedMinutes(e.target.value)}
            />
            <textarea
              placeholder="Notes (optional)"
              value={newComponentNotes}
              onChange={(e) => setNewComponentNotes(e.target.value)}
              rows={2}
            />
            <button type="submit">Create</button>
          </form>
        ) : (
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
        )
      )}

      {isAssignment ? (
        <>
          <div className="assignment-components-grid">
            {components.map((component) => {
              const dueDate = component.due_date ? parseISO(component.due_date) : null;
              const isDue = dueDate ? differenceInDays(dueDate, new Date()) <= 0 : false;
              return (
                <div key={component.id} className="topic-card assignment-component-card">
                  <div className="topic-header">
                    <h3>{component.name}</h3>
                    <button onClick={() => handleDeleteComponent(component.id)} className="delete-btn">×</button>
                  </div>

                  <div className="topic-meta assignment-component-meta">
                    <span>Priority: {component.priority || 'medium'}</span>
                    {typeof component.estimated_minutes === 'number' && (
                      <span>Est: {component.estimated_minutes} min</span>
                    )}
                    {dueDate && (
                      <span className={isDue ? 'due' : ''}>
                        Due: {format(dueDate, 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>

                  {component.notes && component.notes.trim().length > 0 && (
                    <p className="assignment-part-notes">{component.notes}</p>
                  )}

                  <div className="assignment-component-status">
                    <label htmlFor={`component-status-${component.id}`}>Task part status</label>
                    <select
                      id={`component-status-${component.id}`}
                      value={component.status}
                      onChange={(e) =>
                        handleUpdateComponentStatus(
                          component.id,
                          e.target.value as AssignmentPartStatus
                        )
                      }
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="ready_for_review">Ready for Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {components.length === 0 && (
            <p className="empty-state">No task parts yet. Add one to start tracking this assignment.</p>
          )}
        </>
      ) : (
        <>
          <div className="topics-subtopics-view">
            {topics.map(topic => {
              const nextReviewDate = topic.next_review ? parseISO(topic.next_review) : null;
              const isDue = nextReviewDate ? differenceInDays(nextReviewDate, new Date()) <= 0 : false;

              return (
                <div key={topic.id} className="topic-card combined-topic-card">
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

                  <div className="inline-subtopics">
                    <h4>Subtopics</h4>
                    {topic.subtopics && topic.subtopics.length > 0 ? (
                      <ul>
                        {topic.subtopics.map((subtopic) => (
                          <li key={subtopic.id} className={`status-${subtopic.status}`}>
                            <span className="subtopic-inline-name">{subtopic.name}</span>
                            <select
                              className={`subtopic-inline-status-select status-${subtopic.status}`}
                              value={subtopic.status}
                              onChange={(e) =>
                                handleWrittenSubtopicStatusChange(
                                  subtopic.id,
                                  e.target.value as 'not_started' | 'in_progress' | 'understood'
                                )
                              }
                            >
                              <option value="not_started">Not Started</option>
                              <option value="in_progress">In Progress</option>
                              <option value="understood">Understood</option>
                            </select>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="inline-subtopics-empty">No subtopics yet.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {topics.length === 0 && (
            <p className="empty-state">No topics yet. Add one to start studying!</p>
          )}
        </>
      )}
    </div>
  );
}
