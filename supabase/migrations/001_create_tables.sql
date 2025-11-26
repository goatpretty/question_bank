-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 专题表
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES topics(id)
);

CREATE INDEX idx_topics_parent ON topics(parent_id);
CREATE INDEX idx_topics_sort ON topics(sort_order);

-- 题目表
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL,
  type VARCHAR(20) CHECK (type IN ('single', 'multiple', 'fill', 'subjective')),
  content TEXT NOT NULL,
  options JSON,
  answer JSON NOT NULL,
  analysis TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  score INTEGER DEFAULT 1,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);

CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);

-- 练习会话表
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_ids JSON NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER DEFAULT 0,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'in_progress',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_practice_user ON practice_sessions(user_id);
CREATE INDEX idx_practice_status ON practice_sessions(status);
CREATE INDEX idx_practice_time ON practice_sessions(start_time);

-- 练习答案表
CREATE TABLE practice_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  question_id UUID NOT NULL,
  user_answer JSON NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES practice_sessions(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE INDEX idx_practice_answer_session ON practice_answers(session_id);
CREATE INDEX idx_practice_answer_question ON practice_answers(question_id);

-- 考试表
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  rules JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exams_active ON exams(is_active);

-- 考试结果表
CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_score INTEGER NOT NULL,
  obtained_score INTEGER NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  detail_report JSON NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_exam_result_exam ON exam_results(exam_id);
CREATE INDEX idx_exam_result_user ON exam_results(user_id);
CREATE INDEX idx_exam_result_time ON exam_results(start_time);

-- 错题表
CREATE TABLE wrong_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  wrong_count INTEGER DEFAULT 1,
  last_wrong_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_mastered BOOLEAN DEFAULT FALSE,
  mastered_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_wrong_user ON wrong_questions(user_id);
CREATE INDEX idx_wrong_question ON wrong_questions(question_id);
CREATE INDEX idx_wrong_mastered ON wrong_questions(is_mastered);