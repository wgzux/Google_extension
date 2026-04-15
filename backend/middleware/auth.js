const { getDb } = require('../database/init');

/**
 * Middleware xác thực user đơn giản cho single-user local
 * Lấy user từ header X-User-Id hoặc dùng user đầu tiên trong DB
 */
function authMiddleware(req, res, next) {
    const db = getDb();
    const userId = req.headers['x-user-id'];

    let user;
    if (userId) {
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
        // Single user mode: lấy user đầu tiên
        user = db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get();
    }

    if (!user) {
        return res.status(401).json({ error: 'User not found. Please register first via /api/auth/register' });
    }

    req.user = user;
    next();
}

module.exports = authMiddleware;
