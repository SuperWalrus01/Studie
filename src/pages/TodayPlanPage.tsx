import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { fetchAllTopics, fetchExams, updateTopicAfterReview } from '../lib/database';
import { generateFullSchedulePreview } from '../lib/scheduler';
import type { Topic, ReviewRating } from '../types';
import type { DailyPlan } from '../lib/scheduler';
import { RevisionModal } from '../components/RevisionModal';

export function TodayPlanPage() {
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsData, topicsData] = await Promise.all([fetchExams(), fetchAllTopics()]);

      console.log('[TodayPlanPage] Loaded exams:', examsData);
      console.log('[TodayPlanPage] Loaded topics:', topicsData);

      // Generate full 14-day schedule
      const today = new Date().toISOString().split('T')[0];
      const fullSchedule = generateFullSchedulePreview(examsData, topicsData, today);

      console.log('[TodayPlanPage] Generated schedule:', fullSchedule);

      setTopics(topicsData);
      setDailyPlans(fullSchedule);
      setSelectedDayIndex(0);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevisionComplete(rating: ReviewRating) {
    if (!selectedTopic) return;
    try {
      await updateTopicAfterReview(selectedTopic.id, rating, selectedTopic);
      setSelectedTopic(null);
      loadData();
    } catch (error) {
      console.error('Error completing revision:', error);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  const currentPlan = dailyPlans[selectedDayIndex];
  const baseDate = new Date();

  return (
    <div className="page">
      <div className="page-header">
        <h1>14-Day Study Plan</h1>
        <p className="subtitle">Difficulty-weighted scheduling across exam windows</p>
      </div>

      {/* Day Selection Tabs */}
      <div className="schedule-tabs">
        {Array.from({ length: 14 }).map((_, i) => {
          const tabDate = new Date(baseDate);
          tabDate.setDate(tabDate.getDate() + i);
          const hasPlans = dailyPlans.some(p => p.date === tabDate.toISOString().split('T')[0]);
          const isToday = i === 0;
          const dayLabel = tabDate.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
          
          return (
            <button
              key={i}
              onClick={() => setSelectedDayIndex(i)}
              className={`schedule-tab ${selectedDayIndex === i ? 'active' : ''} ${isToday ? 'today-tab' : ''} ${hasPlans ? 'has-plans' : 'no-plans'}`}
            >
              <span className="day-label">{dayLabel}</span>
              {hasPlans && <span className="plan-indicator">•</span>}
            </button>
          );
        })}
      </div>

      {/* Day Details */}
      <div className="schedule-day-details">
        {currentPlan && currentPlan.topics.length > 0 ? (
          <>
            <div className="day-header">
              <h2>{new Date(currentPlan.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <p>{currentPlan.topics.length} topic(s) recommended for this day</p>
            </div>
            
            <div className="schedule-topics-list">
              {currentPlan.topics.map((scheduledTopic) => {
                const topicObj = topics.find(t => t.id === scheduledTopic.topicId);
                if (!topicObj) return null;
                
                const daysUntilExam = differenceInDays(new Date(scheduledTopic.examId), new Date(currentPlan.date));
                const isUrgent = daysUntilExam <= 7;
                
                return (
                  <div key={scheduledTopic.topicId} className={`schedule-topic-card ${isUrgent ? 'urgent' : ''}`}>
                    <div className="schedule-topic-header">
                      <div>
                        <h3>{scheduledTopic.topicName}</h3>
                        <p className="exam-info">
                          {scheduledTopic.examName} • Difficulty: {scheduledTopic.difficulty}/5
                          {daysUntilExam >= 0 && <span> • {daysUntilExam} days until exam</span>}
                        </p>
                      </div>
                      <button onClick={() => setSelectedTopic(topicObj)} className="primary">
                        Start Session
                      </button>
                    </div>
                    
                    {scheduledTopic.subtopics.length > 0 && (
                      <div className="scheduled-subtopics">
                        <p className="subtopics-label">Focus areas:</p>
                        <ul>
                          {scheduledTopic.subtopics.map(st => (
                            <li key={st.id}>{st.name} <span className="status-badge">{st.status}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <Link to={`/topic/${scheduledTopic.topicId}`} className="view-details">
                      View full topic →
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>No studies scheduled</h2>
            <p>You're all caught up on this day or there are no exams within the 2-week window.</p>
          </div>
        )}
      </div>

      {selectedTopic && (
        <RevisionModal
          topicName={selectedTopic.name}
          examName={selectedTopic.exam?.name}
          onClose={() => setSelectedTopic(null)}
          onComplete={handleRevisionComplete}
        />
      )}
    </div>
  );
}
