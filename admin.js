require('dotenv').config(); 

const { Pool } = require('pg');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// ТАКИЕ ЖЕ НАСТРОЙКИ КАК В SERVER.JS

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'metiz_elektrod'
});

async function main() {
    console.log('\n--- Создание Администратора (PostgreSQL) ---');
    
    try {
        const contact = await question('Введите Email ИЛИ Телефон администратора: ');
        if (!contact) return process.exit(1);
        
        const isEmail = contact.includes('@');
        const phone = isEmail ? null : contact.replace(/\D/g, '');

        const password = await question('Введите Пароль: ');
        if (password.length < 6) return console.error('Ошибка: минимум 6 символов');

        const name = await question('Введите Имя: ') || 'Admin';

        // Проверяем существование
        const query = isEmail ? `SELECT id FROM users WHERE email = $1` : `SELECT id FROM users WHERE phone = $1`;
        const existing = await pool.query(query, [isEmail ? contact : phone]);
        
        const hashedPass = await bcrypt.hash(password, 10);

        if (existing.rows.length > 0) {
            const upd = await question('Пользователь существует. Сделать его админом и обновить пароль? (y/n): ');
            if (upd.toLowerCase() === 'y') {
                await pool.query(
                    `UPDATE users SET is_admin = 1, password = $1, name = $2 WHERE id = $3`,
                    [hashedPass, name, existing.rows[0].id]
                );
                console.log('Пользователь обновлен до Администратора.');
            }
        } else {
            await pool.query(
                `INSERT INTO users (name, email, phone, password, is_admin) VALUES ($1, $2, $3, $4, 1)`,
                [name, isEmail ? contact : null, isEmail ? null : phone, hashedPass]
            );
            console.log('Новый Администратор успешно добавлен!');
        }

    } catch (err) {
        console.error('Ошибка:', err);
    } finally {
        rl.close();
        await pool.end(); // Корректное закрытие
    }
}

main();