import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ExamOverviewPage } from './pages/ExamOverviewPage';
import { ExamDetailPage } from './pages/ExamDetailPage';
import { TopicDetailPage } from './pages/TopicDetailPage';
import { TodayPlanPage } from './pages/TodayPlanPage';
import { CalendarPage } from './pages/CalendarPage';
import { DoomsdayPage } from './pages/DoomsdayPage';
import { requestNotificationPermission, startDailyAssignmentReminder } from './lib/assignmentNotifications';
import './App.css';

function App() {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  useEffect(() => {
    if (notificationPermission !== 'granted') return;
    return startDailyAssignmentReminder();
  }, [notificationPermission]);

  async function handleEnableNotifications() {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
  }

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <h1 className="logo">Study Planner</h1>
          <div className="nav-links">
            <Link to="/">Exams</Link>
            <Link to="/today">Today's Plan</Link>
            <Link to="/calendar">Calendar</Link>
            <Link to="/doomsday" className="nav-doom">☠ Doomsday</Link>
            {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
              <button
                type="button"
                className="enable-notifications-btn"
                onClick={handleEnableNotifications}
              >
                Enable 8AM & 7PM summary
              </button>
            )}
          </div>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ExamOverviewPage />} />
            <Route path="/exam/:examId" element={<ExamDetailPage />} />
            <Route path="/topic/:topicId" element={<TopicDetailPage />} />
            <Route path="/today" element={<TodayPlanPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/doomsday" element={<DoomsdayPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
