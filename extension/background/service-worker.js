/**
 * Background Service Worker
 * Proxy API calls từ content script → backend server
 */

// Lắng nghe messages từ content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'api') {
        handleApiRequest(msg).then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true; // Giữ channel mở cho async response
    }

    if (msg.action === 'getSettings') {
        chrome.storage.local.get(['redmine_url', 'backend_url', 'user_id', 'redmine_user_id']).then(sendResponse);
        return true;
    }
});

/**
 * Proxy API request tới backend
 */
async function handleApiRequest(msg) {
    const stored = await chrome.storage.local.get(['backend_url', 'user_id']);

    if (!stored.backend_url || !stored.user_id) {
        throw new Error('Extension chưa được cấu hình. Vui lòng mở Popup để đăng ký.');
    }

    const url = `${stored.backend_url}${msg.endpoint}`;
    const options = {
        method: msg.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': stored.user_id.toString(),
            ...msg.headers
        }
    };

    if (msg.body && (options.method === 'POST' || options.method === 'PUT')) {
        options.body = JSON.stringify(msg.body);
    }

    try {
        const res = await fetch(url, options);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `API Error ${res.status}`);
        }

        return { success: true, data };
    } catch (err) {
        console.error('[ServiceWorker] API Error:', err.message);
        throw err;
    }
}
