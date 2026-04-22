/**
 * Module: Issue Tooltip (Kaizen)
 * Hiển thị cửa sổ popover khi hover lên link issue trên Redmine,
 * tổng hợp thông tin (ID, Status, Parent, Root, Subtasks)
 * Layout: Header 5 dòng có label rõ, bảng subtask 2 cột ngang
 */
window.IssueTooltipModule = (function () {
    'use strict';

    var cache = {};              // { issueId: { data: {}, timestamp: number } }
    var CACHE_TTL = 5 * 60 * 1000; // 5 phút
    var HOVER_DELAY = 400;       // ms delay trước khi gọi API
    var LEAVE_DELAY = 300;       // ms delay trước khi ẩn

    var hoverTimer = null;
    var leaveTimer = null;

    var currentTooltip = null;
    var activeAnchor = null;

    function init() {
        console.log('[IssueTooltip] Initializing...');

        if ($('#rh-issue-tooltip').length === 0) {
            $('body').append('<div id="rh-issue-tooltip" class="rh-tooltip"></div>');
            currentTooltip = $('#rh-issue-tooltip');

            currentTooltip.on('mouseenter', function () {
                clearTimeout(leaveTimer);
            });

            currentTooltip.on('mouseleave', function () {
                scheduleHide();
            });
        } else {
            currentTooltip = $('#rh-issue-tooltip');
        }

        attachEvents();
    }

    function attachEvents() {
        $('body').on('mouseenter', 'a[href*="/issues/"]', function (e) {
            var anchor = $(this);
            var href = anchor.attr('href') || '';

            var match = href.match(/\/issues\/(\d+)(?:[\?\#\/]|$)/);
            if (!match) return;

            var issueId = parseInt(match[1]);

            // Bỏ qua các link thao tác (edit, copy, time entries, etc.)
            if (href.match(/\/(edit|copy|time_entries|watchers|relations)/)) return;

            // Bỏ qua các button thao tác (thường có class icon hoặc nằm trong thanh công cụ .contextual)
            if (anchor.hasClass('icon') || anchor.closest('.contextual').length > 0 || anchor.attr('data-method')) return;

            // Bỏ qua link trong chính tooltip
            if (anchor.closest('#rh-issue-tooltip').length > 0) return;

            // Bỏ qua link chỉ có icon
            if (anchor.children('img, i').length > 0 && anchor.text().trim() === '') return;

            clearTimeout(leaveTimer);

            // Nếu đang hover cùng link + tooltip đang visible → giữ nguyên
            if (activeAnchor && activeAnchor[0] === anchor[0] && currentTooltip.hasClass('rh-tooltip-visible')) {
                return;
            }

            activeAnchor = anchor;
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(function () {
                showTooltip(issueId, anchor);
            }, HOVER_DELAY);
        });

        $('body').on('mouseleave', 'a[href*="/issues/"]', function (e) {
            var anchor = $(this);
            if (activeAnchor && activeAnchor[0] === anchor[0]) {
                clearTimeout(hoverTimer);
                scheduleHide();
            }
        });
    }

    function scheduleHide() {
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(function () {
            hideTooltip();
        }, LEAVE_DELAY);
    }

    function hideTooltip() {
        if (!currentTooltip) return;
        currentTooltip.removeClass('rh-tooltip-visible');
        activeAnchor = null;
    }

    function showTooltip(issueId, anchor) {
        currentTooltip.html('<div style="padding: 15px; text-align: center;"><div class="rh-spinner"></div> Đang tải dữ liệu...</div>');
        positionTooltip(anchor);
        currentTooltip.addClass('rh-tooltip-visible');

        getTooltipData(issueId).then(function (data) {
            if (!activeAnchor || activeAnchor[0] !== anchor[0]) return;
            renderTooltip(data);
            positionTooltip(anchor);
        }).catch(function (err) {
            if (!activeAnchor || activeAnchor[0] !== anchor[0]) return;
            console.error('[IssueTooltip] Error loading data:', err);
            currentTooltip.html('<div style="padding: 15px; color: #e74c3c;">⚠️ Lỗi tải dữ liệu.</div>');
        });
    }

    function getTooltipData(issueId) {
        return new Promise(function (resolve, reject) {
            var now = Date.now();
            if (cache[issueId] && (now - cache[issueId].timestamp < CACHE_TTL)) {
                return resolve(cache[issueId].data);
            }

            window.RedmineHelper.api('/api/issues/' + issueId + '/tooltip')
                .then(function (data) {
                    cache[issueId] = { data: data, timestamp: Date.now() };
                    resolve(data);
                })
                .catch(reject);
        });
    }

    // ====== RENDER TOOLTIP ======
    function renderTooltip(data) {
        var statusName = data.status ? data.status.name : '';
        var trackerName = data.tracker ? data.tracker.name : '';

        // ====== HEADER ======
        // Dòng 1: ID: 95574 - Task - Resolved  (in đậm toàn bộ)
        var html = '<div class="rh-tooltip-header">';
        html += '<div class="rh-th-title">ID: ' + data.id + ' - ' + escapeHtml(trackerName) + ' - ' + escapeHtml(statusName) + '</div>';

        // Dòng 2: Subject: <nội dung>
        html += '<div class="rh-th-row"><span class="rh-th-label">Subject:</span> <span class="rh-th-value">' + escapeHtml(data.subject) + '</span></div>';

        // Dòng 3: Root: X  Parent: Y  (hiện nếu có)
        var hasRoot = data.root && data.root.id && data.root.id !== data.id;
        var hasParent = data.parent && data.parent.id;
        if (hasRoot || hasParent) {
            html += '<div class="rh-th-row">';
            if (hasRoot) html += '<span class="rh-th-label">Root:</span> <a class="rh-th-link" href="/issues/' + data.root.id + '">' + data.root.id + '</a>&nbsp;&nbsp;';
            if (hasParent) html += '<span class="rh-th-label">Parent:</span> <a class="rh-th-link" href="/issues/' + data.parent.id + '">' + data.parent.id + '</a>';
            html += '</div>';
        }

        // Dòng 4: Author: <tên>
        if (data.author) {
            html += '<div class="rh-th-row"><span class="rh-th-label">Author:</span> <span class="rh-th-value">' + escapeHtml(data.author.name) + '</span></div>';
        }

        // Dòng 5: Follow Member: <danh sách>
        var watcherNames = data.watchers ? data.watchers.map(function (w) { return escapeHtml(w.name); }).join(', ') : '';
        if (watcherNames) {
            html += '<div class="rh-th-row"><span class="rh-th-label">Follow Member:</span> <span class="rh-th-value">' + watcherNames + '</span></div>';
        }

        html += '</div>'; // end .rh-tooltip-header

        // ====== BẢNG CHILDREN: 2 CỘT ======
        if (data.has_children && data.children && data.children.length > 0) {
            html += '<div class="rh-tooltip-body"><table class="rh-tooltip-table"><tbody>';

            var children = data.children;
            for (var i = 0; i < children.length; i += 2) {
                var left = children[i];
                var right = children[i + 1] || null;

                var L = buildChildCells(left);
                var R = right ? buildChildCells(right) : null;

                // Mỗi cặp sinh ra 3 hàng (Status / StartDate|Plan / EndDate|Actual)
                // Cột tên phase dùng rowspan=3
                html += '<tr>'
                    + L.nameHtml + L.rows[0]
                    + (R ? R.nameHtml + R.rows[0] : '<td colspan="3" class="rh-td-empty"></td>')
                    + '</tr>';
                html += '<tr>' + L.rows[1] + (R ? R.rows[1] : '') + '</tr>';
                html += '<tr>' + L.rows[2] + (R ? R.rows[2] : '') + '</tr>';

                // Đường kẻ phân cách giữa các cặp (không vẽ sau cặp cuối)
                if (i + 2 < children.length) {
                    html += '<tr class="rh-row-sep"><td colspan="6"></td></tr>';
                }
            }

            html += '</tbody></table></div>';
        } else {
            html += '<div class="rh-tooltip-empty">Không có subtask</div>';
        }

        currentTooltip.html(html);
    }

    /**
     * Tạo HTML cells cho 1 child issue
     * Trả về: { nameHtml, rows: [row1, row2, row3] }
     */
    function buildChildCells(child) {
        var hasExt = !!(child.extension);
        var hasPlan = hasExt && !!child.extension.plan_release;
        var hasActual = hasExt && !!(child.extension.release_date || child.extension.dev_date);

        // Tên phase — rowspan=3 để trải dài cả 3 dòng
        var nameHtml = '<td class="rh-td-phase" rowspan="3">'
            + '<a class="rh-td-phase-link" href="/issues/' + child.id + '">' + escapeHtml(child.subject) + '</a>'
            + '</td>';

        // Row 1: Status
        var statusVal = escapeHtml(child.status ? child.status.name : '-');
        var row1 = '<td class="rh-td-label">Status</td><td class="rh-td-value">' + statusVal + '</td>';

        // Row 2: Start Date hoặc Plan
        var label2, val2;
        if (hasPlan) {
            label2 = 'Plan';
            val2 = formatDateWithDay(child.extension.plan_release);
        } else {
            label2 = 'Start Date';
            val2 = formatDateWithDay(child.start_date);
        }
        var row2 = '<td class="rh-td-label">' + label2 + '</td><td class="rh-td-value">' + val2 + '</td>';

        // Row 3: End Date hoặc Actual
        var label3, val3;
        if (hasActual) {
            var actDate = child.extension.release_date || child.extension.dev_date;
            var planDate = child.extension.plan_release || child.due_date;
            var isLate = isPastDue(actDate, planDate);
            label3 = 'Actual';
            val3 = isLate
                ? '<span class="rh-date-late">' + formatDateWithDay(actDate) + '</span>'
                : formatDateWithDay(actDate);
        } else {
            label3 = 'End Date';
            var endStr = formatDateWithDay(child.due_date);
            val3 = (child.due_date && isPastDue(null, child.due_date))
                ? '<span class="rh-date-late">' + endStr + '</span>'
                : endStr;
        }
        var row3 = '<td class="rh-td-label">' + label3 + '</td><td class="rh-td-value">' + val3 + '</td>';

        return { nameHtml: nameHtml, rows: [row1, row2, row3] };
    }

    // ====== POSITIONING ======
    function positionTooltip(anchor) {
        if (!currentTooltip || !anchor) return;

        var offset = anchor.offset();
        var tWidth = currentTooltip.outerWidth();
        var tHeight = currentTooltip.outerHeight();
        var aWidth = anchor.outerWidth();
        var aHeight = anchor.outerHeight();

        var vW = $(window).width();
        var vH = $(window).height();
        var scrollTop = $(window).scrollTop();
        var scrollLeft = $(window).scrollLeft();

        var top = offset.top + aHeight + 8;
        var left = offset.left + (aWidth / 2) - (tWidth / 2);

        if (left + tWidth > scrollLeft + vW - 10) left = scrollLeft + vW - tWidth - 10;
        if (left < scrollLeft + 10) left = scrollLeft + 10;

        if (top + tHeight > scrollTop + vH - 10) {
            top = offset.top - tHeight - 8;
            if (top < scrollTop + 10) top = scrollTop + 10;
        }

        currentTooltip.css({ top: top + 'px', left: left + 'px' });
    }

    // ====== UTILS ======
    function getStatusClass(statusName) {
        var s = (statusName || '').toLowerCase();
        if (s.indexOf('new') > -1 || s.indexOf('mới') > -1) return 'rh-status-new';
        if (s.indexOf('progress') > -1 || s.indexOf('assigned') > -1) return 'rh-status-progress';
        if (s.indexOf('resolved') > -1 || s.indexOf('feedback') > -1) return 'rh-status-resolved';
        if (s.indexOf('verified') > -1 || s.indexOf('xác nhận') > -1) return 'rh-status-verified';
        if (s.indexOf('closed') > -1 || s.indexOf('rejected') > -1) return 'rh-status-closed';
        return '';
    }

    function formatDateWithDay(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        var days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

        return yyyy + '-' + mm + '-' + dd + ' (' + days[d.getDay()] + ')';
    }

    function isPastDue(actualDateStr, dueDateStr) {
        if (!dueDateStr) return false;
        var dateToCheck = actualDateStr ? new Date(actualDateStr) : new Date();
        var dueInfo = new Date(dueDateStr);
        dateToCheck.setHours(0, 0, 0, 0);
        dueInfo.setHours(0, 0, 0, 0);
        return dateToCheck > dueInfo;
    }

    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    return { init: init };
})();
