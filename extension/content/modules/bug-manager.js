/**
 * Module: Bug Manager
 * Highlight bugs theo status, ẩn/hiện non-bug issues, copy bug links
 */
window.BugManagerModule = (function() {
    'use strict';

    function init() {
        var table = $('.list.issues');
        if (table.length === 0) {
            return; // Không có danh sách issue trên trang
        }

        var bugCount = processBugHighlight(table);

        if (bugCount > 0) {
            addBugMenu(table);
        }

        // Spent time color coding (luôn chạy nếu có bảng time report)
        processSpentTime();

        // Report filter buttons
        processReport();

        console.log('[BugManager] Processed ' + bugCount + ' bugs');
    }

    /**
     * Tìm và highlight các issue là Bug
     */
    function processBugHighlight(table) {
        var bugCount = 0;

        table.find('tbody tr').each(function() {
            var tr = $(this);
            var tracker = tr.find('td.tracker').text().trim();
            var status = tr.find('td.status').text().trim().toLowerCase();
            var subject = tr.find('td.subject a').text().trim();

            // Phát hiện bug bằng tracker hoặc tên subject
            var isBug = (tracker === 'Bug') || (subject.indexOf('Bug') > -1);

            if (isBug) {
                tr.addClass('rh-is-bug');
                bugCount++;

                // Tô màu theo status
                if (status === 'new') {
                    tr.addClass('rh-bug-new');
                } else if (status === 'in progress' || status === 'assigned') {
                    tr.addClass('rh-bug-progress');
                } else if (status === 'resolved') {
                    tr.addClass('rh-bug-resolved');
                } else if (status === 'verified') {
                    tr.addClass('rh-bug-verified');
                } else if (status === 'closed' || status === 'rejected') {
                    tr.addClass('rh-bug-closed');
                }
            }
        });

        return bugCount;
    }

    /**
     * Thêm menu quản lý bug ở góc trang
     */
    function addBugMenu(table) {
        var totalBugs = table.find('.rh-is-bug').length;
        var doneBugs = table.find('.rh-bug-verified, .rh-bug-closed').length;
        var resolvedBugs = table.find('.rh-bug-resolved').length;
        var remainBugs = table.find('.rh-bug-new, .rh-bug-progress').length;

        var menu = $(
            '<div id="rh-bug-menu" class="rh-bug-menu">' +
                '<div class="rh-bug-menu-header">🐛 Bug Manager</div>' +
                '<div class="rh-bug-menu-body">' +
                    '<a href="javascript:void(0);" class="rh-bug-toggle" id="rh-toggle-nonbug">Ẩn Non-Bug</a>' +
                    '<span class="rh-separator">|</span>' +
                    '<a href="javascript:void(0);" class="rh-bug-copy" data-selector=".rh-is-bug">Copy All (' + totalBugs + ')</a>' +
                    '<br/>' +
                    '<a href="javascript:void(0);" class="rh-bug-copy" data-selector=".rh-bug-verified, .rh-bug-closed">Copy Done (' + doneBugs + ')</a>' +
                    '<span class="rh-separator">|</span>' +
                    '<a href="javascript:void(0);" class="rh-bug-copy" data-selector=".rh-bug-resolved">Copy Resolved (' + resolvedBugs + ')</a>' +
                    '<span class="rh-separator">|</span>' +
                    '<a href="javascript:void(0);" class="rh-bug-copy" data-selector=".rh-bug-new, .rh-bug-progress">Copy Remain (' + remainBugs + ')</a>' +
                '</div>' +
            '</div>'
        );

        $('body').append(menu);

        // Toggle non-bug rows
        var isHidden = false;
        $('#rh-toggle-nonbug').on('click', function() {
            isHidden = !isHidden;
            if (isHidden) {
                table.find('tbody tr').not('.rh-is-bug').addClass('rh-hidden');
                $(this).text('Hiện Non-Bug');
            } else {
                table.find('tbody tr').not('.rh-is-bug').removeClass('rh-hidden');
                $(this).text('Ẩn Non-Bug');
            }
        });

        // Copy bug links
        $('.rh-bug-copy').on('click', function() {
            var selector = $(this).data('selector');
            var bugs = table.find(selector);
            var lines = [];

            bugs.each(function() {
                var tr = $(this);
                var link = tr.find('td.subject a.issue');
                var href = link.attr('href');
                var status = tr.find('td.status').text().trim();

                // Tạo full URL nếu href chỉ có relative path
                if (href && !href.startsWith('http')) {
                    href = window.location.origin + href;
                }

                if (href) {
                    lines.push(href + ' - ' + status);
                }
            });

            if (lines.length > 0) {
                copyToClipboard(lines.join('\n'));
                showToast('✅ Đã copy ' + lines.length + ' bugs!');
            } else {
                showToast('⚠️ Không có gì để copy', 'warning');
            }
        });
    }

    /**
     * Tô màu bảng Spent Time
     */
    function processSpentTime() {
        if ($('#time-report').length === 0) return;

        $('#time-report td.hours').each(function() {
            var td = $(this);
            var span = td.find('.hours-int');
            if (span.length > 0) {
                var h = parseInt(span.text());
                if (h < 8) {
                    td.addClass('rh-hours-low');
                } else if (h > 8) {
                    td.addClass('rh-hours-high');
                }
            } else if (td.text().trim() === '') {
                td.addClass('rh-hours-none');
            }
        });

        console.log('[BugManager] Spent time color coding applied');
    }

    /**
     * Thêm nút filter cho Work Report
     */
    function processReport() {
        if ($('#time_input_table').length === 0) return;

        var controls = $(
            '<div class="rh-report-controls">' +
                '<button class="rh-btn rh-btn-sm" id="rh-hide-closed">🚫 Hide Closed</button>' +
                '<button class="rh-btn rh-btn-sm" id="rh-hide-100">📊 Hide 100%</button>' +
            '</div>'
        );

        $('#time_input_table').before(controls);

        var closedHidden = false;
        $('#rh-hide-closed').on('click', function() {
            closedHidden = !closedHidden;
            if (closedHidden) {
                $('#time_input_table del').closest('tr').addClass('rh-hidden');
                $(this).text('👁 Show Closed');
            } else {
                $('#time_input_table del').closest('tr').removeClass('rh-hidden');
                $(this).text('🚫 Hide Closed');
            }
        });

        var doneHidden = false;
        $('#rh-hide-100').on('click', function() {
            doneHidden = !doneHidden;
            if (doneHidden) {
                $('#time_input_table a:contains("[100%]")').closest('tr').addClass('rh-hidden');
                $(this).text('👁 Show 100%');
            } else {
                $('#time_input_table a:contains("[100%]")').closest('tr').removeClass('rh-hidden');
                $(this).text('📊 Hide 100%');
            }
        });

        console.log('[BugManager] Report filter buttons added');
    }

    /**
     * Copy text vào clipboard
     */
    function copyToClipboard(text) {
        if (typeof ClipboardJS !== 'undefined') {
            // Dùng Clipboard.js nếu có
            var temp = $('<button data-clipboard-text=""></button>');
            temp.attr('data-clipboard-text', text);
            $('body').append(temp);
            var clip = new ClipboardJS(temp[0]);
            clip.on('success', function() { temp.remove(); clip.destroy(); });
            clip.on('error', function() { temp.remove(); clip.destroy(); fallbackCopy(text); });
            temp[0].click();
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        navigator.clipboard.writeText(text).catch(function() {
            // Fallback cho trường hợp không hỗ trợ
            var textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }

    /**
     * Hiển thị toast notification
     */
    function showToast(message, type) {
        type = type || 'success';
        var existing = $('#rh-toast');
        if (existing.length) existing.remove();

        var toast = $('<div id="rh-toast" class="rh-toast rh-toast-' + type + '">' + message + '</div>');
        $('body').append(toast);

        setTimeout(function() { toast.addClass('rh-toast-show'); }, 10);
        setTimeout(function() {
            toast.removeClass('rh-toast-show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2500);
    }

    return { init: init };
})();
