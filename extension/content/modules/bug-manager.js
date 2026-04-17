/**
 * Module: Bug Manager v3.0
 * - Highlight bugs theo status
 * - Ẩn/hiện non-bug issues, copy bug links
 * - Tô màu spent time report
 * - Filter report (hide closed/done)
 */
window.BugManagerModule = (function() {
    'use strict';

    function init() {
        // 1. Bug highlight trên trang issues list
        var table = $('table.list.issues');
        if (table.length > 0) {
            var bugCount = processBugHighlight(table);
            if (bugCount > 0) {
                addBugMenu(table);
            }
            console.log('[BugManager] Processed ' + bugCount + ' bugs on issues page');
        }

        // 2. Spent time color + Report filter
        processSpentTime();
        processReport();

        // 3. Theo dõi thay đổi DOM (cho trường hợp bảng report load sau khi filter)
        observeDOM();
    }

    // ========================================
    // OBSERVER: theo dõi khi Redmine render bảng mới
    // ========================================
    function observeDOM() {
        var content = document.getElementById('content');
        if (!content) return;

        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.addedNodes.length > 0) {
                    // Khi có element mới được thêm vào, thử chạy lại
                    processSpentTime();
                    processReport();
                }
            });
        });

        observer.observe(content, { childList: true, subtree: true });
    }

    // ========================================
    // 1. Bug Highlight
    // ========================================
    function processBugHighlight(table) {
        var bugCount = 0;

        table.find('tbody tr.issue').each(function() {
            var tr = $(this);

            // Nhận diện Bug qua nhiều cách
            var trackerText = tr.find('td.tracker').text().trim().toLowerCase();
            var isBug = tr.hasClass('tracker-1') || trackerText === 'bug' || trackerText === 'lỗi';

            if (!isBug) return;

            tr.addClass('rh-is-bug');
            bugCount++;

            var status = tr.find('td.status').text().trim().toLowerCase();

            if (status === 'new' || status === 'mới') {
                tr.addClass('rh-bug-new');
            } else if (status === 'in progress' || status === 'đang xử lý' || status === 'assigned') {
                tr.addClass('rh-bug-progress');
            } else if (status === 'resolved' || status === 'đã giải quyết' || status === 'feedback') {
                tr.addClass('rh-bug-resolved');
            } else if (status === 'verified' || status === 'đã xác nhận') {
                tr.addClass('rh-bug-verified');
            } else if (status === 'closed' || status === 'đã đóng' || status === 'rejected') {
                tr.addClass('rh-bug-closed');
            }
        });

        return bugCount;
    }

    // ========================================
    // 2. Bug Menu
    // ========================================
    function addBugMenu(table) {
        var totalBugs = table.find('.rh-is-bug').length;
        var doneBugs = table.find('.rh-bug-verified, .rh-bug-closed').length;
        var resolvedBugs = table.find('.rh-bug-resolved').length;
        var remainBugs = table.find('.rh-bug-new, .rh-bug-progress').length;

        $('#rh-bug-menu').remove();

        var menu = $(
            '<div id="rh-bug-menu" class="rh-bug-menu">' +
                '<div class="rh-bug-menu-header">🐛 Bug Manager</div>' +
                '<div class="rh-bug-menu-body">' +
                    '<div class="rh-bug-menu-row">' +
                        '<a href="javascript:void(0);" id="rh-toggle-nonbug">👁 Ẩn Non-Bug</a>' +
                    '</div>' +
                    '<div class="rh-bug-menu-divider"></div>' +
                    '<div class="rh-bug-menu-row">' +
                        '<a href="javascript:void(0);" class="rh-bug-copy" data-filter="all">📋 Copy All (' + totalBugs + ')</a>' +
                    '</div>' +
                    '<div class="rh-bug-menu-row">' +
                        '<a href="javascript:void(0);" class="rh-bug-copy" data-filter="done">✅ Copy Done (' + doneBugs + ')</a>' +
                    '</div>' +
                    '<div class="rh-bug-menu-row">' +
                        '<a href="javascript:void(0);" class="rh-bug-copy" data-filter="resolved">🔵 Copy Resolved (' + resolvedBugs + ')</a>' +
                    '</div>' +
                    '<div class="rh-bug-menu-row">' +
                        '<a href="javascript:void(0);" class="rh-bug-copy" data-filter="remain">🔴 Copy Remain (' + remainBugs + ')</a>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        $('body').append(menu);

        // Toggle non-bug
        var isHidden = false;
        $('#rh-toggle-nonbug').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            isHidden = !isHidden;
            if (isHidden) {
                table.find('tbody tr.issue').not('.rh-is-bug').addClass('rh-hidden');
                $(this).text('👁 Hiện Non-Bug');
            } else {
                table.find('tbody tr.issue').not('.rh-is-bug').removeClass('rh-hidden');
                $(this).text('👁 Ẩn Non-Bug');
            }
        });

        // Copy bugs
        $('.rh-bug-copy').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var filter = $(this).data('filter');
            var bugs;

            switch(filter) {
                case 'done':     bugs = table.find('.rh-bug-verified, .rh-bug-closed'); break;
                case 'resolved': bugs = table.find('.rh-bug-resolved'); break;
                case 'remain':   bugs = table.find('.rh-bug-new, .rh-bug-progress'); break;
                default:         bugs = table.find('.rh-is-bug');
            }

            var lines = [];
            bugs.each(function() {
                var tr = $(this);
                var subject = tr.find('td.subject a').text().trim();
                var status = tr.find('td.status').text().trim();
                var href = tr.find('td.subject a').attr('href');
                if (href && !href.startsWith('http')) {
                    href = window.location.origin + href;
                }
                lines.push('[' + status + '] ' + subject + '\n' + href);
            });

            if (lines.length > 0) {
                copyText(lines.join('\n\n'));
                showToast('✅ Đã copy ' + lines.length + ' bugs!');
            } else {
                showToast('⚠️ Không có bug nào trong nhóm này', 'warning');
            }
        });
    }

    // ========================================
    // 3. Spent Time Color
    // ========================================
    var spentTimeApplied = false;

    function processSpentTime() {
        if (spentTimeApplied) return;

        // Tìm bảng report trên trang time_entries/report
        // Redmine dùng element .time-report hoặc bảng nằm trong #content có cột giờ
        var reportTable = $('table.time-report');

        // Nếu không tìm thấy qua class, thử tìm qua context URL
        if (reportTable.length === 0 && window.location.href.indexOf('time_entries/report') > -1) {
            // Tìm bảng có header chứa "Tổng cộng" hoặc "Total time"
            $('table').each(function() {
                var t = $(this);
                var headerText = t.find('thead, tr:first').text();
                if (headerText.indexOf('Tổng cộng') > -1 || headerText.indexOf('Total time') > -1 || headerText.indexOf('Total') > -1) {
                    reportTable = t;
                    return false; // break
                }
            });
        }

        if (reportTable.length === 0) return;

        console.log('[BugManager] Found time report table, applying color coding');
        spentTimeApplied = true;

        // Tô màu các ô chứa giờ (format "H:MM" hoặc "HH:MM")
        reportTable.find('td').each(function() {
            var td = $(this);
            var text = td.text().trim();

            // Bỏ qua header, label, và ô trống
            if (!text || td.closest('thead').length > 0) return;
            // Bỏ qua ô chứa link (cột Issue)
            if (td.find('a').length > 0) return;

            // Parse "H:MM" hoặc "HH:MM" format
            var match = text.match(/^(\d+):(\d{2})$/);
            if (!match) return;

            var hours = parseInt(match[1]);
            var minutes = parseInt(match[2]);
            var totalHours = hours + minutes / 60;

            if (totalHours === 0) {
                td.addClass('rh-hours-none');
            } else if (totalHours < 8) {
                td.addClass('rh-hours-low');
            } else {
                td.addClass('rh-hours-high');
            }
        });
    }

    // ========================================
    // 4. Report Filter
    // ========================================
    var reportFilterAdded = false;

    function processReport() {
        if (reportFilterAdded) return;

        // Tìm bảng danh sách time entries
        var table = $('table.list.time-entries');
        if (table.length === 0) return;

        // Kiểm tra xem đã có nút chưa
        if ($('.rh-report-controls').length > 0) return;

        console.log('[BugManager] Adding report filter buttons to time entries');
        reportFilterAdded = true;

        // QUAN TRỌNG: Dùng <a> thay vì <button> để tránh submit form
        var controls = $(
            '<div class="rh-report-controls">' +
                '<a href="javascript:void(0);" class="rh-btn rh-btn-sm" id="rh-hide-closed">🚫 Hide Closed</a>' +
                '<a href="javascript:void(0);" class="rh-btn rh-btn-sm" id="rh-hide-done">📊 Hide Done (100%)</a>' +
            '</div>'
        );

        // Đặt controls TRƯỚC bảng, NGOÀI form
        table.before(controls);

        // Hide Closed
        var closedHidden = false;
        $('#rh-hide-closed').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closedHidden = !closedHidden;
            if (closedHidden) {
                table.find('tbody tr').each(function() {
                    var tr = $(this);
                    if (tr.find('del').length > 0 ||
                        tr.text().toLowerCase().indexOf('closed') > -1 ||
                        tr.text().indexOf('Đã đóng') > -1) {
                        tr.addClass('rh-hidden');
                    }
                });
                $(this).html('👁 Show Closed');
            } else {
                table.find('tbody tr.rh-hidden').removeClass('rh-hidden');
                closedHidden = false;
                $(this).html('🚫 Hide Closed');
            }
            return false;
        });

        // Hide Done 100%
        var doneHidden = false;
        $('#rh-hide-done').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            doneHidden = !doneHidden;
            if (doneHidden) {
                table.find('tbody tr').each(function() {
                    var tr = $(this);
                    if (tr.text().indexOf('100%') > -1) {
                        tr.addClass('rh-hidden');
                    }
                });
                $(this).html('👁 Show Done');
            } else {
                table.find('tbody tr.rh-hidden').removeClass('rh-hidden');
                doneHidden = false;
                $(this).html('📊 Hide Done (100%)');
            }
            return false;
        });
    }

    // ========================================
    // Utilities
    // ========================================
    function copyText(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } catch(e) {
            console.error('[BugManager] Copy failed:', e);
        }
        document.body.removeChild(textarea);
    }

    function showToast(message, type) {
        type = type || 'success';
        $('#rh-toast').remove();

        var toast = $('<div id="rh-toast" class="rh-toast rh-toast-' + type + '">' + message + '</div>');
        $('body').append(toast);

        setTimeout(function() { toast.addClass('rh-toast-show'); }, 10);
        setTimeout(function() {
            toast.removeClass('rh-toast-show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    return { init: init };
})();
