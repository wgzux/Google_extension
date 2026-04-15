/**
 * Module: Issue Tree
 * Thu gọn/mở rộng cây issue con trong bảng issue tree của Redmine
 */
window.IssueTreeModule = (function() {
    'use strict';

    function init() {
        var issueTree = $('#issue_tree tr.issue td.subject');
        if (issueTree.length === 0) {
            return; // Không có issue tree trên trang này
        }

        console.log('[IssueTree] Found ' + issueTree.length + ' issues in tree');

        processTree(issueTree);
        addControlButtons();
    }

    /**
     * Thêm nút collapse/expand cho mỗi parent issue trong tree
     */
    function processTree(issueTree) {
        issueTree.each(function() {
            var td = $(this);
            var tr = td.closest('tr');
            var issueId = tr.attr('id');

            if (!issueId) return;

            // Lấy cấp indent hiện tại
            var indent = 0;
            var indentSpan = td.find('.indent');
            if (indentSpan.length > 0) {
                indent = indentSpan.length;
            }
            tr.data('indent', indent);

            // Kiểm tra xem có con không
            var nextTr = tr.next('tr.issue');
            if (nextTr.length > 0) {
                var nextIndent = nextTr.find('td.subject .indent').length;
                if (nextIndent > indent) {
                    // Có con → thêm nút toggle
                    var toggleBtn = $('<span class="rh-tree-toggle rh-tree-expanded" title="Thu gọn">▼</span>');
                    td.find('a.issue').before(toggleBtn);

                    toggleBtn.on('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleChildren(tr, indent);
                    });
                }
            }
        });
    }

    /**
     * Toggle ẩn/hiện các children
     */
    function toggleChildren(parentTr, parentIndent) {
        var toggleBtn = parentTr.find('.rh-tree-toggle');
        var isExpanded = toggleBtn.hasClass('rh-tree-expanded');

        var nextTr = parentTr.next('tr.issue');
        while (nextTr.length > 0) {
            var nextIndent = nextTr.find('td.subject .indent').length;

            // Nếu indent <= parent → đã hết children, dừng
            if (nextIndent <= parentIndent) break;

            if (isExpanded) {
                nextTr.addClass('rh-tree-hidden');
                // Đóng luôn các toggle con
                nextTr.find('.rh-tree-toggle').removeClass('rh-tree-expanded').addClass('rh-tree-collapsed').text('▶');
            } else {
                // Chỉ hiện children cấp 1 (trực tiếp)
                if (nextIndent === parentIndent + 1) {
                    nextTr.removeClass('rh-tree-hidden');
                }
            }

            nextTr = nextTr.next('tr.issue');
        }

        if (isExpanded) {
            toggleBtn.removeClass('rh-tree-expanded').addClass('rh-tree-collapsed').text('▶');
            toggleBtn.attr('title', 'Mở rộng');
        } else {
            toggleBtn.removeClass('rh-tree-collapsed').addClass('rh-tree-expanded').text('▼');
            toggleBtn.attr('title', 'Thu gọn');
        }
    }

    /**
     * Thêm nút Expand All / Collapse All ở đầu tree
     */
    function addControlButtons() {
        var treeTable = $('#issue_tree');
        if (treeTable.length === 0) return;

        var controls = $(
            '<div class="rh-tree-controls">' +
                '<button class="rh-btn rh-btn-sm" id="rh-expand-all">📂 Expand All</button>' +
                '<button class="rh-btn rh-btn-sm" id="rh-collapse-all">📁 Collapse All</button>' +
            '</div>'
        );

        treeTable.before(controls);

        $('#rh-expand-all').on('click', function() {
            $('#issue_tree tr.issue').removeClass('rh-tree-hidden');
            $('.rh-tree-toggle').removeClass('rh-tree-collapsed').addClass('rh-tree-expanded').text('▼');
        });

        $('#rh-collapse-all').on('click', function() {
            // Ẩn tất cả trừ cấp đầu tiên (indent = 0)
            $('#issue_tree tr.issue').each(function() {
                var indent = $(this).find('td.subject .indent').length;
                if (indent > 0) {
                    $(this).addClass('rh-tree-hidden');
                }
            });
            $('.rh-tree-toggle').removeClass('rh-tree-expanded').addClass('rh-tree-collapsed').text('▶');
        });
    }

    return { init: init };
})();
