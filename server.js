require('dotenv').config(); 

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const compression = require('compression'); // 🔥 Добавлено сжатие ответов (Gzip/Brotli)

const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'dev-secret-only-for-development';

// 🔥 ВКЛЮЧАЕМ СЖАТИЕ ОДНИМ ИЗ ПЕРВЫХ МИДДЛВАРА (Ускоряет загрузку при 1000+ товарах)
app.use(compression());

// 🔥 СТРОГАЯ НАСТРОЙКА CORS (Строка app.use(cors()) внизу удалена!)
const cors = require('cors');
const allowedOrigins = [process.env.APP_URL || 'https://metizelektrod.ru', 'http://localhost:3000', 'https://metiz.onrender.com'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Создание папки логов
const logDir = './logs/';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// ==========================================
// НАСТРОЙКА ЛОГЕРА (Winston)
// ==========================================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// 🔥 ЗАЩИТА ОТ СПАМА / БРУТФОРСА
const otpLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5, 
    message: { error: 'Слишком много запросов. Пожалуйста, подождите 1 минуту.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// ==========================================
// 1. НАСТРОЙКИ POSTGRESQL И ПОЧТЫ
// ==========================================
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'metiz_elektrod',
});

// 🔥 ДАННЫЕ SMTP ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ (.env)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mail.ru', 
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || '',  
        pass: process.env.SMTP_PASS || '' 
    }
});

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || ''; 

// ==========================================
// 2. ОБЕРТКИ ДЛЯ БАЗЫ ДАННЫХ
// ==========================================
function convertPgQuery(sql) {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
}

async function queryAll(sql, params = []) {
    const res = await pool.query(convertPgQuery(sql), params);
    return res.rows;
}

async function queryOne(sql, params = []) {
    const res = await pool.query(convertPgQuery(sql), params);
    return res.rows[0] || null;
}

