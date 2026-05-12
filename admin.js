const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = 'metiz.db';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log('\n--- Создание Администратора (Metiz Elektrod SQL) ---');
    
    try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        let db;

        if (fs.existsSync(DB_FILE)) {
            const buffer = fs.readFileSync(DB_FILE);
            db = new SQL.Database(buffer);
        } else {
            console.log('База данных не найдена. Создаю новую...');
            db = new SQL.Database();
            db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, password TEXT NOT NULL, address TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        }

        const email = await question('Введите Email администратора: ');
        if (!email || !email.includes('@')) {
            console.error('Ошибка: Некорректный email');
            process.exit(1);
        }

        const password = await question('Введите Пароль: ');
        if (!password || password.length < 6) {
            console.error('Ошибка: Пароль должен быть не менее 6 символов');
            process.exit(1);
        }

        const name = await question('Введите Имя (необязательно): ') || 'Admin';

        // Check if user exists
        const res = db.exec("SELECT id FROM users WHERE email = ?", [email]);
        const hashedPass = await bcrypt.hash(password, 10);

        if (res.length > 0 && res[0].values.length > 0) {
            const update = await question('Пользователь существует. Обновить до администратора? (y/n): ');
            if (update.toLowerCase() === 'y') {
                db.run("UPDATE users SET is_admin = 1, password = ?, name = ? WHERE email = ?", [hashedPass, name, email]);
                console.log('Пользователь обновлен.');
            } else {
                console.log('Отмена.');
                process.exit(0);
            }
        } else {
            db.run("INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)", [name, email, hashedPass]);
            console.log('Администратор добавлен.');
        }

        const data = db.export();
        fs.writeFileSync(DB_FILE, Buffer.from(data));
        console.log('База сохранена.\n');

    } catch (err) {
        console.error('Ошибка:', err);
    } finally {
        rl.close();
    }
}

main();
