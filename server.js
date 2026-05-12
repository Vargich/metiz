const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DB_FILE = 'metiz.db';
const SECRET_KEY = 'metiz-elektrod-secret';

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './image/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'product_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Только изображения')) 
});

let db;

async function initDatabase() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  
  try { 
    if (fs.existsSync(DB_FILE)) {
      const buffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch (err) { 
    console.error('Error loading database:', err);
    db = new SQL.Database(); 
  }

  // Create Tables
  db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE)`);
  db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, article TEXT NOT NULL DEFAULT '', price REAL NOT NULL, quantity INTEGER DEFAULT 0, category_id INTEGER, image TEXT DEFAULT 'image/no-photo.png', badge TEXT, description TEXT, in_stock INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, password TEXT NOT NULL, address TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total REAL NOT NULL, status TEXT DEFAULT 'processing', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, quantity INTEGER, price REAL, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id))`);

  // Seed Data
  const catCountResult = db.exec('SELECT COUNT(*) as count FROM categories');
  const catCount = catCountResult[0]?.values[0][0] || 0;
  if (catCount === 0) {
    [['Сварка', 'welding'], ['Такелаж', 'rigging'], ['Прокат', 'metal'], ['Инструмент', 'tools'], ['Крепёж', 'fasteners']].forEach(c => {
      db.run("INSERT INTO categories (name, slug) VALUES (?, ?)", c);
    });
  }

  const prodCountResult = db.exec('SELECT COUNT(*) as count FROM products');
  const prodCount = prodCountResult[0]?.values[0][0] || 0;
  if (prodCount === 0) {
    const products = [
      ['Болт высокопрочный М12х40 10.9 DIN 933', 'КР-001', 45, 100, 5, '🔩', null, 1],
      ['Сварочный инвертор Ресанта САИ-220', 'СВ-001', 12500, 10, 1, '🔥', 'hit', 1],
      ['Анкерный болт с гайкой 10х100', 'КР-002', 32, 50, 5, '🔗', null, 1]
    ];
    products.forEach(p => db.run('INSERT INTO products (name, article, price, quantity, category_id, image, badge, in_stock) VALUES (?,?,?,?,?,?,?,?)', p));
  }

  // Seed Admin
  const adminCountResult = db.exec("SELECT COUNT(*) FROM users WHERE email = 'vargichwork@gmail.com'");
  if (adminCountResult[0].values[0][0] === 0) {
      const hashedPass = await bcrypt.hash('admin123', 10);
      db.run("INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)", ['Администратор', 'vargichwork@gmail.com', hashedPass, 1]);
  }

  saveDatabase();
}

function saveDatabase() { 
  const data = db.export(); 
  fs.writeFileSync(DB_FILE, Buffer.from(data)); 
}

function queryAll(sql, params = []) { 
  const stmt = db.prepare(sql); 
  if (params.length > 0) stmt.bind(params); 
  const result = []; 
  while (stmt.step()) result.push(stmt.getAsObject()); 
  stmt.free(); 
  return result; 
}

function queryOne(sql, params = []) { 
  const results = queryAll(sql, params); 
  return results[0] || null; 
}

function run(sql, params = []) { 
  db.run(sql, params.map(p => p === undefined ? null : p)); 
  saveDatabase(); 
}

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/image', express.static(path.join(__dirname, 'image')));

// Serve .html files without the extension
app.use((req, res, next) => {
    if (req.path.indexOf('.') === -1 && req.path !== '/' && !req.path.startsWith('/api')) {
        const filePath = path.join(__dirname, req.path + '.html');
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }
    next();
});

app.use(express.static(path.join(__dirname, 'dist')));

// AUTH MIDDLEWARE
const authenticateToken = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = queryOne("SELECT id, name, email, is_admin FROM users WHERE id = ?", [decoded.userId]);
        if (!user) return res.status(401).json({ error: 'User not found' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Forbidden' });
    }
};

const isAdminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
};

// API ROUTES

// Temporary storage for verification codes
const verificationCodes = new Map();

// Auth
app.post('/api/admin/login', async (req, res) => {
    const { contact, password } = req.body;
    const user = queryOne("SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_admin = 1", [contact, contact]);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Неверные данные администратора' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ user: { id: user.id, email: user.email, displayName: user.name, isAdmin: true } });
});

