const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const RedmineAPI = require('../services/redmine-api');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/config/sync
 * Sync trackers, statuses, priorities, users từ Redmine API và cache vào DB
 */
router.get('/sync', authMiddleware, async (req, res) => {
    try {
        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);
        const db = getDb();

        // Lấy dữ liệu từ Redmine
        const [trackers, statuses, priorities, users, projects] = await Promise.all([
            redmine.getTrackers(),
            redmine.getStatuses(),
            redmine.getPriorities(),
            redmine.getUsers(),
            redmine.getProjects()
        ]);

        // Lưu vào settings
        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);

        const saveAll = db.transaction(() => {
            upsert.run('trackers', JSON.stringify(trackers));
            upsert.run('statuses', JSON.stringify(statuses));
            upsert.run('priorities', JSON.stringify(priorities));
            upsert.run('users', JSON.stringify(users));
            upsert.run('projects', JSON.stringify(projects));
        });

        saveAll();

        res.json({
            message: 'Config synced successfully',
            counts: {
                trackers: trackers.length,
                statuses: statuses.length,
                priorities: priorities.length,
                users: users.length,
                projects: projects.length
            }
        });
    } catch (err) {
        console.error('[Config] Sync error:', err.message);
        res.status(500).json({ error: 'Failed to sync config: ' + err.message });
    }
});

/**
 * GET /api/config/store
 * Lấy config đã cache (trackers, statuses, priorities, users)
 */
router.get('/store', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT key, value FROM settings').all();

        const store = {};
        rows.forEach(row => {
            try {
                store[row.key] = JSON.parse(row.value);
            } catch {
                store[row.key] = row.value;
            }
        });

        res.json(store);
    } catch (err) {
        console.error('[Config] Store error:', err.message);
        res.status(500).json({ error: 'Failed to get config store: ' + err.message });
    }
});

module.exports = router;
