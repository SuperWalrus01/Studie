import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ExamOverviewPage } from './pages/ExamOverviewPage';
import { ExamDetailPage } from './pages/ExamDetailPage';
import { TopicDetailPage } from './pages/TopicDetailPage';
import { TodayPlanPage } from './pages/TodayPlanPage';
import { CalendarPage } from './pages/CalendarPage';
import { DoomsdayPage } from './pages/DoomsdayPage';
import './App.css';

function App() {
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