app.post('/api/auth/request-code', (req, res) => {
    const { contact } = req.body;
    if (!contact) return res.status(400).json({ error: 'Contact required' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(contact, {
        code,
        expiry: Date.now() + 5 * 60 * 1000
    });

    console.log(`[AUTH] Code for ${contact}: ${code}`);
    res.json({ message: 'Code sent', previewCode: code });
});

app.post('/api/auth/verify-code', async (req, res) => {
    const { contact, code, name } = req.body;
    
    const stored = verificationCodes.get(contact);
    if (!stored || stored.code !== code || Date.now() > stored.expiry) {
        return res.status(400).json({ error: 'Неверный или истекший код' });
    }

    // Don't delete yet if we still need to complete registration in a separate call
    // But for simplicity, if 'name' is provided here, we finish.
    // If not provided and user doesn't exist, we return a flag.

    const isEmail = contact.includes('@');
    let user = queryOne("SELECT * FROM users WHERE email = ? OR phone = ?", [contact, contact]);

    if (!user) {
        if (!name) {
            return res.json({ status: 'needs_registration', contact });
        }
        
        // Registration with provided name
        verificationCodes.delete(contact);
        const isAdmin = contact === 'vargichwork@gmail.com' ? 1 : 0;
        const dummyPass = '';
        if (isEmail) {
            run("INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)", [name, contact, dummyPass, isAdmin]);
            user = queryOne("SELECT * FROM users WHERE email = ?", [contact]);
        } else {
            run("INSERT INTO users (name, phone, password, is_admin) VALUES (?, ?, ?, ?)", [name, contact, dummyPass, isAdmin]);
            user = queryOne("SELECT * FROM users WHERE phone = ?", [contact]);
        }
    } else {
        verificationCodes.delete(contact);
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ user: { id: user.id, email: user.email, phone: user.phone, displayName: user.name, isAdmin: !!user.is_admin } });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: { id: req.user.id, email: req.user.email, displayName: req.user.name, isAdmin: !!req.user.is_admin } });
});

// Categories
app.get('/api/categories', (req, res) => {
    res.json(queryAll("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count FROM categories c"));
});

// Products
app.get('/api/products', (req, res) => {
    const products = queryAll("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id");
    res.json(products);
});

app.post('/api/products', authenticateToken, isAdminMiddleware, upload.single('image'), (req, res) => {
    const { name, price, quantity, category_id, badge, description, article } = req.body;
    const image = req.file ? `/image/${req.file.filename}` : (req.body.image || 'image/no-photo.png');
    
    run("INSERT INTO products (name, price, quantity, category_id, image, badge, description, article) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
        [name, price, quantity, category_id, image, badge, description, article]);
    
    res.json({ success: true });
});

app.put('/api/products/:id', authenticateToken, isAdminMiddleware, upload.single('image'), (req, res) => {
    const { name, price, quantity, category_id, badge, description, article } = req.body;
    const existing = queryOne("SELECT image FROM products WHERE id = ?", [req.params.id]);
    const image = req.file ? `/image/${req.file.filename}` : (req.body.image || existing.image);
    
    run("UPDATE products SET name=?, price=?, quantity=?, category_id=?, image=?, badge=?, description=?, article=? WHERE id=?", 
        [name, price, quantity, category_id, image, badge, description, article, req.params.id]);
    
    res.json({ success: true });
});

app.delete('/api/products/:id', authenticateToken, isAdminMiddleware, (req, res) => {
    run("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

// Orders
app.get('/api/orders', authenticateToken, (req, res) => {
    if (req.user.is_admin) {
        res.json(queryAll("SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC"));
    } else {
        res.json(queryAll("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [req.user.id]));
    }
});

app.get('/api/orders/:id/items', authenticateToken, (req, res) => {
    const items = queryAll("SELECT oi.*, p.name as product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?", [req.params.id]);
    res.json(items);
});

app.put('/api/orders/:id/status', authenticateToken, isAdminMiddleware, (req, res) => {
    const { status } = req.body;
    run("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ success: true });
});

app.post('/api/orders', authenticateToken, (req, res) => {
    const { total, items } = req.body;
    run("INSERT INTO orders (user_id, total) VALUES (?, ?)", [req.user.id, total]);
    const order = queryOne("SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id]);
    
    items.forEach(item => {
        run("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)", 
            [order.id, item.id, item.quantity, item.price]);
    });
    
    res.json({ success: true, orderId: order.id });
});

// SPA & STATIC
if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = require('vite');
    async function startVite() {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server: http://localhost:${PORT}`);
        });
    }
    initDatabase().then(() => startVite());
} else {
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
    initDatabase().then(() => {
        app.listen(PORT, '0.0.0.0', () => console.log(`Server: http://localhost:${PORT}`));
    });
}