async function run(sql, params = []) {
    let query = convertPgQuery(sql);
    if (query.trim().toUpperCase().startsWith('INSERT') && !query.toUpperCase().includes('RETURNING')) {
        query += ' RETURNING *';
    }
    const res = await pool.query(query, params.map(p => p === undefined ? null : p));
    return res.rows[0] ? res.rows[0].id : null;
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ И МИГРАЦИИ
// ==========================================
async function initDatabase() {
    await run(`CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(255) NOT NULL, 
        slug VARCHAR(255) NOT NULL UNIQUE
    )`);
    
    await run(`CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(255) NOT NULL, 
        article VARCHAR(255) NOT NULL DEFAULT '', 
        price NUMERIC NOT NULL, 
        quantity NUMERIC(10,3) DEFAULT 0, 
        unit VARCHAR(10) DEFAULT 'шт',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, 
        image TEXT DEFAULT '', 
        images TEXT DEFAULT '[]', 
        badge VARCHAR(50), 
        description TEXT, 
        in_stock INTEGER DEFAULT 1, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(255) NOT NULL, 
        email VARCHAR(255) UNIQUE, 
        phone VARCHAR(255) UNIQUE, 
        password TEXT NOT NULL, 
        address TEXT, 
        is_admin INTEGER DEFAULT 0, 
        is_company INTEGER DEFAULT 0,
        company_name VARCHAR(500) DEFAULT '',
        company_inn VARCHAR(20) DEFAULT '',
        company_address VARCHAR(500) DEFAULT '',
        discount INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, 
        user_id INTEGER REFERENCES users(id), 
        total NUMERIC NOT NULL, 
        status VARCHAR(50) DEFAULT 'processing', 
        pickup_point_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY, 
        order_id INTEGER REFERENCES orders(id), 
        product_id INTEGER REFERENCES products(id), 
        quantity NUMERIC(10,3), 
        price NUMERIC
    )`);    

    await run(`CREATE TABLE IF NOT EXISTS otp_codes (
        contact VARCHAR(255) PRIMARY KEY, 
        code VARCHAR(50), 
        expires_at BIGINT
    )`);
    
    await run(`CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) DEFAULT '',
        address VARCHAR(500) NOT NULL,
        city VARCHAR(100) DEFAULT 'Камышин',
        phone VARCHAR(50) NOT NULL,
        worktime VARCHAR(255) DEFAULT '',
        coords VARCHAR(100) DEFAULT '',
        route TEXT DEFAULT '',
        images TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Безопасное добавление полей (миграции)
    await run(`ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]'`);
    await run(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT ''`);
    await run(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Камышин'`);
    await run(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS coords VARCHAR(100) DEFAULT ''`);
    await run(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS route TEXT DEFAULT ''`);
    await run(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]'`);

    await run(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await run(`CREATE INDEX IF NOT EXISTS prod_name_trgm_idx ON products USING gin (name gin_trgm_ops)`);

    // 🔥 ИНДЕКСЫ БАЗЫ ДАННЫХ ДЛЯ УСКОРЕНИЯ ВЫБОРКИ ПРИ 1000+ ТОВАРОВ
    await run(`CREATE INDEX IF NOT EXISTS idx_prod_category ON products(category_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_prod_badge ON products(badge)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_prod_stock ON products(quantity, in_stock)`);

    // Заполнение базовыми филиалами
    const shopsCount = await queryOne('SELECT COUNT(*)::int as count FROM shops');
    if (shopsCount && shopsCount.count === 0) {
        const initialShops = [
            ['Склад / Магазин №1', 'г. Камышин, 2-й железнодорожный переезд, корпус 1', 'Камышин', '+7 (84457) 9-00-99', 'пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00', '[50.10007069457058, 45.40316283702851]', 'https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15', '[]'],
            ['Магазин на Ленина', 'г. Камышин, ул. Ленина, 14А', 'Камышин', '+7 (84457) 9-11-19', 'пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00', '[50.105875308002666, 45.4138970375061]', 'https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15', '[]'],
            ['Магазин на Спартаковской', 'г. Камышин, ул. Спартаковская, 75', 'Камышин', '+7 (84457) 9-00-99', 'пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00', '[50.08035315572386, 45.407588481903076]', 'https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15', '[]'],
            ['Филиал Петров-Вал', 'г. Петров-Вал, ул. Ленина, 29', 'Петров-Вал', '+7 (84457) 9-00-99', 'пн-пт: 8:00 - 18:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00', '[50.135726811041174, 45.20690023899079]', 'https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15', '[]']
        ];
        for (const s of initialShops) {
            await run("INSERT INTO shops (name, address, city, phone, worktime, coords, route, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", s);
        }
    }
    // ДОПОЛНИТЕЛЬНЫЕ ИНДЕКСЫ ДЛЯ УСКОРЕНИЯ ЗАПРОСОВ
await run(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`);
await run(`CREATE INDEX IF NOT EXISTS idx_products_badge ON products(badge)`);
await run(`CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity)`);
await run(`CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock)`);
await run(`CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)`);
await run(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
await run(`CREATE INDEX IF NOT EXISTS idx_products_article ON products(article)`);
}

// ==========================================
// 4. МИДДЛВАРЫ И МУЛЬТЕР
// ==========================================
const translit = (str) => {
    const ru = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ь':'','ы':'y','ъ':'','э':'e','ю':'yu','я':'ya'};
    return str.toLowerCase().replace(/[а-яё]/g, m => ru[m]).replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '');
};

const sanitizeFilename = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9а-яё\s-]/gi, '').replace(/[\s-]+/g, '-').replace(/(^-|-$)/g, '');
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './image/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = req.body.name ? sanitizeFilename(req.body.name) : 'file';
        const randomStr = Math.random().toString(36).slice(2, 6); 
        cb(null, `${safeName}_${randomStr}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Допустимы только изображения (jpg, png, gif, webp)'));
    }
};

