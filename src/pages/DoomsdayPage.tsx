import { useState, useEffect } from 'react';
import { fetchExams } from '../lib/database';
import type { Exam } from '../types';

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // total seconds remaining
};

function getTimeLeft(examDate: string): TimeLeft {
  const now = new Date().getTime();
  const target = new Date(examDate).getTime();
  const diff = Math.max(0, target - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total: Math.floor(diff / 1000) };
}

function getUrgencyClass(days: number): string {
  if (days <= 1) return 'doom-critical';
  if (days <= 3) return 'doom-danger';
  if (days <= 7) return 'doom-warning';
  return 'doom-safe';
}

export function DoomsdayPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchExams()
      .then((data) => {
        // Show all exams (including opted-out), sorted soonest first
        const upcoming = data
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setExams(upcoming);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Tick every second to update countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="doom-page">
      <div className="doom-header">
        <h1 className="doom-title">☠ DOOMSDAY CLOCK ☠</h1>
        <p className="doom-subtitle">Time remaining until your exams</p>
      </div>

      {exams.length === 0 ? (
        <div className="doom-empty">
          <p>No upcoming exams. You're safe... for now.</p>
        </div>
      ) : (
        <div className="doom-list">
          {exams.map((exam) => {
            const time = getTimeLeft(exam.date);
            const urgency = getUrgencyClass(time.days);
            const isPast = time.total <= 0;

            return (
              <div key={exam.id} className={`doom-card ${urgency}`}>
                <div className="doom-card-name">{exam.name}</div>

                {isPast ? (
                  <div className="doom-card-past">EXAM HAS PASSED</div>
                ) : (
                  <div className="doom-countdown">
                    <div className="doom-unit">
                      <span className="doom-value">{String(time.days).padStart(2, '0')}</span>
                      <span className="doom-label">DAYS</span>
                    </div>
                    <span className="doom-colon">:</span>
                    <div className="doom-unit">
                      <span className="doom-value">{String(time.hours).padStart(2, '0')}</span>
                      <span className="doom-label">HRS</span>
                    </div>
                    <span className="doom-colon">:</span>
                    <div className="doom-unit">
                      <span className="doom-value">{String(time.minutes).padStart(2, '0')}</span>
                      <span className="doom-label">MIN</span>
                    </div>
                    <span className="doom-colon">:</span>
                    <div className="doom-unit">
                      <span className="doom-value doom-seconds">{String(time.seconds).padStart(2, '0')}</span>
                      <span className="doom-label">SEC</span>
                    </div>
                  </div>
                )}

                <div className="doom-date">
                  {new Date(exam.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
