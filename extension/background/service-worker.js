/**
 * Background Service Worker
 * Gọi thẳng Redmine API — không cần backend server
 * Content script bị CORS nên phải đi qua đây
 */

// ====== MESSAGE HANDLER ======
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'api') {
        handleApiRequest(msg)
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({ error: err.message }));
        return true; // Giữ channel mở cho async
    }

    if (msg.action === 'getSettings') {
        chrome.storage.local.get(['redmine_url', 'api_key', 'user_name']).then(sendResponse);
        return true;
    }
});

// ====== ROUTER: map endpoint → Redmine API call ======
async function handleApiRequest(msg) {
    const { redmine_url, api_key } = await chrome.storage.local.get(['redmine_url', 'api_key']);

    if (!redmine_url || !api_key) {
        throw new Error('Chưa cấu hình. Vui lòng mở Popup nhập Redmine URL và API Key.');
    }

    const redmine = new RedmineAPI(redmine_url, api_key);
    const endpoint = msg.endpoint || '';

    // GET /api/issues/:id/tooltip
    const tooltipMatch = endpoint.match(/^\/api\/issues\/(\d+)\/tooltip$/);
    if (tooltipMatch) {
        return await redmine.getTooltipData(parseInt(tooltipMatch[1]));
    }

    // GET /api/issues/:id/children
    const childrenMatch = endpoint.match(/^\/api\/issues\/(\d+)\/children$/);
    if (childrenMatch) {
        return await redmine.getChildren(parseInt(childrenMatch[1]));
    }

    // GET /api/issues/:id
    const issueMatch = endpoint.match(/^\/api\/issues\/(\d+)$/);
    if (issueMatch) {
        return await redmine.getIssue(parseInt(issueMatch[1]));
    }

    throw new Error(`Endpoint không được hỗ trợ: ${endpoint}`);
}

// ====== REDMINE API CLASS ======
class RedmineAPI {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
    }

    async _fetch(path) {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url, {
            headers: {
                'X-Redmine-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Redmine ${res.status}: ${text.slice(0, 200)}`);
        }

        return res.json();
    }

    /** Chi tiết 1 issue (kèm watchers) */
    async getIssue(id) {
        const data = await this._fetch(`/issues/${id}.json?include=children,watchers`);
        return data.issue;
    }

    /** Danh sách subtasks của issue */
    async getChildren(parentId) {
        const data = await this._fetch(`/issues.json?parent_id=${parentId}&status_id=*&limit=100`);
        return data.issues;
    }

    /**
     * Tìm root issue (đi ngược parent chain)
     * Trả về { id, subject } hoặc null nếu issue đã là root
     */
    async getRootIssue(issueId) {
        let currentId = issueId;
        const MAX_DEPTH = 10;

        for (let depth = 0; depth < MAX_DEPTH; depth++) {
            const data = await this._fetch(`/issues/${currentId}.json`);
            const issue = data.issue || data;

            if (!issue.parent) {
                // Chính issue ban đầu là root → không có root khác
                return issue.id === issueId ? null : { id: issue.id, subject: issue.subject };
            }
            currentId = issue.parent.id;
        }

        return null;
    }

    /**
     * Tổng hợp dữ liệu cho tooltip hover
     * Trả về: id, tracker, status, subject, root, parent, author, watchers, children
     */
    async getTooltipData(issueId) {
        // 1. Lấy issue detail (bao gồm watchers)
        const issue = await this.getIssue(issueId);

        // 2. Lấy children (subtasks) — chạy song song với getRootIssue
        const [children, root] = await Promise.allSettled([
            this.getChildren(issueId),
            this.getRootIssue(issueId)
        ]);

        const childList = children.status === 'fulfilled' ? children.value : [];
        const rootIssue = root.status === 'fulfilled' ? root.value : null;

        // 3. Format và sắp xếp children
        const formattedChildren = childList
            .map(child => ({
                id: child.id,
                subject: child.subject,
                tracker: child.tracker,
                status: child.status,
                start_date: child.start_date || null,
                due_date: child.due_date || null,
                done_ratio: child.done_ratio || 0,
                assigned_to: child.assigned_to || null
            }))
            .sort((a, b) => (a.subject || '').localeCompare(b.subject || '', 'vi'));

        return {
            id: issue.id,
            tracker: issue.tracker,
            status: issue.status,
            subject: issue.subject,
            root: rootIssue,
            parent: issue.parent || null,
            author: issue.author || null,
            watchers: issue.watchers || [],
            assigned_to: issue.assigned_to || null,
            start_date: issue.start_date || null,
            due_date: issue.due_date || null,
            done_ratio: issue.done_ratio || 0,
            children: formattedChildren,
            has_children: formattedChildren.length > 0,
            children_count: formattedChildren.length
        };
    }
}