// 🔥 ОГРАНИЧЕНИЕ ВЕСА ФАЙЛА ДО 5 МБ (ЗАЩИТА ОТ DOS)
const upload = multer({ 
    storage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter 
});

app.use(express.json());
app.use(cookieParser());

// Кэширование статических файлов
app.use('/image', express.static(path.join(__dirname, 'image'), {
    maxAge: '30d',
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
}));
app.use('/banner', express.static(path.join(__dirname, 'banner')));
app.use('/js', express.static(path.join(__dirname, 'js'), { maxAge: '7d' }));
app.use('/css', express.static(path.join(__dirname, 'style.css'), { maxAge: '7d' }));

const authenticateToken = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await queryOne("SELECT id, name, email, phone, is_admin, is_company, company_name, company_inn, company_address, discount FROM users WHERE id = ?", [decoded.userId]);
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

app.use('/image', express.static(path.join(__dirname, 'image'), {
    maxAge: '30d',
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
        // Добавляем заголовок для lazy loading
        res.setHeader('Content-Disposition', 'inline');
    }
}));

// 🔥 ЗАЩИТА АДМИН-ПАНЕЛИ (Перенаправление неавторизованных)
app.get(['/admin', '/admin.html'], (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/admin-login');
    try {
        jwt.verify(token, SECRET_KEY);
        res.sendFile(path.join(__dirname, 'admin.html'));
    } catch (e) {
        res.redirect('/admin-login');
    }
});

// 🔥 SEO: ROBOTS.TXT
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://metizelektrod.ru/sitemap.xml`);
});

