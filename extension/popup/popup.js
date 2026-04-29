document.addEventListener('DOMContentLoaded', async () => {
    const elRedmineUrl = document.getElementById('redmine-url');
    const elApiKey    = document.getElementById('api-key');
    const elBtnTest   = document.getElementById('btn-test');
    const elBtnSave   = document.getElementById('btn-save');
    const elMessage   = document.getElementById('message');
    const elStatusBar = document.getElementById('status-bar');
    const elStatusText = document.getElementById('status-text');
    const elUserInfo  = document.getElementById('user-info');
    const elUserName  = document.getElementById('user-name');
    const elServerUrl = document.getElementById('server-url');
    const elShowKey   = document.getElementById('show-key');

    // ====== Load settings đã lưu ======
    const stored = await chrome.storage.local.get(['redmine_url', 'api_key', 'user_name']);
    if (stored.redmine_url) elRedmineUrl.value = stored.redmine_url;
    if (stored.api_key)     elApiKey.value = stored.api_key;
    if (stored.user_name)   setConnected(stored.user_name, stored.redmine_url);

    // ====== Toggle show/hide API key ======
    elShowKey.addEventListener('click', (e) => {
        e.preventDefault();
        elApiKey.type = elApiKey.type === 'password' ? 'text' : 'password';
        elShowKey.textContent = elApiKey.type === 'password' ? 'Hiện' : 'Ẩn';
    });

    // ====== Test Connection — gọi thẳng Redmine API từ popup ======
    elBtnTest.addEventListener('click', async () => {
        const redmineUrl = elRedmineUrl.value.trim().replace(/\/+$/, '');
        const apiKey     = elApiKey.value.trim();

        if (!redmineUrl || !apiKey) {
            showMessage('Vui lòng nhập Redmine URL và API Key', 'error');
            return;
        }

        showMessage('Đang kiểm tra kết nối...', 'info');
        elBtnTest.disabled = true;

        try {
            const res = await fetch(`${redmineUrl}/users/current.json`, {
                headers: { 'X-Redmine-API-Key': apiKey }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status} — Sai API Key hoặc URL`);

            const data = await res.json();
            showMessage(`✅ Kết nối thành công! Xin chào ${data.user.firstname} ${data.user.lastname}`, 'success');
        } catch (err) {
            showMessage(`❌ ${err.message}`, 'error');
        } finally {
            elBtnTest.disabled = false;
        }
    });

    // ====== Save Settings ======
    elBtnSave.addEventListener('click', async () => {
        const redmineUrl = elRedmineUrl.value.trim().replace(/\/+$/, '');
        const apiKey     = elApiKey.value.trim();

        if (!redmineUrl || !apiKey) {
            showMessage('Vui lòng nhập Redmine URL và API Key', 'error');
            return;
        }

        showMessage('Đang lưu và xác thực...', 'info');
        elBtnSave.disabled = true;

        try {
            // Xác thực trực tiếp với Redmine
            const res = await fetch(`${redmineUrl}/users/current.json`, {
                headers: { 'X-Redmine-API-Key': apiKey }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status} — Sai API Key hoặc Redmine URL`);

            const data = await res.json();
            const userName = `${data.user.firstname} ${data.user.lastname}`.trim();

            // Lưu vào chrome.storage.local
            await chrome.storage.local.set({
                redmine_url: redmineUrl,
                api_key: apiKey,
                user_name: userName
            });

            showMessage(`✅ Đã lưu! Tooltip sẽ hoạt động ngay trên trang Redmine.`, 'success');
            setConnected(userName, redmineUrl);
        } catch (err) {
            showMessage(`❌ ${err.message}`, 'error');
        } finally {
            elBtnSave.disabled = false;
        }
    });

    // ====== Helpers ======
    function showMessage(text, type) {
        elMessage.textContent = text;
        elMessage.className = `message ${type}`;
        elMessage.classList.remove('hidden');
    }

    function setConnected(name, url) {
        elStatusBar.className = 'status-bar connected';
        elStatusText.textContent = 'Đã kết nối';
        elUserInfo.classList.remove('hidden');
        elUserName.textContent = name;
        elServerUrl.textContent = url;
    }
});
