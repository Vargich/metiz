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
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Разрешены только изображения')) 
});

const handleImageUpload = (req, res, next) => {
    const uploadSingle = upload.single('image');
    uploadSingle(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Размер файла превышает 25 МБ' });
            return res.status(400).json({ error: 'Ошибка загрузки: ' + err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

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

  // Таблицы
  db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE)`);
  db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, article TEXT NOT NULL DEFAULT '', price REAL NOT NULL, quantity INTEGER DEFAULT 0, category_id INTEGER, image TEXT DEFAULT '', badge TEXT, description TEXT, in_stock INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, password TEXT NOT NULL, address TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total REAL NOT NULL, status TEXT DEFAULT 'processing', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, quantity INTEGER, price REAL, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id))`);

  // ============================================
  // КАТЕГОРИИ И ТОВАРЫ (Инициализация)
  // ============================================
  const catCountResult = db.exec('SELECT COUNT(*) as count FROM categories');
  if (!catCountResult[0] || catCountResult[0].values[0][0] === 0) {
    const categories = [
      ['Сварка', 'welding'], ['Такелаж', 'rigging'], ['Прокат', 'metal'],
      ['Инструмент', 'tools'], ['Крепёж', 'fasteners'], ['Абразивы', 'abrasives'], ['Спецодежда', 'workwear']
    ];
    categories.forEach(c => db.run("INSERT INTO categories (name, slug) VALUES (?, ?)", c));
  }

  const prodCountResult = db.exec('SELECT COUNT(*) as count FROM products');
  if (!prodCountResult[0] || prodCountResult[0].values[0][0] === 0) {
    const products = [
      ['Сварочный инвертор Ресанта САИ-220', 'СВ-001', 12500, 10, 1, '', 'hit', 1],
      ['Электроды УОНИ 13/55 3мм (5кг)', 'СВ-002', 950, 25, 1, '', 'new', 1],
      ['Цепь длиннозвенная 8мм DIN 763 (м)', 'ТК-001', 210, 45, 2, '', 'hit', 1],
      ['Труба профильная 40х40х2 (м)', 'ПР-001', 320, 200, 3, '', null, 1],
      ['УШМ Makita 9558HN', 'ИН-001', 4500, 5, 4, '', 'hit', 1],
      ['Болт М12х40 оцинкованный', 'КР-001', 45, 500, 5, '', null, 1],
      ['Круг отрезной Луга 125х1.0', 'АБ-001', 35, 500, 6, '', 'hit', 1],
      ['Перчатки спилковые комбинированные', 'СП-001', 250, 100, 7, '', null, 1]
    ];
    products.forEach(p => db.run('INSERT INTO products (name, article, price, quantity, category_id, image, badge, in_stock) VALUES (?,?,?,?,?,?,?,?)', p));
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

// Защита админ-панели
app.get('/admin', (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/admin-login');
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const user = queryOne("SELECT * FROM users WHERE id = ? AND is_admin = 1", [decoded.userId]);
      if (!user) return res.redirect('/admin-login');
      next(); 
    } catch (e) {
      res.redirect('/admin-login');
    }
});

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

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

// Auth
app.post('/api/admin/login', async (req, res) => {
    const { contact, password } = req.body;
    const user = queryOne("SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_admin = 1", [contact, contact]);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Неверные данные' });
    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ user: { id: user.id, email: user.email, displayName: user.name, isAdmin: true } });
});

app.post('/api/auth/request-code', (req, res) => {
    const { contact } = req.body;
    if (!contact) return res.status(400).json({ error: 'Введите телефон или email' });
    
    const user = queryOne("SELECT id, name, email, phone FROM users WHERE email = ? OR phone = ?", [contact, contact]);
    
    // ИСПРАВЛЕНИЕ: строго 6-значный код
    const code = String(Math.floor(100000 + Math.random() * 900000));
    console.log('Код для ' + contact + ': ' + code);
    
    res.json({ 
      success: true, 
      code: code,
      exists: !!user,
      user: user || null
    });
});
  