// 🔥 SEO: ДИНАМИЧЕСКИЙ SITEMAP.XML
app.get('/sitemap.xml', async (req, res) => {
    try {
        const categories = await queryAll("SELECT slug FROM categories");
        const baseUrl = process.env.APP_URL || 'https://metizelektrod.ru';
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        xml += `  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
        xml += `  <url><loc>${baseUrl}/catalog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
        xml += `  <url><loc>${baseUrl}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
        xml += `  <url><loc>${baseUrl}/contacts</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
        categories.forEach(c => {
            xml += `  <url><loc>${baseUrl}/catalog?category=${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
        });
        xml += `</urlset>`;
        res.type('application/xml');
        res.send(xml);
    } catch (e) {
        res.status(500).send('Error generating sitemap');
    }
});

// ==========================================
// 5. API СЕРВЕРА
// ==========================================

// --- ТОВАРЫ ---

app.get('/api/products/new', async (req, res) => {
    const limit = parseInt(req.query.limit) || 8;
    const products = await queryAll(
        "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.badge = 'new' AND p.quantity > 0 ORDER BY p.id DESC LIMIT ?",
        [limit]
    );
    res.json(products);
});

app.get('/api/products/hit', async (req, res) => {
    const limit = parseInt(req.query.limit) || 8;
    const products = await queryAll(
        "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.badge = 'hit' AND p.quantity > 0 ORDER BY p.id DESC LIMIT ?",
        [limit]
    );
    res.json(products);
});

app.get('/api/products/paginated', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 24;
      const category = req.query.category || null;
      const search = req.query.search || '';
      const sort = req.query.sort || 'default';
      
      const offset = (page - 1) * limit;
      let conditions = [];
      let params = [];
      let paramIndex = 1;
      
      // ✅ Оптимизация: используем EXISTS вместо JOIN для подсчёта
      if (category && category !== 'all') {
        const cat = await queryOne("SELECT id FROM categories WHERE slug = ?", [category]);
        if (cat) {
          conditions.push(`p.category_id = $${paramIndex++}`);
          params.push(cat.id);
        }
      }
      
      if (search.trim()) {
        conditions.push(`(p.name ILIKE $${paramIndex++} OR p.article ILIKE $${paramIndex++})`);
        params.push(`%${search}%`, `%${search}%`);
      }
      
      conditions.push(`(p.quantity > 0 OR p.in_stock = 1)`);
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // ✅ Оптимизация сортировки — используем простые индексы
      let orderClause = 'ORDER BY p.id DESC';
      if (sort === 'name') orderClause = 'ORDER BY p.name ASC';
      else if (sort === 'price_asc') orderClause = 'ORDER BY p.price ASC';
      else if (sort === 'price_desc') orderClause = 'ORDER BY p.price DESC';
      
      // ✅ Используем один запрос с CTE для подсчёта и выборки (быстрее)
      const query = `
        WITH filtered AS (
          SELECT p.id 
          FROM products p 
          ${whereClause}
        ),
        counted AS (
          SELECT COUNT(*)::int as total FROM filtered
        )
        SELECT 
          p.*, 
          c.name as category_name,
          (SELECT total FROM counted) as total_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id IN (SELECT id FROM filtered)
        ${orderClause}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      const dataRes = await pool.query(query, [...params, limit, offset]);
      const rows = dataRes.rows;
      
      // ✅ Берём total из первой строки (всегда одинаковый)
      const total = rows.length > 0 ? rows[0].total_count : 0;
      
      res.json({
        products: rows.map(({ total_count, ...p }) => p), // убираем total_count из каждого товара
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit) || 1
      });
    } catch (err) {
      logger.error(`Ошибка пагинированного каталога: ${err.message}`);
      res.status(500).json({ error: 'Ошибка загрузки каталога' });
    }
  });

app.get('/api/products/search', async (req, res) => {
    const query = req.query.q || '';
    const products = await queryAll(
        "SELECT *, similarity(name, ?) as sml FROM products WHERE similarity(name, ?) > 0.3 ORDER BY sml DESC", 
        [query, query]
    );
    res.json(products);
});

app.get('/api/products', async (req, res) => {
    res.json(await queryAll("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC"));
});

// Добавление товара (мультизагрузка файлов)
app.post('/api/products', authenticateToken, isAdminMiddleware, upload.any(), async (req, res, next) => {
    try {
        const { name, price, quantity, unit, category_id, badge, description, article } = req.body;
        
        let newFileUrls = [];
        if (req.files && req.files.length > 0) {
            newFileUrls = req.files.map(f => `/image/${f.filename}`);
        }

        let existingUrls = [];
        if (req.body.existing_images) {
            try {
                existingUrls = typeof req.body.existing_images === 'string' 
                    ? JSON.parse(req.body.existing_images) 
                    : req.body.existing_images;
            } catch (e) {
                existingUrls = [req.body.existing_images];
            }
        }

        const allImages = [...existingUrls, ...newFileUrls].filter(Boolean);
        const mainImage = allImages[0] || req.body.image_url || '';
        const imagesJson = JSON.stringify(allImages);

        await run(
            "INSERT INTO products (name, price, quantity, unit, category_id, image, images, badge, description, article) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
            [name, price, quantity, unit || 'шт', category_id || null, mainImage, imagesJson, badge, description, article]
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// Обновление товара (мультизагрузка файлов)
app.put('/api/products/:id', authenticateToken, isAdminMiddleware, upload.any(), async (req, res, next) => {
    try {
        const { name, price, quantity, unit, category_id, badge, description, article } = req.body;
        
        let newFileUrls = [];
        if (req.files && req.files.length > 0) {
            newFileUrls = req.files.map(f => `/image/${f.filename}`);
        }

        let existingUrls = [];
        if (req.body.existing_images) {
            try {
                existingUrls = typeof req.body.existing_images === 'string' 
                    ? JSON.parse(req.body.existing_images) 
                    : req.body.existing_images;
            } catch (e) {
                existingUrls = [req.body.existing_images];
            }
        }

        const allImages = [...existingUrls, ...newFileUrls].filter(Boolean);
        const mainImage = allImages[0] || req.body.image_url || '';
        const imagesJson = JSON.stringify(allImages);

        await run(
            "UPDATE products SET name=?, price=?, quantity=?, unit=?, category_id=?, image=?, images=?, badge=?, description=?, article=? WHERE id=?", 
            [name, price, quantity, unit || 'шт', category_id || null, mainImage, imagesJson, badge, description, article, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/products/:id', authenticateToken, isAdminMiddleware, async (req, res) => {
    await run("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.delete('/api/products', authenticateToken, isAdminMiddleware, async (req, res) => {
    await run("DELETE FROM products");
    res.json({ success: true });
});

// --- КАТЕГОРИИ ---
app.get('/api/categories', async (req, res) => {
    res.json(await queryAll("SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) as product_count FROM categories c"));
});

app.post('/api/categories', authenticateToken, isAdminMiddleware, async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Название категории обязательно' });
        const slug = translit(name);
        const catId = await run("INSERT INTO categories (name, slug) VALUES (?, ?)", [name, slug]);
        res.json({ success: true, id: catId, slug }); 
    } catch (err) {
        next(err); 
    }
});

app.put('/api/categories/:id', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { name } = req.body;
    const slug = translit(name);
    await run("UPDATE categories SET name = ?, slug = ? WHERE id = ?", [name, slug, req.params.id]);
    res.json({ success: true, slug });
});

app.delete('/api/categories/:id', authenticateToken, isAdminMiddleware, async (req, res) => {
    await run("UPDATE products SET category_id = NULL WHERE category_id = ?", [req.params.id]);
    await run("DELETE FROM categories WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

// --- ПОЛЬЗОВАТЕЛИ И СКИДКИ ---
app.get('/api/users', authenticateToken, isAdminMiddleware, async (req, res) => {
    try {
        const users = await queryAll("SELECT id, name, email, phone, is_admin, is_company, company_name, company_inn, company_address, discount, created_at FROM users ORDER BY id ASC");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки пользователей' });
    }
});

app.put('/api/users/:id/discount', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { discount } = req.body;
    const dVal = parseInt(discount);
    if (isNaN(dVal) || dVal < 0 || dVal > 100) return res.status(400).json({ error: 'Скидка должна быть от 0 до 100%' });
    try {
        await run("UPDATE users SET discount = ? WHERE id = ?", [dVal, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка БД' });
    }
});

app.put('/api/users/me', authenticateToken, async (req, res) => {
    const { name, email, is_company, company_name, company_inn, company_address } = req.body;
    if (email) {
        const existing = await queryOne("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user.id]);
        if (existing) return res.status(400).json({ error: 'Email уже используется' });
    }
    if (name !== undefined) await run("UPDATE users SET name = ? WHERE id = ?", [name, req.user.id]);
    if (email !== undefined) await run("UPDATE users SET email = ? WHERE id = ?", [email, req.user.id]);
    if (is_company !== undefined) await run("UPDATE users SET is_company = ? WHERE id = ?", [is_company, req.user.id]);
    if (company_name !== undefined) await run("UPDATE users SET company_name = ? WHERE id = ?", [company_name, req.user.id]);
    if (company_inn !== undefined) await run("UPDATE users SET company_inn = ? WHERE id = ?", [company_inn, req.user.id]);
    if (company_address !== undefined) await run("UPDATE users SET company_address = ? WHERE id = ?", [company_address, req.user.id]);
    res.json({ success: true });
});

// --- СТАТИСТИКА ПРОДАЖ ДЛЯ АДМИНКИ ---
app.get('/api/admin/stats', authenticateToken, isAdminMiddleware, async (req, res) => {
    try {
        const revenueData = await queryOne(`
            SELECT 
                COALESCE(SUM(total), 0)::numeric as total_revenue,
                COALESCE(AVG(total), 0)::numeric as avg_check,
                COUNT(*)::int as total_orders
            FROM orders 
            WHERE status != 'cancelled'
        `);

        const popularProduct = await queryOne(`
            SELECT p.name, SUM(oi.quantity)::numeric as total_qty
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY p.name
            ORDER BY total_qty DESC
            LIMIT 1
        `);

        const unpopularProduct = await queryOne(`
            SELECT p.name, SUM(oi.quantity)::numeric as total_qty
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY p.name
            ORDER BY total_qty ASC
            LIMIT 1
        `);

        const categorySales = await queryAll(`
            SELECT c.name as category, COALESCE(SUM(oi.quantity * oi.price), 0)::numeric as revenue
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY c.name
            ORDER BY revenue DESC
        `);

        const orderStatuses = await queryAll(`
            SELECT status, COUNT(*)::int as count
            FROM orders
            GROUP BY status
        `);

        res.json({
            revenue: Number(revenueData.total_revenue),
            avgCheck: Number(revenueData.avg_check),
            totalOrders: revenueData.total_orders,
            popularProduct: popularProduct ? { name: popularProduct.name, qty: Number(popularProduct.total_qty) } : null,
            unpopularProduct: unpopularProduct ? { name: unpopularProduct.name, qty: Number(unpopularProduct.total_qty) } : null,
            categorySales: categorySales.map(c => ({ category: c.category, revenue: Number(c.revenue) })),
            orderStatuses: orderStatuses.map(s => ({ status: s.status, count: s.count }))
        });
    } catch (err) {
        logger.error(`Ошибка сбора статистики: ${err.message}`);
        res.status(500).json({ error: 'Ошибка сервера при счете аналитики' });
    }
});

// --- ЗАКАЗЫ И РЕДАКТИРОВАНИЕ СОСТАВА ---
app.get('/api/orders', authenticateToken, async (req, res) => {
    if (req.user.is_admin && req.query.all === 'true') {
        res.json(await queryAll(
            "SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone, s.address as pickup_address FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN shops s ON o.pickup_point_id = s.id ORDER BY o.created_at DESC"
        ));
    } else {
        res.json(await queryAll(
            "SELECT o.*, s.address as pickup_address FROM orders o LEFT JOIN shops s ON o.pickup_point_id = s.id WHERE user_id = ? ORDER BY created_at DESC", [req.user.id]
        ));
    }
});

app.get('/api/orders/:id/items', authenticateToken, async (req, res) => {
    const order = await queryOne("SELECT user_id FROM orders WHERE id = ?", [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (!req.user.is_admin && order.user_id !== req.user.id) return res.status(403).json({ error: 'Доступ запрещен' });
    res.json(await queryAll("SELECT oi.*, p.name as product_name, p.unit as product_unit FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?", [req.params.id]));
});

app.put('/api/orders/:id/items', authenticateToken, isAdminMiddleware, async (req, res) => {
    const orderId = req.params.id;
    const { items } = req.body; 
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderRes = await client.query(convertPgQuery("SELECT status, user_id FROM orders WHERE id = ?"), [orderId]);
        const order = orderRes.rows[0];
        if (!order) throw new Error('Заказ не найден');
        const isCancelled = order.status === 'cancelled';
        const userRes = await client.query(convertPgQuery("SELECT discount FROM users WHERE id = ?"), [order.user_id]);
        const discountPercent = Number(userRes.rows[0]?.discount) || 0;
        
        if (!isCancelled) {
            const oldItemsRes = await client.query(convertPgQuery("SELECT product_id, quantity FROM order_items WHERE order_id = ?"), [orderId]);
            for (const oldItem of oldItemsRes.rows) {
                await client.query(convertPgQuery("UPDATE products SET quantity = quantity + CAST(? AS NUMERIC) WHERE id = ?"), [oldItem.quantity, oldItem.product_id]);
            }
        }
        await client.query(convertPgQuery("DELETE FROM order_items WHERE order_id = ?"), [orderId]);
        let newTotal = 0;
        for (const item of items) {
            const prodId = item.product_id;
            const qty = Number(item.quantity);
            if (qty <= 0) continue;
            const prodRes = await client.query(convertPgQuery("SELECT price, quantity, name FROM products WHERE id = ?"), [prodId]);
            const product = prodRes.rows[0];
            if (!product) throw new Error(`Товар ID ${prodId} не найден`);
            if (!isCancelled && Number(product.quantity) < qty) throw new Error(`Недостаточно товара "${product.name}"`);
            if (!isCancelled) await client.query(convertPgQuery("UPDATE products SET quantity = quantity - CAST(? AS NUMERIC) WHERE id = ?"), [qty, prodId]);
            
            const originalPrice = Number(product.price);
            const discountedPrice = discountPercent > 0 ? (originalPrice * (1 - discountPercent / 100)) : originalPrice;
            newTotal += discountedPrice * qty;
            await client.query(convertPgQuery("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)"), [orderId, prodId, qty, discountedPrice]);
        }
        await client.query(convertPgQuery("UPDATE orders SET total = ? WHERE id = ?"), [newTotal, orderId]);
        await client.query('COMMIT');
        res.json({ success: true, total: newTotal });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || 'Ошибка транзакции' });
    } finally {
        client.release();
    }
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    const orderId = req.params.id;
    const newStatus = req.body.status;
    const order = await queryOne("SELECT status, user_id FROM orders WHERE id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: 'Не найден' });
    if (!req.user.is_admin && order.user_id !== req.user.id) return res.status(403).json({ error: 'Доступ запрещен' });

    const oldStatus = order.status;
    await run("UPDATE orders SET status = ? WHERE id = ?", [newStatus, orderId]);
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
        const items = await queryAll("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]);
        for (let item of items) await run("UPDATE products SET quantity = quantity + CAST(? AS NUMERIC) WHERE id = ?", [item.quantity, item.product_id]);
    } else if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
        const items = await queryAll("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]);
        for (let item of items) await run("UPDATE products SET quantity = quantity - CAST(? AS NUMERIC) WHERE id = ?", [item.quantity, item.product_id]);
    }
    res.json({ success: true });
});

app.put('/api/orders/:id/pickup', authenticateToken, async (req, res) => {
    const { pickup_point_id } = req.body;
    await run("UPDATE orders SET pickup_point_id = ? WHERE id = ?", [pickup_point_id || null, req.params.id]);
    res.json({ success: true });
});

// --- МАГАЗИНЫ И ФИЛИАЛЫ ---
app.get('/api/shops', async (req, res) => {
    try {
        const shops = await queryAll("SELECT * FROM shops WHERE is_active = 1 ORDER BY id ASC");
        res.json(shops);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки магазинов' });
    }
});

app.get('/api/shops/all', authenticateToken, isAdminMiddleware, async (req, res) => {
    try {
        const shops = await queryAll("SELECT * FROM shops ORDER BY id ASC");
        res.json(shops);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки магазинов' });
    }
});

app.post('/api/shops', authenticateToken, isAdminMiddleware, upload.any(), async (req, res, next) => {
    try {
        const { name, address, city, phone, worktime, coords, route } = req.body;
        if (!address || !phone) return res.status(400).json({ error: 'Адрес и телефон обязательны' });

        let newFileUrls = [];
        if (req.files && req.files.length > 0) {
            newFileUrls = req.files.map(f => `/image/${f.filename}`);
        }

        let existingUrls = [];
        if (req.body.existing_images) {
            try {
                existingUrls = typeof req.body.existing_images === 'string' 
                    ? JSON.parse(req.body.existing_images) 
                    : req.body.existing_images;
            } catch (e) {
                existingUrls = [req.body.existing_images];
            }
        }

        const allImages = [...existingUrls, ...newFileUrls].filter(Boolean);
        const imagesJson = JSON.stringify(allImages);

        await run(
            "INSERT INTO shops (name, address, city, phone, worktime, coords, route, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [name || '', address, city || 'Камышин', phone, worktime || '', coords || '', route || '', imagesJson]
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

app.put('/api/shops/:id', authenticateToken, isAdminMiddleware, upload.any(), async (req, res, next) => {
    try {
        const { name, address, city, phone, worktime, coords, route, is_active } = req.body;
        
        let newFileUrls = [];
        if (req.files && req.files.length > 0) {
            newFileUrls = req.files.map(f => `/image/${f.filename}`);
        }

        let existingUrls = [];
        if (req.body.existing_images) {
            try {
                existingUrls = typeof req.body.existing_images === 'string' 
                    ? JSON.parse(req.body.existing_images) 
                    : req.body.existing_images;
            } catch (e) {
                existingUrls = [req.body.existing_images];
            }
        }

        const allImages = [...existingUrls, ...newFileUrls].filter(Boolean);
        const imagesJson = JSON.stringify(allImages);

        await run(
            "UPDATE shops SET name=?, address=?, city=?, phone=?, worktime=?, coords=?, route=?, images=?, is_active=? WHERE id=?",
            [name || '', address, city || 'Камышин', phone, worktime || '', coords || '', route || '', imagesJson, is_active ?? 1, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/shops/:id', authenticateToken, isAdminMiddleware, async (req, res) => {
    try {
        await run("DELETE FROM shops WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка БД' });
    }
});

// 🔥 АВТОРИЗАЦИЯ АДМИНА С ОГРАНИЧЕНИЕМ ПОПЫТОК (otpLimiter)
app.post('/api/admin/login', otpLimiter, async (req, res) => {
    const { contact, password } = req.body;
    const user = await queryOne("SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_admin = 1", [contact, contact]);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Неверные данные' });
    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1d' });
    res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax', 
        maxAge: 1 * 24 * 60 * 60 * 1000 
    });
    res.json({ user: { id: user.id, email: user.email, displayName: user.name, isAdmin: true } });
});

app.put('/api/admin/settings', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { contact, password } = req.body;
    const updates = [];
    const params = [];
    if (contact) {
        updates.push(contact.includes('@') ? "email = ?" : "phone = ?");
        params.push(contact.includes('@') ? contact : contact.replace(/\D/g, ''));
    }
    if (password) {
        if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        updates.push("password = ?");
        params.push(await bcrypt.hash(password, 10));
    }
    if (updates.length > 0) {
        params.push(req.user.id);
        await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    res.json({ success: true });
});

app.get('/api/images', authenticateToken, isAdminMiddleware, async (req, res) => {
    const dir = path.join(__dirname, 'image');
    if (!fs.existsSync(dir)) return res.json([]);
    try {
        const files = await fs.readdir(dir);
        const images = files.filter(f => f.match(/\.(jpg|jpeg|png|gif|webp)$/i)).map(f => `/image/${f}`);
        res.json(images);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка чтения папки' });
    }
});

app.get('/api/config/yandex-maps', (req, res) => {
    res.json({ apiKey: process.env.YANDEX_MAPS_API_KEY || '' });
});

// ==========================================
// ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК И СТАТИКА
// ==========================================
app.use((err, req, res, next) => {
    logger.error(`[Unhandled Error] ${err.status || 500} - ${err.message} - ${req.originalUrl}`);
    res.status(err.status || 500).json({ error: 'Внутренняя ошибка сервера.' });
});

// Отрисовка HTML-страниц с заменой переменных шаблона
app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        const filePath = path.join(__dirname, req.path === '/' ? 'index.html' : req.path + '.html');
        if (fs.existsSync(filePath)) {
            try {
                let content = await fs.readFile(filePath, 'utf-8');
                const mapsApiKey = process.env.YANDEX_MAPS_API_KEY || '';
                content = content.replace(/\{\{YANDEX_MAPS_API_KEY\}\}/g, mapsApiKey);
                return res.send(content);
            } catch (err) {
                return next(err);
            }
        }
    }
    next();
});

initDatabase().then(async () => {
    app.use(express.static(__dirname));
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server started on port ${PORT}`);
    });
}).catch(err => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
});