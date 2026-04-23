/**
* Redmine Helper - Main Content Script
* Auto-detects Redmine pages and initializes modules
*/
(function () {
    'use strict';

    // ====== PHÁT HIỆN TRANG REDMINE ======
    function isRedminePage() {
        // Kiểm tra các element đặc trưng của Redmine
        var topMenu = document.getElementById('top-menu');
        var mainMenu = document.getElementById('main-menu');
        var wrapper = document.getElementById('wrapper');

        // Phải có ít nhất 2 trong 3 element đặc trưng
        var score = 0;
        if (topMenu) score++;
        if (mainMenu) score++;
        if (wrapper) score++;

        // Hoặc check body class của Redmine
        var body = document.body;
        if (body && (
            body.classList.contains('controller-issues') ||
            body.classList.contains('controller-projects') ||
            body.classList.contains('controller-timelog') ||
            body.classList.contains('controller-my') ||
            body.classList.contains('controller-welcome')
        )) {
            score++;
        }

        return score >= 2;
    }

    if (!isRedminePage()) {
        return; // Không phải Redmine → dừng ngay
    }

    console.log('[Redmine Helper] ✅ Redmine page detected! Initializing...');

    // ====== HELPER: GỌI BACKEND API QUA BACKGROUND ======
    window.RedmineHelper = {
        /**
         * Gọi API backend thông qua service worker
         */
        api: function (endpoint, options) {
            options = options || {};
            return new Promise(function (resolve, reject) {
                chrome.runtime.sendMessage({
                    action: 'api',
                    endpoint: endpoint,
                    method: options.method || 'GET',
                    body: options.body || null,
                    headers: options.headers || {}
                }, function (response) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response && response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve(response ? response.data : null);
                });
            });
        },

        /**
         * Lấy settings đã lưu
         */
        getSettings: function () {
            return new Promise(function (resolve, reject) {
                chrome.runtime.sendMessage({ action: 'getSettings' }, function (response) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(response || {});
                });
            });
        },

        /**
         * Lấy issue ID từ URL hiện tại
         */
        getCurrentIssueId: function () {
            var match = window.location.pathname.match(/\/issues\/(\d+)/);
            return match ? parseInt(match[1]) : null;
        },

        /**
         * Lấy tất cả issue IDs trên trang hiện tại
         */
        getAllIssueIdsOnPage: function () {
            var ids = [];
            $('a[href*="/issues/"]').each(function () {
                var href = $(this).attr('href');
                var match = href.match(/\/issues\/(\d+)/);
                if (match) {
                    var id = parseInt(match[1]);
                    if (ids.indexOf(id) === -1) {
                        ids.push(id);
                    }
                }
            });
            return ids;
        }
    };

    // ====== KHỞI CHẠY CÁC MODULE ======
    $(function () {
        console.log('[Redmine Helper] 🚀 Running modules...');

        // Khởi chạy các module tính năng
        // if (typeof window.IssueTreeModule !== 'undefined') {
        //     window.IssueTreeModule.init();
        // }

        // if (typeof window.BugManagerModule !== 'undefined') {
        //     window.BugManagerModule.init();
        // }

        if (typeof window.IssueTooltipModule !== 'undefined') {
            window.IssueTooltipModule.init();
        }

        console.log('[Redmine Helper] ✅ All modules loaded.');
    });

})();
