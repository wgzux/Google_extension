/**
 * Module: Issue Tree (Version 2.0 - Improved detection)
 * Thu gọn/mở rộng cây issue con trong bảng issue tree của Redmine
 */
window.IssueTreeModule = (function() {
    'use strict';

    function init() {
        var issueTree = $('#issue_tree tr.issue td.subject');
        if (issueTree.length <= 1) { // Phải có ít nhất 2 dòng thì mới gọi là cây
            return; 
        }

        console.log('[IssueTree] Initializing tree for ' + issueTree.length + ' rows');
        processTree(issueTree);
        addControlButtons();
    }

    /**
     * Lấy giá trị thụt đầu dòng (indent level)
     */
    function getIndentLevel(td) {
        // Cách 1: Tìm qua thẻ span.indent
        var spanCount = td.find('span.indent').length;
        if (spanCount > 0) return spanCount;

        // Cách 2: Tìm qua padding-left của style (dành cho theme mới)
        var padding = parseInt(td.css('padding-left')) || 0;
        if (padding > 20) return Math.floor(padding / 20); // Giả định mỗi cấp 20px

        return 0;
    }

    function processTree(issueTree) {
        issueTree.each(function() {
            var td = $(this);
            var tr = td.closest('tr');
            
            var currentIndent = getIndentLevel(td);
            tr.attr('data-rh-indent', currentIndent);

            // Kiểm tra xem dòng kế tiếp có phải là con không
            var nextTr = tr.next('tr.issue');
            if (nextTr.length > 0) {
                var nextIndent = getIndentLevel(nextTr.find('td.subject'));
                if (nextIndent > currentIndent) {
                    // Thêm nút toggle nếu chưa có
                    if (td.find('.rh-tree-toggle').length === 0) {
                        var toggleBtn = $('<span class="rh-tree-toggle rh-tree-expanded" title="Thu gọn">▼</span>');
                        td.prepend(toggleBtn);

                        toggleBtn.on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleChildren(tr, currentIndent);
                        });
                    }
                }
            }
        });
    }

    function toggleChildren(parentTr, parentIndent) {
        var toggleBtn = parentTr.find('.rh-tree-toggle');
        var isExpanded = toggleBtn.hasClass('rh-tree-expanded');

        var nextTr = parentTr.next('tr.issue');
        while (nextTr.length > 0) {
            var nextIndent = parseInt(nextTr.attr('data-rh-indent')) || 0;

            if (nextIndent <= parentIndent) break;

            if (isExpanded) {
                nextTr.addClass('rh-tree-hidden');
            } else {
                // Chỉ hiện level con trực tiếp (level + 1)
                if (nextIndent === parentIndent + 1) {
                    nextTr.removeClass('rh-tree-hidden');
                }
            }
            nextTr = nextTr.next('tr.issue');
        }

        if (isExpanded) {
            toggleBtn.removeClass('rh-tree-expanded').addClass('rh-tree-collapsed').text('▶').attr('title', 'Mở rộng');
        } else {
            toggleBtn.removeClass('rh-tree-collapsed').addClass('rh-tree-expanded').text('▼').attr('title', 'Thu gọn');
        }
    }

    function addControlButtons() {
        if ($('.rh-tree-controls').length > 0) return;

        var controls = $(
            '<div class="rh-tree-controls">' +
                '<button class="rh-btn rh-btn-sm" id="rh-expand-all">📂 Expand All</button>' +
                '<button class="rh-btn rh-btn-sm" id="rh-collapse-all" style="margin-left: 5px;">📁 Collapse All</button>' +
            '</div>'
        );

        $('#issue_tree').before(controls);

        $('#rh-expand-all').on('click', function() {
            $('#issue_tree tr.issue').removeClass('rh-tree-hidden');
            $('.rh-tree-toggle').removeClass('rh-tree-collapsed').addClass('rh-tree-expanded').text('▼');
        });

        $('#rh-collapse-all').on('click', function() {
            $('#issue_tree tr.issue').each(function() {
                var indent = parseInt($(this).attr('data-rh-indent')) || 0;
                if (indent > 0) $(this).addClass('rh-tree-hidden');
            });
            $('.rh-tree-toggle').removeClass('rh-tree-expanded').addClass('rh-tree-collapsed').text('▶');
        });
    }

    return { init: init };
})();
