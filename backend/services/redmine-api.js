/**
 * Redmine REST API wrapper
 * Tất cả giao tiếp với Redmine đều đi qua class này
 */
class RedmineAPI {
    constructor(baseUrl, apiKey) {
        // Loại bỏ trailing slash
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
    }

    /**
     * Gọi Redmine API chung
     */
    async _fetch(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'X-Redmine-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const res = await fetch(url, { ...options, headers });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Redmine API Error ${res.status}: ${text}`);
            }

            // PUT và DELETE trả về 200 nhưng không có body
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await res.json();
            }
            return { success: true };
        } catch (err) {
            console.error(`[RedmineAPI] ${options.method || 'GET'} ${url} failed:`, err.message);
            throw err;
        }
    }

    // ============ AUTH ============

    /** Xác thực API Key, trả về thông tin user hiện tại */
    async getCurrentUser() {
        const data = await this._fetch('/users/current.json');
        return data.user;
    }

    // ============ CONFIG ============

    /** Lấy danh sách trackers */
    async getTrackers() {
        const data = await this._fetch('/trackers.json');
        return data.trackers;
    }

    /** Lấy danh sách issue statuses */
    async getStatuses() {
        const data = await this._fetch('/issue_statuses.json');
        return data.issue_statuses;
    }

    /** Lấy danh sách priorities */
    async getPriorities() {
        const data = await this._fetch('/enumerations/issue_priorities.json');
        return data.issue_priorities;
    }

    /** Lấy danh sách users (cần quyền admin) */
    async getUsers(limit = 100) {
        try {
            const data = await this._fetch(`/users.json?limit=${limit}&status=1`);
            return data.users;
        } catch (err) {
            // Nếu không có quyền admin, trả về array rỗng
            console.warn('[RedmineAPI] Cannot fetch users (admin required):', err.message);
            return [];
        }
    }

    /** Lấy danh sách projects */
    async getProjects(limit = 100) {
        const data = await this._fetch(`/projects.json?limit=${limit}`);
        return data.projects;
    }

    // ============ ISSUES ============

    /** Lấy chi tiết 1 issue */
    async getIssue(id) {
        const data = await this._fetch(`/issues/${id}.json?include=children,journals,watchers`);
        return data.issue;
    }

    /** Lấy nhiều issues cùng lúc (theo danh sách ID) */
    async getIssues(ids) {
        if (!ids || ids.length === 0) return [];

        // Redmine API cho phép filter bằng issue_id
        const idsStr = ids.join(',');
        const data = await this._fetch(
            `/issues.json?issue_id=${idsStr}&status_id=*&limit=100`
        );
        return data.issues;
    }

    /** Lấy subtasks của 1 issue */
    async getChildren(parentId) {
        const data = await this._fetch(
            `/issues.json?parent_id=${parentId}&status_id=*&limit=100`
        );
        return data.issues;
    }

    /** Cập nhật issue trên Redmine */
    async updateIssue(id, issueData) {
        return await this._fetch(`/issues/${id}.json`, {
            method: 'PUT',
            body: JSON.stringify({ issue: issueData })
        });
    }

    /** Tạo issue mới trên Redmine */
    async createIssue(issueData) {
        const data = await this._fetch('/issues.json', {
            method: 'POST',
            body: JSON.stringify({ issue: issueData })
        });
        return data.issue;
    }

    // ============ TIME ENTRIES ============

    /** Lấy time entries cho 1 issue */
    async getTimeEntries(issueId) {
        const data = await this._fetch(`/time_entries.json?issue_id=${issueId}&limit=100`);
        return data.time_entries;
    }
}

module.exports = RedmineAPI;
