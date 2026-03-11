import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fetchAllTopics, fetchExams } from '../lib/database';
import type { Exam, Topic } from '../types';

type CalendarItem = {
  id: string;
  type: 'exam' | 'review';
  title: string;
  examName?: string;
  topicId?: string;
};

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function CalendarPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsData, topicsData] = await Promise.all([fetchExams(), fetchAllTopics()]);
      setExams(examsData);
      setTopics(topicsData);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  }

  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};

    exams.forEach((exam) => {
      if (!map[exam.date]) map[exam.date] = [];
      map[exam.date].push({
        id: `exam-${exam.id}`,
        type: 'exam',
        title: exam.name
      });
    });

    topics.forEach((topic) => {
      if (!topic.next_review) return;
      if (!map[topic.next_review]) map[topic.next_review] = [];
      map[topic.next_review].push({
        id: `review-${topic.id}`,
        type: 'review',
        title: topic.name,
        examName: topic.exam?.name,
        topicId: topic.id
      });
    });

    return map;
  }, [exams, topics]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNumber = i - firstDayIndex + 1;
    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;

    if (!isCurrentMonth) {
      return { key: `blank-${i}`, isCurrentMonth: false };
    }

    const date = new Date(year, month, dayNumber);
    const dateKey = toDateKey(date);
    const todayKey = toDateKey(new Date());

    return {
      key: dateKey,
      isCurrentMonth: true,
      dayNumber,
      dateKey,
      isToday: dateKey === todayKey,
      items: itemsByDate[dateKey] || []
    };
  });

  function goToPreviousMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page calendar-page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="subtitle">Exams and topic review dates</p>
        </div>
        <div className="calendar-controls">
          <button type="button" className="secondary" onClick={goToPreviousMonth}>←</button>
          <span className="calendar-month-title">{format(currentMonth, 'MMMM yyyy')}</span>
          <button type="button" className="secondary" onClick={goToNextMonth}>→</button>
        </div>
      </div>

      <div className="calendar-grid">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="calendar-weekday">{day}</div>
        ))}

        {cells.map((cell) => {
          if (!cell.isCurrentMonth) {
            return <div key={cell.key} className="calendar-cell calendar-cell-empty" />;
          }

          const visibleItems = (cell.items || []).slice(0, 3);
          const hiddenCount = (cell.items || []).length - visibleItems.length;

          return (
            <div key={cell.key} className={`calendar-cell ${cell.isToday ? 'calendar-cell-today' : ''}`}>
              <div className="calendar-day-number">{cell.dayNumber}</div>

              <div className="calendar-events">
                {visibleItems.map((item) => (
                  item.type === 'review' && item.topicId ? (
                    <Link
                      key={item.id}
                      to={`/topic/${item.topicId}`}
                      className={`calendar-event calendar-event-${item.type}`}
                    >
                      Review: {item.title}
                    </Link>
                  ) : (
                    <div key={item.id} className={`calendar-event calendar-event-${item.type}`}>
                      Exam: {item.title}
                    </div>
                  )
                ))}
                {hiddenCount > 0 && <div className="calendar-more">+{hiddenCount} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
