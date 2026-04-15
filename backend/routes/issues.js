const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const RedmineAPI = require('../services/redmine-api');
const authMiddleware = require('../middleware/auth');

// Tất cả routes cần auth
router.use(authMiddleware);

/**
 * GET /api/issues/sync?ids=1,2,3
 * Lấy thông tin issues từ Redmine + merge dữ liệu mở rộng từ DB
 */
router.get('/sync', async (req, res) => {
    try {
        const { ids } = req.query;
        if (!ids) {
            return res.status(400).json({ error: 'ids parameter is required (comma-separated)' });
        }

        const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (idArray.length === 0) {
            return res.status(400).json({ error: 'No valid IDs provided' });
        }

        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);
        const db = getDb();

        // Lấy issues từ Redmine
        const issues = await redmine.getIssues(idArray);

        // Lấy extension data từ DB
        const placeholders = idArray.map(() => '?').join(',');
        const extensions = db.prepare(
            `SELECT * FROM issue_extensions WHERE user_id = ? AND redmine_issue_id IN (${placeholders})`
        ).all(req.user.id, ...idArray);

        const extMap = {};
        extensions.forEach(ext => { extMap[ext.redmine_issue_id] = ext; });

        // Lấy watch status
        const watches = db.prepare(
            `SELECT redmine_issue_id FROM watches WHERE user_id = ? AND is_active = 1 AND redmine_issue_id IN (${placeholders})`
        ).all(req.user.id, ...idArray);

        const watchSet = new Set(watches.map(w => w.redmine_issue_id));

        // Merge data
        const result = {};
        issues.forEach(issue => {
            result[issue.id] = {
                id: issue.id,
                subject: issue.subject,
                tracker: issue.tracker,
                status: issue.status,
                priority: issue.priority,
                assigned_to: issue.assigned_to || null,
                done_ratio: issue.done_ratio,
                start_date: issue.start_date,
                due_date: issue.due_date,
                estimated_hours: issue.estimated_hours,
                spent_hours: issue.spent_hours || 0,
                project: issue.project,
                parent: issue.parent || null,
                extension: extMap[issue.id] || null,
                watch: watchSet.has(issue.id)
            };
        });

        res.json(result);
    } catch (err) {
        console.error('[Issues] Sync error:', err.message);
        res.status(500).json({ error: 'Failed to sync issues: ' + err.message });
    }
});

/**
 * GET /api/issues/:id
 * Chi tiết 1 issue (Redmine data + extension data + children)
 */
router.get('/:id', async (req, res) => {
    try {
        const issueId = parseInt(req.params.id);
        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);
        const db = getDb();

        const issue = await redmine.getIssue(issueId);

        // Extension data
        const ext = db.prepare(
            'SELECT * FROM issue_extensions WHERE user_id = ? AND redmine_issue_id = ?'
        ).get(req.user.id, issueId);

        // Watch status
        const watch = db.prepare(
            'SELECT id FROM watches WHERE user_id = ? AND redmine_issue_id = ? AND is_active = 1'
        ).get(req.user.id, issueId);

        res.json({
            ...issue,
            extension: ext || null,
            watch: !!watch
        });
    } catch (err) {
        console.error('[Issues] Get error:', err.message);
        res.status(500).json({ error: 'Failed to get issue: ' + err.message });
    }
});

/**
 * GET /api/issues/:id/children
 * Lấy subtasks của issue
 */
router.get('/:id/children', async (req, res) => {
    try {
        const issueId = parseInt(req.params.id);
        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);
        const children = await redmine.getChildren(issueId);
        res.json(children);
    } catch (err) {
        console.error('[Issues] Children error:', err.message);
        res.status(500).json({ error: 'Failed to get children: ' + err.message });
    }
});

/**
 * PUT /api/issues/:id/extension
 * Cập nhật dữ liệu mở rộng (dev_date, release_date, note...)
 */
router.put('/:id/extension', (req, res) => {
    try {
        const issueId = parseInt(req.params.id);
        const db = getDb();
        const data = req.body;

        const existing = db.prepare(
            'SELECT id FROM issue_extensions WHERE user_id = ? AND redmine_issue_id = ?'
        ).get(req.user.id, issueId);

        if (existing) {
            const fields = [];
            const values = [];
            const allowedFields = [
                'plan_release', 'dev_date', 'pre_date', 'release_date',
                'environment', 'extra', 'note', 'is_special_subtask',
                'code_status', 'test_status', 'code_deadline', 'test_deadline'
            ];

            allowedFields.forEach(field => {
                if (data.hasOwnProperty(field)) {
                    fields.push(`${field} = ?`);
                    values.push(data[field]);
                }
            });

            if (fields.length > 0) {
                fields.push("updated_at = datetime('now')");
                values.push(existing.id);
                db.prepare(`UPDATE issue_extensions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
            }
        } else {
            db.prepare(`
                INSERT INTO issue_extensions (user_id, redmine_issue_id, plan_release, dev_date, pre_date, release_date, environment, extra, note, is_special_subtask, code_status, test_status, code_deadline, test_deadline)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                req.user.id, issueId,
                data.plan_release || null, data.dev_date || null,
                data.pre_date || null, data.release_date || null,
                data.environment || null, data.extra || null,
                data.note || null, data.is_special_subtask || 0,
                data.code_status || null, data.test_status || null,
                data.code_deadline || null, data.test_deadline || null
            );
        }

        const result = db.prepare(
            'SELECT * FROM issue_extensions WHERE user_id = ? AND redmine_issue_id = ?'
        ).get(req.user.id, issueId);

        res.json(result);
    } catch (err) {
        console.error('[Issues] Extension update error:', err.message);
        res.status(500).json({ error: 'Failed to update extension: ' + err.message });
    }
});

/**
 * PUT /api/issues/:id/status
 * Cập nhật status, done_ratio trên Redmine
 */
router.put('/:id/status', async (req, res) => {
    try {
        const issueId = parseInt(req.params.id);
        const { status_id, done_ratio, notes } = req.body;
        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);

        const updateData = {};
        if (status_id) updateData.status_id = status_id;
        if (done_ratio !== undefined) updateData.done_ratio = done_ratio;
        if (notes) updateData.notes = notes;

        await redmine.updateIssue(issueId, updateData);

        // Lấy lại issue đã cập nhật
        const updated = await redmine.getIssue(issueId);
        res.json(updated);
    } catch (err) {
        console.error('[Issues] Status update error:', err.message);
        res.status(500).json({ error: 'Failed to update status: ' + err.message });
    }
});

/**
 * POST /api/issues/create-subtask
 * Tạo subtask mới trên Redmine
 */
router.post('/create-subtask', async (req, res) => {
    try {
        const { parent_id, subject, tracker_id, assigned_to_id, priority_id, estimated_hours, start_date, due_date } = req.body;

        if (!parent_id || !subject) {
            return res.status(400).json({ error: 'parent_id and subject are required' });
        }

        const redmine = new RedmineAPI(req.user.redmine_url, req.user.api_key);
        const newIssue = await redmine.createIssue({
            parent_issue_id: parent_id,
            subject,
            tracker_id: tracker_id || 2,
            assigned_to_id,
            priority_id: priority_id || 2,
            estimated_hours,
            start_date,
            due_date
        });

        res.json(newIssue);
    } catch (err) {
        console.error('[Issues] Create subtask error:', err.message);
        res.status(500).json({ error: 'Failed to create subtask: ' + err.message });
    }
});

module.exports = router;
