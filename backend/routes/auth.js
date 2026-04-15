const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const RedmineAPI = require('../services/redmine-api');

/**
 * POST /api/auth/register
 * Đăng ký user mới (nhập Redmine URL + API Key)
 */
router.post('/register', async (req, res) => {
    try {
        const { redmine_url, api_key } = req.body;

        if (!redmine_url || !api_key) {
            return res.status(400).json({ error: 'redmine_url and api_key are required' });
        }

        // Verify API key bằng cách gọi Redmine
        const redmine = new RedmineAPI(redmine_url, api_key);
        const currentUser = await redmine.getCurrentUser();

        const db = getDb();

        // Kiểm tra nếu đã có user cho URL này thì update
        const existing = db.prepare('SELECT * FROM users WHERE redmine_url = ?').get(redmine_url);

        let user;
        if (existing) {
            db.prepare(
                'UPDATE users SET api_key = ?, display_name = ?, redmine_user_id = ? WHERE id = ?'
            ).run(api_key, `${currentUser.firstname} ${currentUser.lastname}`, currentUser.id, existing.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
        } else {
            const result = db.prepare(
                'INSERT INTO users (redmine_url, api_key, display_name, redmine_user_id) VALUES (?, ?, ?, ?)'
            ).run(redmine_url, api_key, `${currentUser.firstname} ${currentUser.lastname}`, currentUser.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }

        res.json({
            message: 'Registration successful',
            user: {
                id: user.id,
                redmine_url: user.redmine_url,
                display_name: user.display_name,
                redmine_user_id: user.redmine_user_id
            }
        });
    } catch (err) {
        console.error('[Auth] Register error:', err.message);
        res.status(500).json({ error: 'Failed to verify Redmine connection: ' + err.message });
    }
});

/**
 * GET /api/auth/verify
 * Xác thực connection hiện tại
 */
router.get('/verify', async (req, res) => {
    try {
        const { redmine_url, api_key } = req.query;

        if (!redmine_url || !api_key) {
            return res.status(400).json({ error: 'redmine_url and api_key are required' });
        }

        const redmine = new RedmineAPI(redmine_url, api_key);
        const currentUser = await redmine.getCurrentUser();

        res.json({
            success: true,
            user: {
                id: currentUser.id,
                login: currentUser.login,
                name: `${currentUser.firstname} ${currentUser.lastname}`
            }
        });
    } catch (err) {
        res.status(401).json({ success: false, error: 'Connection failed: ' + err.message });
    }
});

module.exports = router;
