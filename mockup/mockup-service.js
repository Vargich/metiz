const express = require('express');
const app = express();
const PORT = 4000;

// Ультра-простой HTML скелет для вайрфреймов
const html = (content, title = 'Wireframe') => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} — Метиз Электрод</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: #ccc; 
            display: flex; 
            justify-content: center; 
            padding: 40px 20px;
            font-family: 'Courier New', monospace;
        }
        .frame {
            max-width: 1200px;
            width: 100%;
            background: white;
            border: 2px solid black;
        }
        /* Только чёрные рамки, без цветов */
        .b { border: 1px solid black; }
        .bb { border-bottom: 1px solid black; }
        .bt { border-top: 1px solid black; }
        .br { border-right: 1px solid black; }
        .p-4 { padding: 16px; }
        .p-3 { padding: 12px; }
        .p-2 { padding: 8px; }
        .flex { display: flex; }
        .grid { display: grid; }
        .gap-4 { gap: 16px; }
        .gap-2 { gap: 8px; }
        .between { justify-content: space-between; }
        .center { align-items: center; }
        .wrap { flex-wrap: wrap; }
        .col { flex-direction: column; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .mb-4 { margin-bottom: 16px; }
        .mb-2 { margin-bottom: 8px; }
        .mt-4 { margin-top: 16px; }
        .mt-2 { margin-top: 8px; }
        .p-relative { position: relative; }
        .w-100 { width: 100%; }
        .w-50 { width: 50%; }
        .h-100 { height: 100%; }
        .bg-gray { background: #f0f0f0; }
        .mock-img {
            background: #e0e0e0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 150px;
        }
    </style>
</head>
<body>
    <div class="frame">${content}</div>
</body>
</html>`;

// Шапка (общая для всех страниц)
const header = `
    <div class="flex between center p-4 bb">
        <div class="bold">МЕТИЗ ЭЛЕКТРОД</div>
        <div class="flex gap-4">
            <a href="/" style="color:black; text-decoration:none;">Главная</a>
            <a href="/catalog" style="color:black; text-decoration:none;">Каталог</a>
            <a href="/about" style="color:black; text-decoration:none;">О нас</a>
            <a href="/contacts" style="color:black; text-decoration:none;">Контакты</a>
        </div>
        <div class="flex gap-2">
            <div class="b p-2"></div>
            <div class="b p-2"> <span id="cart-count">0</span></div>
        </div>
    </div>
`;

// Футер
const footer = `<div class="text-center p-4 bt bold">© Метиз Электрод — промышленный хаб</div>`;

// СТРАНИЦЫ
const pages = {
    // Главная
    home: `
        ${header}
        <div class="p-4 bg-gray bb">
            <div class="bold mb-2">Промышленные решения с 2006</div>
            <div class="bold" style="font-size: 48px;">КРЕПЁЖ<br/>СИЛА<br/>СТАЛЬ</div>
            <div class="mt-4 mb-4">Профессиональный крепёж, сварочное оборудование и инструмент. Прямые поставки от заводов.</div>
            <div class="flex gap-2">
                <div class="b p-2 bold">КАТАЛОГ</div>
                <div class="b p-2 bold">О КОМПАНИИ</div>
            </div>
        </div>
        <div class="grid" style="grid-template-columns: repeat(4,1fr);">
            <div class="p-4 text-center br bb"><div></div><div class="bold">Крепёж</div></div>
            <div class="p-4 text-center br bb"><div></div><div class="bold">Сварка</div></div>
            <div class="p-4 text-center br bb"><div></div><div class="bold">Инструмент</div></div>
            <div class="p-4 text-center bb"><div></div><div class="bold">Прокат</div></div>
        </div>
        <div class="grid" style="grid-template-columns: repeat(4,1fr);">
            <div class="p-3 text-center br">15 лет</div>
            <div class="p-3 text-center br">Доставка</div>
            <div class="p-3 text-center br">1000+</div>
            <div class="p-3 text-center">НДС</div>
        </div>
        ${footer}
    `,

    // Каталог
    catalog: `
        ${header}
        <div class="p-4">
            <div class="bold" style="font-size: 32px;" class="mb-4">КАТАЛОГ</div>
            <div class="flex gap-2 mb-4">
                <div class="b p-2" style="flex:1;">Поиск...</div>
                <div class="b p-2">Сортировка ▼</div>
            </div>
            <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 16px;">
                ${[1,2,3,4,5].map(i => `
                    <div class="b">
                        <div class="mock-img p-4 bb">📷</div>
                        <div class="p-3">
                            <div class="bold">Товар #${i}</div>
                            <div class="mt-2">${1000 + i*500} ₽</div>
                            <div class="b p-2 text-center mt-2 bold">В КОРЗИНУ</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ${footer}
    `,

    // О нас
    about: `
        ${header}
        <div class="flex">
            <div class="w-50 p-4 br">
                <div class="bold mb-2">О КОМПАНИИ</div>
                <div class="bold" style="font-size: 32px;">НАДЁЖНОСТЬ<br/>С 2006</div>
                <div class="mt-4 mb-4">Метиз Электрод — поставщик промышленных материалов и оборудования в Камышине и области.</div>
                <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="b p-2 text-center bold">Дилер</div>
                    <div class="b p-2 text-center bold">Склад</div>
                    <div class="b p-2 text-center bold">Опт</div>
                    <div class="b p-2 text-center bold">НДС</div>
                </div>
            </div>
            <div class="w-50 p-4 bg-gray">
                <div class="bold mb-2">ПОЧЕМУ МЫ</div>
                <div class="mb-4"><span class="bold">Складской запас</span><br/>1000+ позиций</div>
                <div class="mb-4"><span class="bold">Сертификация</span><br/>ГОСТ, DIN</div>
                <div><span class="bold">Гибкость</span><br/>Физлица и юрлица</div>
            </div>
        </div>
        ${footer}
    `,

    // Контакты
    contacts: `
        ${header}
        <div class="flex">
            <div class="w-50 p-4 br">
                <div class="bold" style="font-size: 32px;">КОНТАКТЫ</div>
                <div class="mt-4 mb-2 bold">Отдел продаж</div>
                <div class="bold" style="font-size: 24px;">+7 (84457) 9-00-99</div>
                <div class="mt-4 mb-2 bold">Оптовые закупки</div>
                <div class="bold" style="font-size: 24px;">+7 (961) 089-38-12</div>
                <div class="mt-4 mb-2 bold">Email</div>
                <div>metiz-elektrod@mail.ru</div>
                <div class="mt-4 p-3 bg-gray"><span class="bold">Офис:</span> г. Камышин, 2-й железнодорожный переезд, корпус 1</div>
            </div>
            <div class="w-50 p-4 bg-gray flex center">
                <div>[ КАРТА ]</div>
            </div>
        </div>
        ${footer}
    `,

    // Корзина (модалка)
    cart: `
        ${header}
        <div class="p-relative" style="min-height: 500px;">
            <div class="b p-4" style="max-width: 500px; margin: 40px auto; background: white;">
                <div class="flex between center mb-4">
                    <div class="bold" style="font-size: 24px;">КОРЗИНА</div>
                    <div class="b p-2">✕</div>
                </div>
                <div class="bb pb-2 mb-2 flex between"><span>УШМ Makita</span><span>4 500 ₽ x1</span></div>
                <div class="bb pb-2 mb-2 flex between"><span>Болт М12х40</span><span>45 ₽ x50</span></div>
                <div class="flex between mb-4 bold"><span>ИТОГО:</span><span>6 750 ₽</span></div>
                <div class="b p-3 text-center bold">ОФОРМИТЬ ЗАКАЗ</div>
            </div>
        </div>
        ${footer}
    `,

    // Авторизация
    auth: `
        ${header}
        <div class="p-relative" style="min-height: 500px;">
            <div class="b p-4" style="max-width: 400px; margin: 40px auto;">
                <div class="bold text-center" style="font-size: 20px;" class="mb-4">ВХОД / РЕГИСТРАЦИЯ</div>
                <div class="b p-2 mb-4 text-center">+7 (___) ___-__-__</div>
                <div class="flex gap-2 mb-4"><input type="checkbox"> <span class="bold">Согласие на обработку данных</span></div>
                <div class="b p-3 text-center bold">ПОЛУЧИТЬ КОД</div>
            </div>
        </div>
        ${footer}
    `,

    // Админка
    admin: `
        <div class="flex between center p-4 bb bg-gray">
            <div class="bold">МЕТИЗ АДМИН</div>
            <div class="bold">ВЫЙТИ</div>
        </div>
        <div class="flex gap-2 p-4 bb">
            <div class="b p-2 bg-gray bold">ТОВАРЫ</div>
            <div class="b p-2 bold">ЗАКАЗЫ (3)</div>
            <div class="b p-2 bold">КАТЕГОРИИ</div>
        </div>
        <div class="p-4">
            <div class="flex between center mb-4">
                <div class="bold">Товары (1042)</div>
                <div class="b p-2 bold">+ ДОБАВИТЬ</div>
            </div>
            <div class="b">
                <div class="flex between p-3 bb bg-gray bold">
                    <span style="width: 80px;">ID</span>
                    <span style="flex:1;">Название</span>
                    <span style="width: 100px;">Остаток</span>
                    <span style="width: 60px;"></span>
                </div>
                <div class="flex between p-3 bb">
                    <span style="width: 80px;">#145</span>
                    <span style="flex:1;">Сварочный инвертор</span>
                    <span style="width: 100px;">10 шт</span>
                    <span style="width: 60px;">✏️</span>
                </div>
                <div class="flex between p-3">
                    <span style="width: 80px;">#146</span>
                    <span style="flex:1;">Круг отрезной</span>
                    <span style="width: 100px;">1 шт</span>
                    <span style="width: 60px;">✏️</span>
                </div>
            </div>
        </div>
        ${footer}
    `,

    // Личный кабинет
    account: `
        ${header}
        <div class="flex">
            <div class="w-50 p-4 br">
                <div class="bold" style="font-size: 28px;">Иван Иванов</div>
                <div class="mb-4">ivan@example.com</div>
                <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 16px;" class="mb-4">
                    <div class="b p-3 text-center"><div class="bold">3</div><div>заказа</div></div>
                    <div class="b p-3 text-center"><div class="bold">Постоянный</div><div>статус</div></div>
                </div>
                
            </div>
            <div class="w-50 p-4 bg-gray">
                <div class="bold mb-2">ИСТОРИЯ ЗАКАЗОВ</div>
                <div class="mb-2">Заказ #001 — 12 500 ₽</div>
                <div class="mb-2">Заказ #002 — 3 200 ₽</div>
                <div>⏳ Заказ #003 — 890 ₽</div>
            </div>
        </div>
        ${footer}
    `,

    // Карточка товара
    product: `
        ${header}
        <div class="flex p-4">
            <div class="w-50 br p-4">
                <div class="mock-img" style="height: 300px;">📷 ФОТО</div>
            </div>
            <div class="w-50 p-4">
                <div class="bold mb-2">Сварка</div>
                <div class="bold" style="font-size: 28px;">Инвертор РЕСАНТА</div>
                <div class="bold" style="font-size: 32px;" class="mt-2 mb-2">12 500 ₽</div>
                <div class="mb-4">Мощность 5 кВт, диаметр электродов до 5 мм.</div>
                <div class="b p-2 bg-gray mb-4">Остаток: 10 шт</div>
                <div class="flex gap-2">
                    <div class="b p-3 bold text-center" style="flex:1;">В КОРЗИНУ</div>
                    <div class="b p-3 bold text-center" style="flex:1;">1 КЛИК</div>
                </div>
            </div>
        </div>
        ${footer}
    `,

    // Оформление заказа
    checkout: `
        ${header}
        <div class="p-4">
            <div class="bold" style="font-size: 28px;" class="mb-4">ОФОРМЛЕНИЕ ЗАКАЗА</div>
            <div class="flex gap-4">
                <div style="flex:2;">
                    <div class="mb-3"><div class="bold mb-1">ФИО</div><div class="b p-2">Иванов Иван Иванович</div></div>
                    <div class="mb-3"><div class="bold mb-1">Телефон</div><div class="b p-2">+7 (___) ___-__-__</div></div>
                    <div class="mb-3"><div class="bold mb-1">Адрес</div><div class="b p-2">г. Камышин, ул...</div></div>
                </div>
                <div style="flex:1;" class="b p-4 bg-gray">
                    <div class="bold mb-2">ВАШ ЗАКАЗ</div>
                    <div class="bb pb-2 mb-2">УШМ Makita — 4 500 ₽</div>
                    <div class="bb pb-2 mb-2">Болт М12х40 — 2 250 ₽</div>
                    <div class="flex between bold mt-2"><span>ИТОГО:</span><span>6 750 ₽</span></div>
                    <div class="b p-3 text-center bold mt-4">ПОДТВЕРДИТЬ</div>
                </div>
            </div>
        </div>
        ${footer}
    `
};

// Маршруты
app.get('/', (req, res) => res.send(html(pages.home, 'Главная')));
app.get('/catalog', (req, res) => res.send(html(pages.catalog, 'Каталог')));
app.get('/about', (req, res) => res.send(html(pages.about, 'О нас')));
app.get('/contacts', (req, res) => res.send(html(pages.contacts, 'Контакты')));
app.get('/cart', (req, res) => res.send(html(pages.cart, 'Корзина')));
app.get('/auth', (req, res) => res.send(html(pages.auth, 'Авторизация')));
app.get('/admin', (req, res) => res.send(html(pages.admin, 'Админка')));
app.get('/account', (req, res) => res.send(html(pages.account, 'Личный кабинет')));
app.get('/product', (req, res) => res.send(html(pages.product, 'Товар')));
app.get('/checkout', (req, res) => res.send(html(pages.checkout, 'Оформление')));

app.listen(PORT, () => {
    console.log(`\n🚀 Вайрфреймы запущены: http://localhost:${PORT}\n`);
    console.log(`📄 Доступные страницы:`);
    console.log(`   /          - Главная`);
    console.log(`   /catalog   - Каталог`);
    console.log(`   /about     - О компании`);
    console.log(`   /contacts  - Контакты`);
    console.log(`   /cart      - Корзина`);
    console.log(`   /auth      - Авторизация`);
    console.log(`   /admin     - Админ-панель`);
    console.log(`   /account   - Личный кабинет`);
    console.log(`   /product   - Карточка товара`);
    console.log(`   /checkout  - Оформление заказа`);
});