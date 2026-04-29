document.addEventListener('DOMContentLoaded', async () => {
    const toggleInput = document.getElementById('toggle-tooltip');
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');

    // Mặc định Tooltip luôn bật nếu chưa có biến trong storage
    const stored = await chrome.storage.local.get({ isTooltipEnabled: true });
    const isEnabled = stored.isTooltipEnabled;

    // Cập nhật giao diện theo trạng thái đã lưu
    toggleInput.checked = isEnabled;
    updateUI(isEnabled);

    // Lắng nghe sự kiện bật/tắt
    toggleInput.addEventListener('change', async (e) => {
        const newState = e.target.checked;
        await chrome.storage.local.set({ isTooltipEnabled: newState });
        updateUI(newState);
    });

    function updateUI(isEnabled) {
        if (isEnabled) {
            statusBox.className = 'status-box on';
            statusText.textContent = 'Tooltip đang BẬT';
        } else {
            statusBox.className = 'status-box off';
            statusText.textContent = 'Tooltip đã TẮT';
        }
    }
});
