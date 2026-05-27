require('dotenv').config(); 

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'dev-secret-only-for-development';

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
        // Запись ошибок в файл error.log
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // Запись всех логов в файл combined.log
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

// В режиме разработки пишем логи дополнительно в консоль с красивой подсветкой
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// ==========================================
// НАСТРОЙКА ЛИМИТЕРА ЗАПРОСОВ (Rate Limiter)
// ==========================================
// Ограничение: не более 3 запросов OTP-кода в минуту с одного IP
const otpLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 3, 
    message: { error: 'Слишком много запросов кода. Пожалуйста, подождите 1 минуту перед повторной попыткой.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// ==========================================
// 1. НАСТРОЙКИ POSTGRESQL, ПОЧТЫ И TELEGRAM
// ==========================================

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'metiz_elektrod'
});

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru', 
    port: 465,
    secure: true,
    auth: {
        user: 'ВАШ_EMAIL@mail.ru',  
        pass: 'ВАШ_ПАРОЛЬ_ДЛЯ_ВНЕШНИХ_ПРИЛОЖЕНИЙ' 
    }
});

const TG_BOT_TOKEN = 'ВАШ_ТОКЕН_БОТА'; 

// ==========================================
// 2. ОБЕРТКИ ДЛЯ РАБОТЫ С БАЗОЙ
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

async function initDatabase() {
    await run(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL UNIQUE)`);
    await run(`CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(255) NOT NULL, 
        article VARCHAR(255) NOT NULL DEFAULT '', 
        price NUMERIC NOT NULL, 
        quantity NUMERIC(10,3) DEFAULT 0, 
        unit VARCHAR(10) DEFAULT 'шт',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, 
        image TEXT DEFAULT '', 
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
    await run(`CREATE TABLE IF NOT EXISTS otp_codes (contact VARCHAR(255) PRIMARY KEY, code VARCHAR(50), expires_at BIGINT)`);

    
    // Таблица магазинов
    await run(`CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        address VARCHAR(500) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        worktime VARCHAR(255) DEFAULT '',
        is_active INTEGER DEFAULT 1
    )`);

    // Демо-данные
    const catCount = await queryOne('SELECT COUNT(*)::int as count FROM categories');
    if (catCount && catCount.count === 0) {
        const cats = [['Сварка', 'welding'], ['Такелаж', 'rigging'], ['Прокат', 'metal'], ['Инструмент', 'tools'], ['Крепёж', 'fasteners'], ['Абразивы', 'abrasives'], ['Спецодежда', 'workwear']];
        for (const c of cats) await run("INSERT INTO categories (name, slug) VALUES (?, ?)", c);
    }

    const prodCount = await queryOne('SELECT COUNT(*)::int as count FROM products');
    if (prodCount && prodCount.count === 0) {
        const products = [
            ['Сварочный инвертор Ресанта САИ-220', 'СВ-001', 12500, 10, 'шт', 1, '', 'hit', 1],
            ['Электроды УОНИ 13/55 3мм (1кг)', 'СВ-002', 350, 25.5, 'кг', 1, '', 'new', 1],
            ['Цепь длиннозвенная 8мм DIN 763', 'ТК-001', 210, 50, 'м', 2, '', 'hit', 1],
            ['Болт М8х40 оцинкованный', 'Б-008', 850, 15.2, 'кг', 3, '', '', 1],
            ['Проволока сварочная Св-08Г2С 1.2мм', 'СВ-003', 180, 100, 'кг', 1, '', 'hit', 1]
        ];
        for (const p of products) await run(
            'INSERT INTO products (name, article, price, quantity, unit, category_id, image, badge, in_stock) VALUES (?,?,?,?,?,?,?,?,?)', p
        );
    }

    const shopsCount = await queryOne('SELECT COUNT(*)::int as count FROM shops');
    if (shopsCount && shopsCount.count === 0) {
        const shops = [
            ['г. Камышин, 2-й железнодорожный переезд, корп. 1', '+7(84457) 9-00-99', 'Пн-Пт 8:00-17:00, Сб 9:00-14:00'],
            ['г. Камышин, ул. Пролетарская, д. 45', '+7(961)089-38-12', 'Пн-Сб 9:00-18:00']
        ];
        for (const s of shops) await run(
            "INSERT INTO shops (address, phone, worktime) VALUES (?, ?, ?)", s
        );
    }
}

