const express = require('express');
const cors = require('cors');
const { getDb } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Initialize database
getDb();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/issues', require('./routes/issues'));
app.use('/api/watches', require('./routes/watches'));

// Root page
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Redmine Helper API</title>
        <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px}
        h1{color:#e74c3c}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}
        .ok{color:#27ae60;font-weight:bold}a{color:#3498db}</style>
        </head>
        <body>
            <h1>🔧 Redmine Helper API</h1>
            <p class="ok">✅ Server đang chạy!</p>
            <h3>API Endpoints:</h3>
            <ul>
                <li><a href="/api/health">/api/health</a> — Health check</li>
                <li><code>POST /api/auth/register</code> — Đăng ký user</li>
                <li><code>GET /api/auth/verify</code> — Xác thực kết nối</li>
                <li><code>GET /api/config/sync</code> — Sync trackers, statuses từ Redmine</li>
                <li><code>GET /api/config/store</code> — Lấy config đã cache</li>
                <li><code>GET /api/issues/sync?ids=1,2,3</code> — Lấy thông tin issues</li>
                <li><code>GET /api/issues/:id</code> — Chi tiết issue</li>
                <li><code>GET /api/watches</code> — Danh sách watch</li>
            </ul>
            <p><small>Timestamp: ${new Date().toISOString()}</small></p>
        </body></html>
    `);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\n====================================`);
    console.log(`  Redmine Helper API Server`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`====================================\n`);
});
