const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const RedmineAPI = require('../services/redmine-api');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

/**
 * GET /api/watches
 * Lấy danh sách issue đang watch
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const watches = db.prepare(
            'SELECT * FROM watches WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC'
        ).all(req.user.id);

        res.json(watches);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get watches: ' + err.message });
    }
});

/**
 * POST /api/watches
 * Thêm issue vào watch list
 */
router.post('/', async (req, res) => {
    try {
        const { redmine_issue_id } = req.body;
        if (!redmine_issue_id) {
            return res.status(400).json({ error: 'redmine_issue_id is required' });
        }

        const db = getDb();
        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);

        // Lấy subject từ Redmine
        const issue = await redmine.getIssue(redmine_issue_id);

        // Tìm root parent
        let rootSubject = issue.subject;
        if (issue.parent) {
            try {
                const parent = await redmine.getIssue(issue.parent.id);
                rootSubject = parent.subject;
            } catch { /* ignore */ }
        }

        // Upsert
        db.prepare(`
            INSERT INTO watches (user_id, redmine_issue_id, issue_subject, issue_root, is_active)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(user_id, redmine_issue_id) DO UPDATE SET is_active = 1, issue_subject = excluded.issue_subject
        `).run(req.user.id, redmine_issue_id, issue.subject, rootSubject);

        const watch = db.prepare(
            'SELECT * FROM watches WHERE user_id = ? AND redmine_issue_id = ?'
        ).get(req.user.id, redmine_issue_id);

        res.json(watch);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add watch: ' + err.message });
    }
});

/**
 * DELETE /api/watches/:issueId
 * Bỏ watch issue
 */
router.delete('/:issueId', (req, res) => {
    try {
        const db = getDb();
        db.prepare(
            'UPDATE watches SET is_active = 0 WHERE user_id = ? AND redmine_issue_id = ?'
        ).run(req.user.id, parseInt(req.params.issueId));

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove watch: ' + err.message });
    }
});

module.exports = router;