// ==========================================
// 3. ОТПРАВКА КОДА
// ==========================================

async function sendAuthCode(contact, code) {
    if (contact.includes('@')) {
        await transporter.sendMail({
            from: '"Метиз Электрод" <metiz-elektrod@mail.ru>', 
            to: contact,
            subject: 'Код для входа',
            text: `Ваш код для входа на сайт: ${code}\nНикому его не сообщайте.`
        });
        return true;
    } else {
        const tgUser = await queryOne("SELECT chat_id FROM tg_users WHERE phone = ?", [contact.replace(/\D/g, '')]);
        if (tgUser && tgUser.chat_id) {
            await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: tgUser.chat_id,
                    text: `🔐 Ваш код для входа на сайт: *${code}*`,
                    parse_mode: 'Markdown'
                })
            });
            return true;
        } else {
            throw new Error('Телефон не привязан к нашему Telegram боту! Используйте Email или запустите бота.');
        }
    }
}

// ==========================================
// 4. КОНФИГУРАЦИЯ SERVER
// ==========================================

const translit = (str) => {
    const ru = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ь':'','ы':'y','ъ':'','э':'e','ю':'yu','я':'ya'};
    return str.toLowerCase().replace(/[а-яё]/g, m => ru[m]).replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '');
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './image/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = req.body.name ? translit(req.body.name) : 'product';
        const randomStr = Math.random().toString(36).slice(2, 6); 
        cb(null, `${safeName}_${randomStr}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });
const handleImageUpload = upload.single('image');

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/image', express.static(path.join(__dirname, 'image')));

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

app.get('/admin', async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/admin-login');
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await queryOne("SELECT id FROM users WHERE id = ? AND is_admin = 1", [decoded.userId]);
        if (!user) return res.redirect('/admin-login');
        next(); 
    } catch (e) {
        res.redirect('/admin-login');
    }
});

app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        const filePath = path.join(__dirname, req.path === '/' ? 'index.html' : req.path + '.html');
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
    }
    next();
});

// ==========================================
// 5. РОУТЫ (API)
// ==========================================

// Аутентификация
app.post('/api/admin/login', async (req, res) => {
    const { contact, password } = req.body;
    const user = await queryOne("SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_admin = 1", [contact, contact]);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Неверные данные' });
    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1d' });
res.cookie('token', token, { 
    httpOnly: true, // Предотвращает чтение токена через XSS-скрипты на клиенте
    secure: process.env.NODE_ENV === 'production', // Передача только по HTTPS в продакшене
    sameSite: 'lax', // Защита от CSRF-атак
    maxAge: 1 * 24 * 60 * 60 * 1000 // Время жизни куки — 1 день
});
    res.cookie('token', token, { httpOnly: true });
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

// Пользователи
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

// Магазины
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

app.post('/api/shops', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { address, phone, worktime } = req.body;
    if (!address || !phone) return res.status(400).json({ error: 'Адрес и телефон обязательны' });
    try {
        await run("INSERT INTO shops (address, phone, worktime) VALUES (?, ?, ?)", [address, phone, worktime || '']);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка БД' });
    }
});

app.put('/api/shops/:id', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { address, phone, worktime, is_active } = req.body;
    try {
        await run("UPDATE shops SET address=?, phone=?, worktime=?, is_active=? WHERE id=?", 
            [address, phone, worktime, is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка БД' });
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

// OTP-авторизация
// Найти роут отправки кода и заменить его объявление:
app.post('/api/auth/request-code', otpLimiter, async (req, res) => {
    let { contact } = req.body;
    if (!contact) return res.status(400).json({ error: 'Контакт обязателен' });
    if (!contact.includes('@')) contact = contact.replace(/\D/g, '');
    const user = await queryOne("SELECT id, name, email, phone FROM users WHERE email = ? OR phone = ?", [contact, contact]);
    const code = String(Math.floor(1000 + Math.random() * 9000));
    try {
        await run(`INSERT INTO otp_codes (contact, code, expires_at) VALUES (?, ?, ?) ON CONFLICT (contact) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`, [contact, code, Date.now() + 300000]);
        
        // В продакшене отправляем код, в деве — логируем
        logger.info(`Сгенерирован OTP-код для контакта ${contact}`);
        
        res.json({ success: true, exists: !!user, user: user || null, code: code });
    } catch (e) {
        logger.error(`Ошибка при генерации OTP для ${contact}: ${e.message}`);
        res.status(500).json({ error: e.message || 'Ошибка отправки' });
    }
});

app.put('/api/users/me/phone', authenticateToken, async (req, res) => {
    let { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Телефон и код обязательны' });
    
    phone = phone.replace(/\D/g, ''); // Оставляем только цифры
    
    // 1. Проверяем OTP код из таблицы otp_codes
    const savedOtp = await queryOne(`SELECT * FROM otp_codes WHERE contact = ?`, [phone]);
    if (!savedOtp) return res.status(400).json({ error: 'Сначала запросите код подтверждения!' });
    if (Date.now() > Number(savedOtp.expires_at)) return res.status(400).json({ error: 'Код подтверждения устарел.' });
    if (savedOtp.code !== code.trim()) return res.status(400).json({ error: 'Неверный код подтверждения!' });
    
    // 2. Проверяем, не привязан ли этот номер к другой учетной записи
    const existing = await queryOne("SELECT id FROM users WHERE phone = ? AND id != ?", [phone, req.user.id]);
    if (existing) return res.status(400).json({ error: 'Этот номер телефона уже привязан к другому аккаунту' });
    
    // 3. Сохраняем телефон и очищаем код
    try {
        await run("UPDATE users SET phone = ? WHERE id = ?", [phone, req.user.id]);
        await run(`DELETE FROM otp_codes WHERE contact = ?`, [phone]);
        res.json({ success: true });
    } catch (err) {
        logger.error(`Ошибка привязки телефона: ${err.message}`);
        res.status(500).json({ error: 'Ошибка базы данных' });
    }
});


app.post('/api/auth/verify-code', async (req, res) => {
    let { contact, code, name } = req.body;
    if (!contact.includes('@')) contact = contact.replace(/\D/g, '');
    const savedOtp = await queryOne(`SELECT * FROM otp_codes WHERE contact = ?`, [contact]);
    if (!savedOtp) return res.status(400).json({ error: 'Сначала запросите код!' });
    if (Date.now() > Number(savedOtp.expires_at)) return res.status(400).json({ error: 'Код устарел.' });
    if (savedOtp.code !== code.trim()) return res.status(400).json({ error: 'Неверный код!' });
    await run(`DELETE FROM otp_codes WHERE contact = ?`, [contact]);
    let user = await queryOne("SELECT id, name, email, phone, is_admin FROM users WHERE email = ? OR phone = ?", [contact, contact]);
    if (!user) {
        const isEmail = contact.includes('@');
        await run("INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)", [name || 'Клиент', isEmail ? contact : null, isEmail ? null : contact, 'no-password']);
        user = await queryOne("SELECT id, name, email, phone, is_admin FROM users WHERE email = ? OR phone = ?", [contact, contact]);
    }
   const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '7d' });
res.cookie('token', token, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'lax', 
    maxAge: 7 * 24 * 60 * 60 * 1000 // Время жизни куки — 7 дней
});
    res.cookie('token', token, { httpOnly: true });
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: !!user.is_admin } });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ 
        user: { 
            id: req.user.id, 
            email: req.user.email, 
            phone: req.user.phone, 
            name: req.user.name, 
            displayName: req.user.name, 
            isAdmin: !!req.user.is_admin, 
            is_company: req.user.is_company || 0,
            company_name: req.user.company_name || '',
            company_inn: req.user.company_inn || '',
            company_address: req.user.company_address || '',
            discount: req.user.discount || 0 
        } 
    });
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

// Изображения
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

// Категории
app.get('/api/categories', async (req, res) => {
    res.json(await queryAll("SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) as product_count FROM categories c"));
});

app.post('/api/categories', authenticateToken, isAdminMiddleware, async (req, res) => {
    const { name } = req.body;
    const slug = translit(name);
    await run("INSERT INTO categories (name, slug) VALUES (?, ?)", [name, slug]);
    res.json({ success: true, slug });
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

// Товары
app.get('/api/products', async (req, res) => {
    res.json(await queryAll("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC"));
});

app.post('/api/products', authenticateToken, isAdminMiddleware, handleImageUpload, async (req, res) => {
    const { name, price, quantity, unit, category_id, badge, description, article } = req.body;
    const image = req.file ? `/image/${req.file.filename}` : (req.body.image_url || '');
    await run("INSERT INTO products (name, price, quantity, unit, category_id, image, badge, description, article) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [name, price, quantity, unit || 'шт', category_id || null, image, badge, description, article]);
    res.json({ success: true });
});

app.put('/api/products/:id', authenticateToken, isAdminMiddleware, handleImageUpload, async (req, res) => {
    const { name, price, quantity, unit, category_id, badge, description, article } = req.body;
    const existing = await queryOne("SELECT image FROM products WHERE id = ?", [req.params.id]);
    const image = req.file ? `/image/${req.file.filename}` : (req.body.image_url !== undefined ? req.body.image_url : existing.image);
    await run("UPDATE products SET name=?, price=?, quantity=?, unit=?, category_id=?, image=?, badge=?, description=?, article=? WHERE id=?", 
        [name, price, quantity, unit || 'шт', category_id || null, image, badge, description, article, req.params.id]);
    res.json({ success: true });
});

app.delete('/api/products/:id', authenticateToken, isAdminMiddleware, async (req, res) => {
    await run("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

// Заказы
app.get('/api/orders', authenticateToken, async (req, res) => {
    if (req.user.is_admin && req.query.all === 'true') {
        res.json(await queryAll(
            "SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone, s.address as pickup_address FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN shops s ON o.pickup_point_id = s.id ORDER BY o.created_at DESC"
        ));
    } else {
        // ДЛЯ ОБЫЧНОГО ПОЛЬЗОВАТЕЛЯ — ДОБАВЛЕН pickup_point_id и pickup_address
        res.json(await queryAll(
            "SELECT o.*, s.address as pickup_address FROM orders o LEFT JOIN shops s ON o.pickup_point_id = s.id WHERE user_id = ? ORDER BY created_at DESC", [req.user.id]
        ));
    }
});

app.put('/api/orders/:id/pickup', authenticateToken, async (req, res) => {
    const orderId = req.params.id;
    const { pickup_point_id } = req.body;
    
    const order = await queryOne("SELECT user_id, status FROM orders WHERE id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    
    // Проверка прав: админ или владелец заказа
    if (!req.user.is_admin && order.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    // Клиент может менять только до отправки
    if (!req.user.is_admin && (order.status === 'shipped' || order.status === 'completed')) {
        return res.status(400).json({ error: 'Нельзя изменить пункт выдачи после отправки заказа' });
    }
    
    try {
        await run("UPDATE orders SET pickup_point_id = ? WHERE id = ?", [pickup_point_id || null, orderId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка БД' });
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
            if (!isCancelled && Number(product.quantity) < qty) throw new Error(`Недостаточно товара "${product.name}" на складе. Доступно: ${product.quantity}`);
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

app.post('/api/orders', authenticateToken, async (req, res) => {
    const { items, pickup_point_id } = req.body;
    let serverTotal = 0;
    const validItems = [];
    for (const item of items) {
        const product = await queryOne("SELECT id, price, quantity, name FROM products WHERE id = ?", [item.id]);
        const qty = Number(item.quantity); // ← ПРИВЕДЕНИЕ К ЧИСЛУ
        if (!product || Number(product.quantity) < qty) {
            return res.status(400).json({ error: `Товара "${product?.name || 'неизвестно'}" недостаточно` });
        }
        validItems.push({ id: product.id, quantity: qty, price: product.price });
    }
    
    const discountPercent = req.user.discount || 0;
    try {
        for (const item of validItems) {
            const originalPrice = Number(item.price);
            const discountedPrice = discountPercent > 0 ? (originalPrice * (1 - discountPercent / 100)) : originalPrice;
            const qty = Number(item.quantity); // ← ЕЩЁ РАЗ ДЛЯ НАДЁЖНОСТИ
            serverTotal += discountedPrice * qty;
        }
        
    
        const orderId = await run("INSERT INTO orders (user_id, total, pickup_point_id) VALUES (?, ?, ?)", [req.user.id, serverTotal, pickup_point_id || null]);
        for (const item of validItems) {
            const originalPrice = Number(item.price);
            const discountedPrice = discountPercent > 0 ? (originalPrice * (1 - discountPercent / 100)) : originalPrice;
            const qty = Number(item.quantity);
            
            await run("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)", [orderId, item.id, qty, discountedPrice]);
            await run("UPDATE products SET quantity = quantity - ? WHERE id = ?", [qty, item.id]);
        }
        res.json({ success: true, orderId: orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка БД' });
    }
});
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    const orderId = req.params.id;
    const newStatus = req.body.status;
    const order = await queryOne("SELECT status, user_id FROM orders WHERE id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: 'Не найден' });
    if (!req.user.is_admin) {
        if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Доступ запрещен' });
        if (newStatus !== 'cancelled') return res.status(403).json({ error: 'Можно только отменить' });
    }
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

// ==========================================
// 6. ТЕЛЕГРАММ ВЕБХУК ДЛЯ ПРИВЯЗКИ
// ==========================================

if (TG_BOT_TOKEN && TG_BOT_TOKEN !== 'ВАШ_ТОКЕН_БОТА') {
    let lastUpdateId = 0;
    async function pollTelegram() {
        try {
            const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
            const data = await res.json();
            for (const item of data.result) {
                lastUpdateId = item.update_id;
                const msg = item.message;
                if (msg) {
                    if (msg.text === '/start') {
                        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                chat_id: msg.chat.id,
                                text: 'Привет! Нажмите кнопку внизу, чтобы привязать номер для кодов авторизации 👇',
                                reply_markup: { keyboard: [[{text: "📲 Поделиться номером", request_contact: true}]], resize_keyboard: true, one_time_keyboard: true}
                            })
                        });
                    }
                    if (msg.contact) {
                        const phone = msg.contact.phone_number.replace(/\D/g, '');
                        await run(`INSERT INTO tg_users (phone, chat_id) VALUES (?, ?) ON CONFLICT (phone) DO UPDATE SET chat_id = EXCLUDED.chat_id`, [phone, msg.chat.id]);
                        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                chat_id: msg.chat.id,
                                text: `✅ Ваш номер привязан. Коды авторизации теперь будут приходить сюда!`,
                                reply_markup: { remove_keyboard: true }
                            })
                        });
                    }
                }
            }
        } catch (e) {}
        setTimeout(pollTelegram, 1000);
    }
    pollTelegram();
}
// ==========================================
// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ==========================================
app.use((err, req, res, next) => {
    logger.error(`[Unhandled Error] ${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    res.status(err.status || 500).json({ error: 'Внутренняя ошибка сервера. Подробности записаны в системный журнал.' });
});
// ==========================================
// 7. ЗАПУСК СЕРВЕРА
// ==========================================

initDatabase().then(async () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const distPath = path.join(__dirname, 'dist');
    const distExists = fs.existsSync(distPath);
    if (isProduction && distExists) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(distPath, 'index.html'));
            }
        });
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Production Server started on http://localhost:${PORT}`);
        });
    } else {
        const { createServer: createViteServer } = require('vite');
        const vite = await createViteServer({ 
            server: { middlewareMode: true }, 
            appType: 'spa' 
        });
        app.use(vite.middlewares);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Dev Server & Vite started on http://localhost:${PORT}`);
        });
    }
}).catch(err => {
    logger.error("Database connection failed: " + err.message);
});