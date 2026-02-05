-- OpenMax Conversation Memory Database Schema
-- PostgreSQL 12+

-- Create database (run as postgres user)
-- CREATE DATABASE openmax_memory;
-- \c openmax_memory;

-- Create user for application
CREATE USER openmax_user WITH PASSWORD 'OmX_Secure_2026!';

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  session_id UUID NOT NULL UNIQUE,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- Full-text search index for message content
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages USING gin(to_tsvector('english', content));

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE openmax_memory TO openmax_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO openmax_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO openmax_user;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update conversation updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Sample queries for testing:
-- INSERT INTO conversations (user_id, session_id, title) VALUES ('MASTER', gen_random_uuid(), 'Test Conversation');
-- INSERT INTO messages (conversation_id, role, content) VALUES (1, 'user', 'Hello, Orbit!');
-- SELECT * FROM conversations WHERE user_id = 'MASTER' ORDER BY updated_at DESC LIMIT 10;
