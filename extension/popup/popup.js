document.addEventListener('DOMContentLoaded', async () => {
    const elRedmineUrl = document.getElementById('redmine-url');
    const elApiKey = document.getElementById('api-key');
    const elBackendUrl = document.getElementById('backend-url');
    const elBtnTest = document.getElementById('btn-test');
    const elBtnSave = document.getElementById('btn-save');
    const elBtnSync = document.getElementById('btn-sync');
    const elMessage = document.getElementById('message');
    const elStatusBar = document.getElementById('status-bar');
    const elStatusText = document.getElementById('status-text');
    const elUserInfo = document.getElementById('user-info');
    const elUserName = document.getElementById('user-name');
    const elServerUrl = document.getElementById('server-url');
    const elShowKey = document.getElementById('show-key');

    // Load saved settings
    const stored = await chrome.storage.local.get(['redmine_url', 'api_key', 'backend_url', 'user_id', 'user_name']);
    if (stored.redmine_url) elRedmineUrl.value = stored.redmine_url;
    if (stored.api_key) elApiKey.value = stored.api_key;
    if (stored.backend_url) elBackendUrl.value = stored.backend_url;

    if (stored.user_name) {
        setConnected(stored.user_name, stored.redmine_url);
    }

    // Toggle show/hide API key
    elShowKey.addEventListener('click', (e) => {
        e.preventDefault();
        elApiKey.type = elApiKey.type === 'password' ? 'text' : 'password';
    });

    // Test Connection
    elBtnTest.addEventListener('click', async () => {
        const backendUrl = elBackendUrl.value.replace(/\/+$/, '');
        const redmineUrl = elRedmineUrl.value.replace(/\/+$/, '');
        const apiKey = elApiKey.value.trim();

        if (!redmineUrl || !apiKey) {
            showMessage('Vui lòng nhập Redmine URL và API Key', 'error');
            return;
        }

        showMessage('Đang kiểm tra kết nối...', 'info');

        try {
            // Test backend health
            const healthRes = await fetch(`${backendUrl}/api/health`);
            if (!healthRes.ok) throw new Error('Backend server không phản hồi');

            // Test Redmine connection
            const verifyRes = await fetch(
                `${backendUrl}/api/auth/verify?redmine_url=${encodeURIComponent(redmineUrl)}&api_key=${encodeURIComponent(apiKey)}`
            );
            const data = await verifyRes.json();

            if (data.success) {
                showMessage(`✅ Kết nối thành công! User: ${data.user.name}`, 'success');
            } else {
                showMessage(`❌ Lỗi: ${data.error}`, 'error');
            }
        } catch (err) {
            showMessage(`❌ Không thể kết nối: ${err.message}`, 'error');
        }
    });

    // Save & Register
    elBtnSave.addEventListener('click', async () => {
        const backendUrl = elBackendUrl.value.replace(/\/+$/, '');
        const redmineUrl = elRedmineUrl.value.replace(/\/+$/, '');
        const apiKey = elApiKey.value.trim();

        if (!redmineUrl || !apiKey) {
            showMessage('Vui lòng nhập Redmine URL và API Key', 'error');
            return;
        }

        showMessage('Đang đăng ký...', 'info');

        try {
            const res = await fetch(`${backendUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redmine_url: redmineUrl, api_key: apiKey })
            });

            const data = await res.json();

            if (data.user) {
                // Lưu vào chrome.storage
                await chrome.storage.local.set({
                    redmine_url: redmineUrl,
                    api_key: apiKey,
                    backend_url: backendUrl,
                    user_id: data.user.id,
                    user_name: data.user.display_name,
                    redmine_user_id: data.user.redmine_user_id
                });

                showMessage(`✅ Đăng ký thành công! User: ${data.user.display_name}`, 'success');
                setConnected(data.user.display_name, redmineUrl);
            } else {
                showMessage(`❌ Lỗi: ${data.error}`, 'error');
            }
        } catch (err) {
            showMessage(`❌ Không thể đăng ký: ${err.message}`, 'error');
        }
    });

    // Sync Config
    elBtnSync.addEventListener('click', async () => {
        const stored = await chrome.storage.local.get(['backend_url', 'user_id']);
        if (!stored.backend_url || !stored.user_id) {
            showMessage('Vui lòng đăng ký trước', 'error');
            return;
        }

        showMessage('Đang sync config...', 'info');
        elBtnSync.disabled = true;

        try {
            const res = await fetch(`${stored.backend_url}/api/config/sync`, {
                headers: { 'X-User-Id': stored.user_id.toString() }
            });
            const data = await res.json();

            if (data.counts) {
                showMessage(
                    `✅ Đã sync: ${data.counts.trackers} trackers, ${data.counts.statuses} statuses, ` +
                    `${data.counts.priorities} priorities, ${data.counts.users} users, ${data.counts.projects} projects`,
                    'success'
                );
            } else {
                showMessage(`❌ Lỗi: ${data.error}`, 'error');
            }
        } catch (err) {
            showMessage(`❌ Sync thất bại: ${err.message}`, 'error');
        } finally {
            elBtnSync.disabled = false;
        }
    });

    // Helpers
    function showMessage(text, type) {
        elMessage.textContent = text;
        elMessage.className = `message ${type}`;
    }

    function setConnected(name, url) {
        elStatusBar.className = 'status-bar connected';
        elStatusText.textContent = 'Đã kết nối';
        elUserInfo.classList.remove('hidden');
        elUserName.textContent = name;
        elServerUrl.textContent = url;
        elBtnSync.disabled = false;
    }
});
