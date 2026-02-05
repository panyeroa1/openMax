/**
 * Database Connection Pool
 * PostgreSQL connection for OpenMax conversation memory
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'openmax_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'openmax_memory',
  password: process.env.DB_PASSWORD || 'OmX_Secure_2026!',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Database query helpers
const db = {
  query: (text, params) => pool.query(text, params),

  // Conversations
  async createConversation(userId, sessionId, title = null) {
    const result = await pool.query(
      'INSERT INTO conversations (user_id, session_id, title) VALUES ($1, $2, $3) RETURNING *',
      [userId, sessionId, title]
    );
    return result.rows[0];
  },

  async getConversation(sessionId) {
    const result = await pool.query(
      'SELECT * FROM conversations WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0];
  },

  async getUserConversations(userId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  },

  async updateConversationTitle(sessionId, title) {
    const result = await pool.query(
      'UPDATE conversations SET title = $1, updated_at = NOW() WHERE session_id = $2 RETURNING *',
      [title, sessionId]
    );
    return result.rows[0];
  },

  // Messages
  async addMessage(conversationId, role, content, metadata = {}) {
    const result = await pool.query(
      'INSERT INTO messages (conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [conversationId, role, content, JSON.stringify(metadata)]
    );
    
    // Update conversation's updated_at
    await pool.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [conversationId]
    );
    
    return result.rows[0];
  },

  async getConversationMessages(conversationId, limit = 100) {
    const result = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2',
      [conversationId, limit]
    );
    return result.rows;
  },

  async searchMessages(userId, query, limit = 50) {
    const result = await pool.query(
      `SELECT m.*, c.session_id, c.title 
       FROM messages m 
       JOIN conversations c ON m.conversation_id = c.id 
       WHERE c.user_id = $1 AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $2)
       ORDER BY m.timestamp DESC 
       LIMIT $3`,
      [userId, query, limit]
    );
    return result.rows;
  },

  // Cleanup
  async deleteOldConversations(userId, daysOld = 30) {
    const result = await pool.query(
      `DELETE FROM conversations 
       WHERE user_id = $1 
       AND updated_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`,
      [userId]
    );
    return result.rowCount;
  },
};

module.exports = db;
