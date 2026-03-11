-- Study Planner Database Schema
-- Run this in your Supabase SQL Editor

-- Create exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create topics table with spaced repetition fields
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5) DEFAULT 3,
  confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5) DEFAULT 1,
  last_reviewed DATE,
  interval_days INTEGER DEFAULT 0,
  ease DECIMAL(4,2) DEFAULT 2.50,
  next_review DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subtopics table
CREATE TABLE subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'understood')) DEFAULT 'not_started',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create review entries table for history tracking
CREATE TABLE review_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  rating TEXT CHECK (rating IN ('again', 'hard', 'good', 'easy')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create past papers table per topic
CREATE TABLE past_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  year INTEGER,
  url TEXT,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_topics_exam_id ON topics(exam_id);
CREATE INDEX idx_topics_next_review ON topics(next_review);
CREATE INDEX idx_subtopics_topic_id ON subtopics(topic_id);
CREATE INDEX idx_review_entries_topic_id ON review_entries(topic_id);
CREATE INDEX idx_review_entries_date ON review_entries(date);
CREATE INDEX idx_past_papers_topic_id ON past_papers(topic_id);

-- Disable RLS for single-user simplicity (enable and add policies if you want multi-user)
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE subtopics DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE past_papers DISABLE ROW LEVEL SECURITY;

-- Insert sample data
INSERT INTO exams (id, name, date) VALUES
  ('11111111-1111-1111-1111-111111111111', 'MA251 Algebra II', '2026-04-15'),
  ('22222222-2222-2222-2222-222222222222', 'CS220 Data Structures', '2026-04-22');

INSERT INTO topics (id, exam_id, name, difficulty, confidence, interval_days, ease) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Linear Transformations', 4, 3, 0, 2.50),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Eigenvalues and Eigenvectors', 5, 2, 0, 2.50),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Vector Spaces', 3, 4, 0, 2.50),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Binary Search Trees', 3, 3, 0, 2.50),
  ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Graph Algorithms', 5, 2, 0, 2.50);

INSERT INTO subtopics (topic_id, name, status) VALUES
  -- Linear Transformations
  ('33333333-3333-3333-3333-333333333333', 'Definition and properties', 'understood'),
  ('33333333-3333-3333-3333-333333333333', 'Matrix representation', 'in_progress'),
  ('33333333-3333-3333-3333-333333333333', 'Kernel and image', 'not_started'),
  -- Eigenvalues
  ('44444444-4444-4444-4444-444444444444', 'Characteristic polynomial', 'in_progress'),
  ('44444444-4444-4444-4444-444444444444', 'Diagonalization', 'not_started'),
  ('44444444-4444-4444-4444-444444444444', 'Applications', 'not_started'),
  -- Vector Spaces
  ('55555555-5555-5555-5555-555555555555', 'Subspaces', 'understood'),
  ('55555555-5555-5555-5555-555555555555', 'Basis and dimension', 'understood'),
  ('55555555-5555-5555-5555-555555555555', 'Linear independence', 'in_progress'),
  -- BST
  ('66666666-6666-6666-6666-666666666666', 'Insert and delete operations', 'understood'),
  ('66666666-6666-6666-6666-666666666666', 'Tree traversals', 'understood'),
  ('66666666-6666-6666-6666-666666666666', 'Balancing (AVL)', 'not_started'),
  -- Graph Algorithms
  ('77777777-7777-7777-7777-777777777777', 'BFS and DFS', 'in_progress'),
  ('77777777-7777-7777-7777-777777777777', 'Dijkstra''s algorithm', 'not_started'),
  ('77777777-7777-7777-7777-777777777777', 'Minimum spanning trees', 'not_started');

INSERT INTO past_papers (topic_id, title, year, url, status) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Algebra II Midterm', 2023, 'https://example.com/ma251-midterm-2023.pdf', 'in_progress'),
  ('33333333-3333-3333-3333-333333333333', 'Algebra II Final', 2022, 'https://example.com/ma251-final-2022.pdf', 'not_started'),
  ('44444444-4444-4444-4444-444444444444', 'Eigenvalues Practice Paper', 2024, NULL, 'not_started'),
  ('66666666-6666-6666-6666-666666666666', 'BST Past Paper', 2021, 'https://example.com/cs220-bst-2021.pdf', 'completed');