app.post('/api/auth/verify-code', (req, res) => {
    const { contact, code, name } = req.body;
    if (!contact) return res.status(400).json({ error: 'Контакт обязателен' });
    
    let user = queryOne("SELECT id, name, email, phone, is_admin FROM users WHERE email = ? OR phone = ?", [contact, contact]);
    
    if (!user) {
      const isEmail = contact.includes('@');
      run("INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)", 
        [name || 'Пользователь', isEmail ? contact : '', isEmail ? '' : contact, 'phone_auth']);
      user = queryOne("SELECT id, name, email, phone, is_admin FROM users WHERE email = ? OR phone = ?", [contact, contact]);
    }
    
    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: !!user.is_admin }
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name, displayName: req.user.name, isAdmin: !!req.user.is_admin } });
});

// ОБНОВЛЕНИЕ ПРОФИЛЯ (Имя и Email)
app.put('/api/users/me', authenticateToken, (req, res) => {
    const { name, email } = req.body;
    
    // Если пользователь пытается добавить/изменить email
    if (email) {
        // Проверяем, есть ли такой email у ДРУГОГО пользователя
        const existing = queryOne("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user.id]);
        if (existing) {
            return res.status(400).json({ error: 'Этот email уже привязан к другой учетной записи' });
        }
    }

    // Обновляем только те поля, которые были переданы
    if (name !== undefined) run("UPDATE users SET name = ? WHERE id = ?", [name, req.user.id]);
    if (email !== undefined) run("UPDATE users SET email = ? WHERE id = ?", [email, req.user.id]);
    
    res.json({ success: true, name, email });
});

// Users
app.get('/api/users', authenticateToken, isAdminMiddleware, (req, res) => {
    res.json(queryAll("SELECT id, name, email, phone, is_admin, created_at FROM users ORDER BY created_at DESC"));
});

// ГАЛЕРЕЯ ИЗОБРАЖЕНИЙ
app.get('/api/images', authenticateToken, isAdminMiddleware, (req, res) => {
    const dir = path.join(__dirname, 'image');
    if (!fs.existsSync(dir)) return res.json([]);
    try {
        const files = fs.readdirSync(dir);
        const images = files
            .filter(f => /\.(png|jpe?g|gif|webp|svg)$/i.test(f))
            .map(f => {
                const stat = fs.statSync(path.join(dir, f));
                return { url: `/image/${f}`, mtime: stat.mtime.getTime() };
            })
            .sort((a, b) => b.mtime - a.mtime)
            .map(f => f.url);
        res.json(images);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка чтения папки с картинками' });
    }
});

// Categories & Products
app.get('/api/categories', (req, res) => res.json(queryAll("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count FROM categories c")));
app.post('/api/categories', authenticateToken, isAdminMiddleware, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Имя категории обязательно' });
    const slug = name.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-'); // Упрощенно
    run("INSERT INTO categories (name, slug) VALUES (?, ?)", [name, slug]);
    res.json({ success: true, slug });
});
app.delete('/api/categories/:id', authenticateToken, isAdminMiddleware, (req, res) => {
    run("UPDATE products SET category_id = NULL WHERE category_id = ?", [req.params.id]);
    run("DELETE FROM categories WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.get('/api/products', (req, res) => res.json(queryAll("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC")));
app.post('/api/products', authenticateToken, isAdminMiddleware, handleImageUpload, (req, res) => {
    const { name, price, quantity, category_id, badge, description, article } = req.body;
    const image = req.file ? `/image/${req.file.filename}` : (req.body.image_url || '');
    run("INSERT INTO products (name, price, quantity, category_id, image, badge, description, article) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [name, price, quantity, category_id, image, badge, description, article]);
    res.json({ success: true });
});
app.put('/api/products/:id', authenticateToken, isAdminMiddleware, handleImageUpload, (req, res) => {
    const { name, price, quantity, category_id, badge, description, article } = req.body;
    const existing = queryOne("SELECT image FROM products WHERE id = ?", [req.params.id]);
    const image = req.file ? `/image/${req.file.filename}` : (req.body.image_url !== undefined ? req.body.image_url : existing.image);
    run("UPDATE products SET name=?, price=?, quantity=?, category_id=?, image=?, badge=?, description=?, article=? WHERE id=?", [name, price, quantity, category_id, image, badge, description, article, req.params.id]);
    res.json({ success: true });
});
app.delete('/api/products/:id', authenticateToken, isAdminMiddleware, (req, res) => {
    run("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.use((req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY, { ignoreExpiration: true });
            const newToken = jwt.sign({ userId: decoded.userId }, SECRET_KEY, { expiresIn: '1d' });
            res.cookie('token', newToken, { httpOnly: true, maxAge: 86400000 });
        } catch (e) {}
    }
    next();
});

// Orders
app.get('/api/orders', authenticateToken, (req, res) => {
    // Если это админ и он явно запросил весь список (для админки)
    if (req.user.is_admin && req.query.all === 'true') {
        res.json(queryAll("SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC"));
    } else {
        // Иначе отдаем только личные заказы пользователя (даже если он админ)
        res.json(queryAll("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [req.user.id]));
    }
});

// ИСПРАВЛЕНИЕ: LEFT JOIN чтобы удаленные товары не пропадали из чека
app.get('/api/orders/:id/items', authenticateToken, (req, res) => {
    // Находим заказ, чтобы проверить, кому он принадлежит
    const order = queryOne("SELECT user_id FROM orders WHERE id = ?", [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    
    // Проверка прав
    if (!req.user.is_admin && order.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    res.json(queryAll("SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?", [req.params.id]));
});

app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
    const orderId = req.params.id;
    const newStatus = req.body.status;

    const order = queryOne("SELECT status, user_id FROM orders WHERE id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    // Проверка прав для обычных пользователей
    if (!req.user.is_admin) {
        if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Доступ запрещен' });
        if (newStatus !== 'cancelled') return res.status(403).json({ error: 'Вы можете только отменить заказ' });
        if (order.status === 'completed' || order.status === 'shipped') {
            return res.status(400).json({ error: 'Заказ уже в пути или выполнен, отмена невозможна' });
        }
    }

    const oldStatus = order.status;
    run("UPDATE orders SET status = ? WHERE id = ?", [newStatus, orderId]);

    // ЛОГИКА СКЛАДА
    // Если заказ ТОЛЬКО ЧТО отменили — ВОЗВРАЩАЕМ товары на склад
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
        const items = queryAll("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]);
        items.forEach(item => {
            run("UPDATE products SET quantity = quantity + ? WHERE id = ?", [item.quantity, item.product_id]);
        });
    } 
    // Если заказ БЫЛ отменен, а теперь его вернули в работу — СНОВА СПИСЫВАЕМ товары
    else if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
        const items = queryAll("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]);
        items.forEach(item => {
            run("UPDATE products SET quantity = quantity - ? WHERE id = ?", [item.quantity, item.product_id]);
        });
    }

    res.json({ success: true });
});

// ИСПРАВЛЕНИЕ: Защищенное оформление заказа и списание склада
app.post('/api/orders', authenticateToken, (req, res) => {
    const { items } = req.body;
    let serverTotal = 0;
    const validItems = [];

    for (const item of items) {
        const product = queryOne("SELECT id, price, quantity, name FROM products WHERE id = ?", [item.id]);
        if (!product) continue;
        
        if (product.quantity < item.quantity) {
            return res.status(400).json({ error: `Товара "${product.name}" недостаточно (в наличии: ${product.quantity} шт.)` });
        }
        serverTotal += product.price * item.quantity;
        validItems.push({ id: product.id, quantity: item.quantity, price: product.price });
    }

    if (validItems.length === 0) return res.status(400).json({ error: 'Корзина пуста или товары не найдены' });

    try {
        run("INSERT INTO orders (user_id, total) VALUES (?, ?)", [req.user.id, serverTotal]);
        const order = queryOne("SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id]);

        validItems.forEach(item => {
            run("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)", [order.id, item.id, item.quantity, item.price]);
            run("UPDATE products SET quantity = quantity - ? WHERE id = ?", [item.quantity, item.id]);
        });

        res.json({ success: true, orderId: order.id });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка БД при оформлении заказа' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = require('vite');
    async function startVite() {
        const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
        app.use(vite.middlewares);
        app.listen(PORT, '0.0.0.0', () => { console.log(`Server: http://localhost:${PORT}`); });
    }
    initDatabase().then(() => startVite());
} else {
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
    initDatabase().then(() => {
        app.listen(PORT, '0.0.0.0', () => console.log(`Server: http://localhost:${PORT}`));
    });
}

app.put('/api/admin/settings', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { contact, password } = req.body;
    const updates = [];
    const params = [];

    if (contact) {
        const isEmail = contact.includes('@');
        updates.push(isEmail ? "email = ?" : "phone = ?");
        params.push(contact);
    }

    if (password) {
        if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        const hashed = await bcrypt.hash(password, 10);
        updates.push("password = ?");
        params.push(hashed);
    }

    if (updates.length > 0) {
        params.push(req.user.id);
        run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true });
});
