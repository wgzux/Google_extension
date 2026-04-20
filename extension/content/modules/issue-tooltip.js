/**
 * Module: Issue Tooltip (Kaizen)
 * Hiển thị cửa sổ popover khi hover lên link issue trên Redmine,
 * tổng hợp thông tin (ID, Status, Parent, Root, Subtasks)
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
        
        // Tạo element tooltip container nếu chưa có
        if ($('#rh-issue-tooltip').length === 0) {
            $('body').append('<div id="rh-issue-tooltip" class="rh-tooltip"></div>');
            currentTooltip = $('#rh-issue-tooltip');
            
            // Ngăn ẩn tooltip khi user di chuột vào trong tooltip
            currentTooltip.on('mouseenter', function() {
                clearTimeout(leaveTimer);
            });
            
            currentTooltip.on('mouseleave', function() {
                scheduleHide();
            });
        } else {
            currentTooltip = $('#rh-issue-tooltip');
        }

        attachEvents();
    }

    function attachEvents() {
        // Lắng nghe sự kiện hover trên các link issue. 
        // Phải dùng body on để bắt cả các link được load động.
        $('body').on('mouseenter', 'a[href*="/issues/"]', function (e) {
            var anchor = $(this);
            var href = anchor.attr('href') || '';
            
            // Parse ID từ URL: /issues/123, /issues/123?..., /issues/123#...
            // Regex: dấu / rồi số, kết thúc bằng end-of-string hoặc ?, #, /
            var match = href.match(/\/issues\/(\d+)(?:[\?\#\/]|$)/);
            if (!match) return; // Không phải link chi tiết issue
            
            var issueId = parseInt(match[1]);
            
            // Bỏ qua nếu link này đang ở TRONG tooltip
            if (anchor.closest('#rh-issue-tooltip').length > 0) return;
            
            // Bỏ qua nếu link chứa icon (ví dụ icon expand) hoặc không có text
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
        leaveTimer = setTimeout(function() {
            hideTooltip();
        }, LEAVE_DELAY);
    }

    function hideTooltip() {
        if (!currentTooltip) return;
        currentTooltip.removeClass('rh-tooltip-visible');
        activeAnchor = null;
    }

    function showTooltip(issueId, anchor) {
        // Hiện khung loading giả hoặc làm trống trước 
        // (Tùy chọn: chỉ làm trống khi sang issue mới)
        currentTooltip.html('<div style="padding: 15px; text-align: center;"><div class="rh-spinner"></div> Đang tải dữ liệu...</div>');
        positionTooltip(anchor);
        currentTooltip.addClass('rh-tooltip-visible');

        // Lấy dữ liệu
        getTooltipData(issueId).then(function(data) {
            // Nếu chuột đã rời sang link khác trong lúc tải thì bỏ qua
            if (!activeAnchor || activeAnchor[0] !== anchor[0]) return;
            
            renderTooltip(data);
            positionTooltip(anchor); // Chỉnh lại vị trí sau khi có content
        }).catch(function(err) {
            if (!activeAnchor || activeAnchor[0] !== anchor[0]) return;
            console.error('[IssueTooltip] Error loading data:', err);
            currentTooltip.html('<div style="padding: 15px; color: #e74c3c;">⚠️ Lỗi tải dữ liệu.</div>');
        });
    }

    function getTooltipData(issueId) {
        return new Promise(function(resolve, reject) {
            var now = Date.now();
            if (cache[issueId] && (now - cache[issueId].timestamp < CACHE_TTL)) {
                return resolve(cache[issueId].data);
            }

            window.RedmineHelper.api('/api/issues/' + issueId + '/tooltip')
                .then(function(data) {
                    cache[issueId] = { data: data, timestamp: Date.now() };
                    resolve(data);
                })
                .catch(reject);
        });
    }

    function renderTooltip(data) {
        var statusColorClass = getStatusClass(data.status ? data.status.name : '');
        var rootHtml = data.root && data.root.id !== data.id ? '<b>Root:</b> <a href="/issues/' + data.root.id + '">#' + data.root.id + '</a> | ' : '';
        var parentHtml = data.parent ? '<b>Parent:</b> <a href="/issues/' + data.parent.id + '">#' + data.parent.id + '</a>' : '';
        if (!parentHtml && rootHtml) rootHtml = rootHtml.replace(' | ', '');
        
        var watcherNames = data.watchers ? data.watchers.map(function(w) { return w.name; }).join(', ') : '';
        
        var html = '<div class="rh-tooltip-header">' +
            '<span class="rh-tooltip-id">ID: ' + data.id + '</span>' +
            '<span class="rh-tooltip-tracker">' + (data.tracker ? data.tracker.name : '') + '</span>' +
            '<span class="rh-tooltip-status ' + statusColorClass + '">' + (data.status ? data.status.name : '') + '</span>' +
        '</div>';

        html += '<div class="rh-tooltip-meta">' +
            '<div class="rh-tooltip-subject">' + escapeHtml(data.subject) + '</div>';
            
        if (rootHtml || parentHtml) {
            html += '<div class="rh-tooltip-info">' + rootHtml + parentHtml + '</div>';
        }
        
        if (data.author) {
            html += '<div class="rh-tooltip-info">👤 <b>Author:</b> ' + escapeHtml(data.author.name) + '</div>';
        }
        
        if (watcherNames) {
            html += '<div class="rh-tooltip-info">👥 <b>Follow Member:</b> ' + escapeHtml(watcherNames) + '</div>';
        }
        html += '</div>';

        // Render bảng Children
        if (data.has_children && data.children && data.children.length > 0) {
            html += '<div class="rh-tooltip-body"><table class="rh-tooltip-table">' +
                '<thead><tr><th>Giai đoạn</th><th>Status</th><th>Start Date</th><th>End Date</th></tr></thead><tbody>';
                
            data.children.forEach(function(child) {
                var childStatusClass = getStatusClass(child.status ? child.status.name : '');
                
                // Format dates
                var startDateHtml = formatDateWithDay(child.start_date);
                var endDateHtml = formatDateWithDay(child.due_date);
                
                // Phân tích extension info (nếu có Plan Release / Actual Dev date)
                if (child.extension) {
                    if (child.extension.plan_release) {
                         startDateHtml = 'Plan: ' + formatDateWithDay(child.extension.plan_release);
                    }
                    if (child.extension.dev_date || child.extension.release_date) {
                         var act = child.extension.release_date || child.extension.dev_date;
                         var isLate = isPastDue(act, child.extension.plan_release || child.due_date);
                         var colorStyle = isLate ? ' style="color:red; font-weight:bold;"' : ' style="font-weight:bold;"';
                         endDateHtml = 'Actual: <span' + colorStyle + '>' + formatDateWithDay(act) + '</span>';
                    }
                } else {
                     // Default logic nếu quá hạn due_date
                     if (isPastDue(null, child.due_date)) {
                         endDateHtml = '<span style="color:red; font-weight:bold;">' + endDateHtml + '</span>';
                     }
                }

                html += '<tr>' +
                    '<td class="rh-td-phase"><a href="/issues/' + child.id + '">' + escapeHtml(child.subject) + '</a></td>' +
                    '<td><span class="rh-status-badge ' + childStatusClass + '">' + escapeHtml(child.status ? child.status.name : '') + '</span></td>' +
                    '<td>' + startDateHtml + '</td>' +
                    '<td>' + endDateHtml + '</td>' +
                '</tr>';
            });
            html += '</tbody></table></div>';
        } else {
            html += '<div class="rh-tooltip-empty">Không có subtask</div>';
        }

        currentTooltip.html(html);
    }

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

        // Mặc định: Bên dưới link, canh giữa
        var top = offset.top + aHeight + 8;
        var left = offset.left + (aWidth / 2) - (tWidth / 2);

        // Tránh tràn bên phải
        if (left + tWidth > scrollLeft + vW - 10) {
            left = scrollLeft + vW - tWidth - 10;
        }
        // Tránh tràn bên trái
        if (left < scrollLeft + 10) {
            left = scrollLeft + 10;
        }
        
        // Nếu tràn xuống dưới mép màn hình, chuyển lên trên link
        if (top + tHeight > scrollTop + vH - 10) {
            top = offset.top - tHeight - 8;
            // Nếu vẫn tràn lên trên cùng, thì giữ ở mép màn hình
            if (top < scrollTop + 10) {
                top = scrollTop + 10;
            }
        }

        currentTooltip.css({
            top: top + 'px',
            left: left + 'px'
        });
    }

    // ====== UTILS ======

    function getStatusClass(statusName) {
        var s = (statusName || '').toLowerCase();
        if (s.indexOf('new') > -1 || s.indexOf('mới') > -1) return 'rh-status-new';
        if (s.indexOf('progress') > -1 || s.indexOf('đang xử lý') > -1 || s.indexOf('assigned') > -1) return 'rh-status-progress';
        if (s.indexOf('resolved') > -1 || s.indexOf('giải quyết') > -1 || s.indexOf('feedback') > -1) return 'rh-status-resolved';
        if (s.indexOf('verified') > -1 || s.indexOf('xác nhận') > -1) return 'rh-status-verified';
        if (s.indexOf('closed') > -1 || s.indexOf('đóng') > -1 || s.indexOf('rejected') > -1) return 'rh-status-closed';
        return 'rh-status-default';
    }

    function formatDateWithDay(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        
        var days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        var dayName = days[d.getDay()];
        
        return yyyy + '-' + mm + '-' + dd + ' (' + dayName + ')';
    }

    function isPastDue(actualDateStr, dueDateStr) {
        if (!dueDateStr) return false;
        var dateToCheck = actualDateStr ? new Date(actualDateStr) : new Date();
        var dueInfo = new Date(dueDateStr);
        
        // Chỉ so sánh ngày, không so sánh giờ
        dateToCheck.setHours(0,0,0,0);
        dueInfo.setHours(0,0,0,0);
        
        return dateToCheck > dueInfo;
    }

    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
             .toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    return {
        init: init
    };
})();
