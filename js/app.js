import API from './api.js';
import { initYandexMap } from './map.js';

let currentUser = null;
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'default';
let authCurrentContact = '';
let authStep = 1;

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function bootstrap() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.innerText = new Date().getFullYear();

  try {
    const data = await API.auth.me();
    if (data && data.user) {
      currentUser = data.user;
      updateUIForLoggedInUser(currentUser);
    }
  } catch (e) {
    console.log('No user session found');
  }

  updateCartBadge();
  setupNavigation();
  initPageFunctions();
  initAuthMasking();
  
  // ВЫЗЫВАЕМ НАШ СКРИПТ РКН
  enforceRKN(); 
}
// ===== МАСКИРОВКА ВВОДА =====
function initAuthMasking() {
  const input = document.getElementById('authContact');
  const icon = document.getElementById('input-type-icon');
  if (!input) return;

  input.addEventListener('input', (e) => {
    let val = e.target.value;
    if (val.includes('@')) {
      if (icon) icon.innerHTML = '<i class="fas fa-envelope"></i> EMAIL';
      return;
    }
    const hasOnlyPhoneChars = /^[\d\s\+\(\)\-]+$/.test(val);
    if (hasOnlyPhoneChars && val.length > 1) {
      if (icon) icon.innerHTML = '<i class="fas fa-phone"></i> PHONE';
      let cleaned = val.replace(/\D/g, '');
      if (cleaned.startsWith('8')) cleaned = '7' + cleaned.slice(1);
      if (!cleaned.startsWith('7') && cleaned.length > 0) cleaned = '7' + cleaned;
      let masked = '+7';
      if (cleaned.length > 1) masked += ' (' + cleaned.slice(1, 4);
      if (cleaned.length >= 4) masked += ') ' + cleaned.slice(4, 7);
      if (cleaned.length >= 7) masked += '-' + cleaned.slice(7, 9);
      if (cleaned.length >= 9) masked += '-' + cleaned.slice(9, 11);
      input.value = masked.slice(0, 18);
    } else {
      if (icon) icon.innerHTML = '';
    }
  });
}

// ===== SPA НАВИГАЦИЯ =====
function setupNavigation() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && link.origin === window.location.origin) {
      const path = link.getAttribute('href');
      // Проверяем, что это не якорная ссылка и не файл
      if (path && !path.includes('.') && !path.startsWith('mailto:') && !path.startsWith('tel:') && !path.startsWith('#')) {
        e.preventDefault();
        
        // БАГФИКС: ПРИНУДИТЕЛЬНО ЗАКРЫВАЕМ ВСЕ МОДАЛЬНЫЕ ОКНА ПРИ ПЕРЕХОДЕ ПО ССЫЛКЕ
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('open');
        });
        
        navigate(path);
      }
    }
  });
  window.onpopstate = () => loadPage(window.location.pathname + window.location.search, false);
}
async function navigate(path) {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState({}, '', path);
  await loadPage(path);
}

async function loadPage(path, triggerPushState = true) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.classList.add('loading');
  try {
    const response = await fetch(path);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const newTitle = doc.querySelector('title');
    if (newTitle) document.title = newTitle.innerText;

    const newMain = doc.querySelector('main');
    if (newMain) {
      window.scrollTo(0, 0);
      main.innerHTML = newMain.innerHTML;
      updateHeaderActive(new URL(path, window.location.origin).pathname);
      initPageFunctions(new URL(path, window.location.origin).pathname, new URL(path, window.location.origin).searchParams);
      enforceRKN();
    }
  } catch (err) {
    console.error('Navigation error:', err);
  } finally {
    main.classList.remove('loading');
  }
}

function updateHeaderActive(path) {
  document.querySelectorAll('.shop-nav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === path || (path === '/' && (href === '/' || href === '/index')));
  });
}

function initPageFunctions(path = window.location.pathname, params = new URLSearchParams(window.location.search)) {
  if (path === '/' || path === '/index') initHomeCategories();
  else if (path.includes('catalog')) initCatalog(params);
  else if (path.includes('account')) initAccount();
  else if (path.includes('contacts')) initYandexMap();
}

// ===== КАТЕГОРИИ НА ГЛАВНОЙ =====
async function initHomeCategories() {
  const container = document.getElementById('homeCategories');
  if (!container) return;
  try {
    const cats = await API.categories.getAll();
    const icons = {
      'welding': '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c4-1 6-5 6-10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v6c0 5 2 9 6 10z"/><rect x="9" y="8" width="6" height="4" rx="1" stroke="var(--brand)" fill="var(--brand)" fill-opacity="0.2"/></svg>',
      'rigging': '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="var(--brand)"/></svg>',
      'metal': '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><circle cx="7" cy="16" r="4" stroke="var(--brand)"/><circle cx="17" cy="16" r="4"/></svg>',
      'tools': '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
      'fasteners': '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 16 4 16 8 12 10 8 8 8 4 12 2"/><path d="M10 10v12"/><path d="M14 10v12"/><path d="M10 13h4" stroke="var(--brand)"/><path d="M10 17h4" stroke="var(--brand)"/></svg>',
      'default': '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    };
    container.innerHTML = cats.map((c) => `
      <a href="/catalog?category=${c.id}" class="category-card">
        <div class="category-icon">${icons[c.slug] || icons['default']}</div>
        <h3 class="category-title">${c.name}</h3>
        <div class="category-footer"><span>${c.product_count || 0} товаров</span><div class="category-arrow"><i class="fas fa-chevron-right"></i></div></div>
      </a>
    `).join('');
  } catch (err) {
    console.error('Home categories error:', err);
  }
}

// ===== КАТАЛОГ =====
async function initCatalog(params) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  currentFilter = params && params.get('category') ? params.get('category') : 'all';
  try {
    const [products, cats] = await Promise.all([API.products.getAll(), API.categories.getAll()]);
    allProducts = products;
    const catGrid = document.getElementById('filters');
    if (catGrid) {
      catGrid.innerHTML = `<div class="cat-tag-item ${currentFilter === 'all' ? 'active' : ''}" data-id="all">Все товары</div>` + cats.map(c => `<div class="cat-tag-item ${currentFilter == c.id ? 'active' : ''}" data-id="${c.id}">${c.name}</div>`).join('');
      catGrid.querySelectorAll('.cat-tag-item').forEach(item => {
        item.onclick = () => {
          catGrid.querySelectorAll('.cat-tag-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          currentFilter = item.dataset.id;
          const newUrl = currentFilter === 'all' ? '/catalog' : `/catalog?category=${currentFilter}`;
          window.history.replaceState({}, '', newUrl);
          renderProducts();
        };
      });
    }
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.oninput = (e) => { currentSearch = e.target.value.toLowerCase(); renderProducts(); };
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.onchange = (e) => { currentSort = e.target.value; renderProducts(); };
    renderProducts();
  } catch (err) {
    console.error('Catalog init error:', err);
  }
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  
  let filtered = allProducts.filter(p => (currentFilter === 'all' || p.category_id == currentFilter) && p.name.toLowerCase().includes(currentSearch));
  
  if (currentSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  if (currentSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  if (currentSort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:100px 40px;text-align:center;"><h3>Товаров не найдено</h3></div>';
    return;
  }
  
  grid.innerHTML = filtered.map(p => {
    const hasImg = p.image && p.image.length > 5;
    const imgHtml = hasImg ? `<img src="${p.image}" alt="${p.name}">` : '📦';
    const inCartQty = cart.filter(id => String(id) === String(p.id)).length;
    const outOfStock = (p.quantity || 0) <= 0;
    
    // onClick вызовет лупу, только если у товара есть картинка
    const imgAction = hasImg ? `onclick="window.openImageModal('${p.image}')"` : '';
    
    return `<div class="product-card" style="${outOfStock ? 'filter:grayscale(1);opacity:0.7;' : ''}">
      <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
        ${imgHtml}
        ${inCartQty > 0 ? `<div style="position:absolute;top:10px;right:10px;background:var(--brand);color:white;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;">${inCartQty}</div>` : ''}
      </div>
      <div class="product-info">
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;opacity:0.3;margin-bottom:6px;">${p.category_name || 'Без категории'}</div>
        
        <!-- Заголовок урезан до 2 строк, чтобы карточки были одной высоты -->
        <h3 style="font-size:12px;font-weight:900;text-transform:uppercase;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;min-height:28px;">
            ${p.name}
        </h3>
        
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;">
          <div style="font-size:16px;font-weight:900;color:var(--brand);">${p.price} ₽</div>
          <button onclick="window.addToCart('${p.id}')" class="icon-btn" style="background:var(--dark);color:white;border:none;width:32px;height:32px;font-size:12px;" ${outOfStock ? 'disabled' : ''}>
            <i class="fas fa-shopping-cart"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===== ЛИЧНЫЙ КАБИНЕТ =====
async function initAccount() {
  const userNameEl = document.getElementById('userName');
  if (!userNameEl) return;
  const data = await API.auth.me();
  if (!data || !data.user) { navigate('/'); return; }
  const user = data.user;
  
  userNameEl.innerText = user.displayName || user.name || 'Пользователь';
  const phoneEl = document.getElementById('userPhone');
  const emailEl = document.getElementById('userEmail');
  if (phoneEl) phoneEl.innerText = user.phone || 'Не указан';
  if (emailEl) emailEl.innerText = user.email || 'Не указана';
  
  const adminLink = document.getElementById('adminLink');
  if (user.isAdmin && adminLink) adminLink.style.display = 'block';
  
  try {
    const orders = await API.orders.getMine();
    document.getElementById('orderCount').innerText = orders.length;
    const ordersList = document.getElementById('ordersList');
    
    if (orders && orders.length > 0 && ordersList) {
      const statusDict = { 'new': 'Новый', 'processing': 'В обработке', 'shipped': 'Отправлен', 'completed': 'Выполнен', 'cancelled': 'Отменен' };
      
      ordersList.innerHTML = orders.map(order => {
        // Отменить можно только новые заказы и те, что в обработке
        const canCancel = ['new', 'processing'].includes(order.status);
        const stName = statusDict[order.status] || order.status;
        const color = order.status === 'cancelled' ? '#EF4444' : (order.status === 'completed' ? '#10B981' : 'var(--dark)');
        
        return `<div class="about-list-item" style="border:1px solid var(--dark); padding:16px; margin-bottom:16px; background:white;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; font-size:14px; font-weight:900;">Заказ #${order.id}</h4>
            <span style="font-size:10px; font-weight:900; text-transform:uppercase; color:${color}; background:var(--gray-bg); padding:4px 8px; border-radius:4px;">${stName}</span>
          </div>
          <p style="margin-bottom:16px; font-weight:700; opacity:0.8; font-size:12px;">${new Date(order.created_at).toLocaleDateString()} | ${order.total} ₽</p>
          <div style="display:flex; gap:8px;">
            <button onclick="viewUserOrder(${order.id})" class="hero-btn" style="padding:8px; font-size:9px; flex:1; justify-content:center;"><i class="fas fa-eye" style="margin-right:4px;"></i> Чек</button>
            ${canCancel ? `<button onclick="cancelUserOrder(${order.id})" class="hero-btn" style="padding:8px; font-size:9px; flex:1; justify-content:center; background:none; border:1px solid #EF4444; color:#EF4444;"><i class="fas fa-times" style="margin-right:4px;"></i> Отменить</button>` : ''}
          </div>
        </div>`;
      }).join('');
    } else {
      if(ordersList) ordersList.innerHTML = '<p style="opacity:0.5;">История заказов пуста</p>';
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== АВТОРИЗАЦИЯ =====
function openAuthModal() { document.getElementById('authModal')?.classList.add('open'); }
function closeAuthModal() { document.getElementById('authModal')?.classList.remove('open'); }

// ===== АВТОРИЗАЦИЯ =====
async function handleAuth() {
  const contactInput = document.getElementById('authContact');
  const contactStep = document.getElementById('authContactStep');
  const codeStep = document.getElementById('authCodeStep');
  const nameStep = document.getElementById('authNameStep');
  const codeInput = document.getElementById('authCode');
  const nameInput = document.getElementById('authName');
  const actionBtn = document.getElementById('authActionBtn');
  const codePreview = document.getElementById('codePreview');
  const consentCheckbox = document.getElementById('pd-consent'); // Чекбокс РКН

  // 1. Очищаем введенный контакт
  let contact = contactInput.value.trim();
  if (!contact.includes('@')) contact = contact.replace(/\D/g, ''); // Оставляем только цифры для телефона
  
  if (!contact) { 
    alert('Пожалуйста, введите email или номер телефона'); 
    return; 
  }

  // ==========================================
  // ШАГ 1: ОТПРАВКА КОДА
  // ==========================================
  if (authStep === 1) {
    // Проверка согласия с Политикой (152-ФЗ)
    if (consentCheckbox && !consentCheckbox.checked) {
        alert('Для продолжения необходимо дать согласие на обработку персональных данных!');
        return;
    }

    // Блокируем кнопку от спама кликами
    const originalBtnText = actionBtn.innerText;
    actionBtn.innerText = 'Отправка...';
    actionBtn.disabled = true;

    try {
      // Отправляем запрос на сервер
      const res = await API.auth.requestCode(contact);
      
      authCurrentContact = contact;
      authStep = 2; // Переключаем стейт
      
      // Скрываем ввод контакта, показываем ввод кода
      if (contactStep) contactStep.style.display = 'none';
      if (codeStep) codeStep.style.display = 'block';
      
      // Если пользователя нет в базе (новый клиент), показываем инпут для имени
      if (res.exists === false && nameStep) {
          nameStep.style.display = 'block';
      }
      
      actionBtn.innerText = 'Подтвердить код';
      
      // Показываем подсказку с кодом (в реальном проекте убирается)
      if (res.code && codePreview) {
          codePreview.innerText = 'Тестовый код: ' + res.code;
      }
      
    } catch (err) { 
      alert('Ошибка: ' + (err.message || 'Не удалось отправить код')); 
      actionBtn.innerText = originalBtnText; // Возвращаем текст при ошибке
    } finally {
      actionBtn.disabled = false; // Разблокируем кнопку
    }
  } 
  
  // ==========================================
  // ШАГ 2: ПРОВЕРКА КОДА И ВХОД
  // ==========================================
  else if (authStep === 2) {
    const code = codeInput.value.trim();
    const name = nameInput ? nameInput.value.trim() : '';

    if (code.length !== 6) { 
        alert('Пожалуйста, введите 6-значный код'); 
        return; 
    }

    // Если это регистрация (поле имени видимо), заставляем ввести имя
    if (nameStep && nameStep.style.display === 'block' && !name) {
        alert('Пожалуйста, укажите ваше имя');
        return;
    }

    // Блокируем кнопку на время проверки
    const originalBtnText = actionBtn.innerText;
    actionBtn.innerText = 'Проверка...';
    actionBtn.disabled = true;

    try {
      // Отправляем код, контакт и имя на верификацию
      const data = await API.auth.verifyCode(authCurrentContact, code, name);
      
      if (data.user) {
          completeLogin(data.user);
      }
    } catch (err) { 
      alert('Ошибка: ' + (err.message || 'Неверный код')); 
      actionBtn.innerText = originalBtnText;
    } finally {
      actionBtn.disabled = false; // Разблокируем кнопку
    }
  }
}

function completeLogin(user) {
  localStorage.setItem('user', JSON.stringify(user));
  currentUser = user;
  updateUIForLoggedInUser(currentUser);
  closeAuthModal();
  authStep = 1;
  window.location.reload();
}

async function handleLogout() {
  await API.auth.logout();
  localStorage.removeItem('user');
  window.location.href = '/';
}

function updateUIForLoggedInUser(user) {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  if (loginBtn && user) {
    loginBtn.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;background:var(--brand);color:white;">${(user.displayName || user.name || 'U')[0]}</div>`;
    loginBtn.onclick = () => navigate('/account');
  }
  if (logoutBtn && user) logoutBtn.style.display = 'flex';
}

// ===== КОРЗИНА =====
function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) badge.innerText = cart.length;
}

async function addToCart(productId) {
  if (allProducts.length === 0) allProducts = await API.products.getAll();
  const p = allProducts.find(item => String(item.id) === String(productId));
  const inCartQty = cart.filter(id => String(id) === String(productId)).length;
  if (p && inCartQty >= p.quantity) { alert('Доступно только ' + p.quantity + ' шт.'); return; }
  cart.push(productId);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  if (window.location.pathname.includes('catalog')) renderProducts();
}

async function updateCartQuantity(productId, delta) {
  if (delta > 0) {
    if (allProducts.length === 0) allProducts = await API.products.getAll();
    const p = allProducts.find(item => String(item.id) === String(productId));
    const inCartQty = cart.filter(id => String(id) === String(productId)).length;
    if (p && inCartQty + delta > p.quantity) { alert('Доступно только ' + p.quantity + ' шт.'); return; }
    cart.push(productId);
  } else {
    const idx = cart.findIndex(id => String(id) === String(productId));
    if (idx !== -1) cart.splice(idx, 1);
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
  if (window.location.pathname.includes('catalog')) renderProducts();
}

async function openCart() {
  document.getElementById('cartModal')?.classList.add('open');
  await renderCart();
}

function closeCart() { document.getElementById('cartModal')?.classList.remove('open'); }

function removeFromCart(productId) {
  cart = cart.filter(id => String(id) !== String(productId));
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}

async function renderCart() {
  const container = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');
  if (!container) return;
  
  if (cart.length === 0) {
    container.innerHTML = '<p style="opacity:0.5;text-align:center;padding:40px 0;">Корзина пуста</p>';
    if (footer) footer.style.display = 'none';
    return;
  }
  
  const products = await API.products.getAll();
  const validCart = cart.filter(id => products.some(p => String(p.id) === String(id)));
  if (validCart.length !== cart.length) {
      cart = validCart;
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartBadge();
  }

  if (cart.length === 0) {
      container.innerHTML = '<p style="opacity:0.5;text-align:center;padding:40px 0;">Товары закончились или были удалены</p>';
      if (footer) footer.style.display = 'none';
      return;
  }

  if (footer) footer.style.display = 'block';
  const cartProducts = cart.map(id => products.find(p => String(p.id) === String(id))).filter(Boolean);
  const grouped = cartProducts.reduce((acc, p) => { if (!acc[p.id]) acc[p.id] = { ...p, count: 0 }; acc[p.id].count++; return acc; }, {});
  
  let total = 0;
  container.innerHTML = Object.values(grouped).map(item => {
    total += item.price * item.count;
    return `<div style="display:flex;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid rgba(0,0,0,0.1);">
      <div style="width:50px;height:50px;background:var(--gray-bg);display:flex;align-items:center;justify-content:center;">📦</div>
      <div style="flex:1;"><div style="font-weight:700;font-size:12px;">${item.name}</div><div style="color:var(--brand);font-weight:900;">${item.price} ₽</div></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="window.updateCartQuantity('${item.id}', -1)" style="width:24px;height:24px;border:1px solid var(--dark);background:white;cursor:pointer;">−</button>
        <span style="font-weight:700;">${item.count}</span>
        <button onclick="window.updateCartQuantity('${item.id}', 1)" style="width:24px;height:24px;border:1px solid var(--dark);background:white;cursor:pointer;">+</button>
      </div>
      <button onclick="window.removeFromCart('${item.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">&times;</button>
    </div>`;
  }).join('');
  totalEl.textContent = total + ' ₽';
}

async function checkout() {
  const data = await API.auth.me();
  if (!data || !data.user) { alert('Войдите для оформления заказа'); closeCart(); openAuthModal(); return; }
  if (cart.length === 0) return;
  const products = await API.products.getAll();
  const cartProducts = cart.map(id => products.find(p => String(p.id) === String(id))).filter(Boolean);
  const grouped = cartProducts.reduce((acc, p) => { if (!acc[p.id]) acc[p.id] = { ...p, quantity: 0 }; acc[p.id].quantity++; return acc; }, {});
  
  try {
    await API.orders.create({ items: Object.values(grouped).map(it => ({ id: it.id, quantity: it.quantity })) });
    alert('Заказ оформлен!');
    cart = [];
    localStorage.setItem('cart', '[]');
    updateCartBadge();
    closeCart();
    navigate('/account');
  } catch (err) {
    alert(err.message || 'Ошибка при оформлении заказа');
  }
}

// ===== СМЕНА ИМЕНИ В ЛИЧНОМ КАБИНЕТЕ =====
window.toggleEditName = function() {
  const form = document.getElementById('editNameForm');
  const nameSpan = document.getElementById('userName');
  const editBtn = document.getElementById('editNameBtn');
  const input = document.getElementById('newNameInput');
  
  if (!form) return;

  if (form.style.display === 'none') {
    form.style.display = 'flex';
    nameSpan.style.display = 'none';
    editBtn.style.display = 'none';
    input.value = currentUser?.displayName || currentUser?.name || '';
    input.focus();
  } else {
    form.style.display = 'none';
    nameSpan.style.display = 'block';
    editBtn.style.display = 'block';
  }
};

// ===== ПРОСМОТР И ОТМЕНА ЗАКАЗА ПОЛЬЗОВАТЕЛЕМ =====
window.viewUserOrder = async function(orderId) {
  document.getElementById('userOrderModal').classList.add('open');
  document.getElementById('modalUserOrderTitle').innerText = 'Заказ #' + orderId;
  const list = document.getElementById('userOrderItemsList');
  list.innerHTML = '<p style="font-size:11px; opacity:0.5;">Загрузка...</p>';
  
  try {
    const items = await API.orders.getItems(orderId);
    if(items.length === 0) {
       list.innerHTML = '<p style="font-size:11px; opacity:0.5;">Пусто</p>';
       return;
    }
    list.innerHTML = items.map(i => 
      `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:8px;">
        <span style="font-weight:700;">${i.product_name || 'Удаленный товар'}</span>
        <span>${i.quantity} шт. x <span style="color:var(--brand);">${i.price} ₽</span></span>
      </div>`
    ).join('');
  } catch(e) {
    list.innerHTML = '<p style="font-size:11px; color:#EF4444;">Ошибка загрузки чека</p>';
  }
};

window.closeUserOrderModal = function() {
  document.getElementById('userOrderModal').classList.remove('open');
};

window.cancelUserOrder = async function(orderId) {
  if(!confirm('Вы уверены, что хотите отменить этот заказ?')) return;
  
  try {
    await API.orders.updateStatus(orderId, 'cancelled');
    alert('Заказ успешно отменен!');
    initAccount(); // Обновляем список заказов на странице
  } catch(e) {
    alert(e.message || 'Ошибка при отмене заказа');
  }
};

window.saveNewName = async function() {
  const input = document.getElementById('newNameInput');
  const newName = input.value.trim();
  if (!newName) return alert('Имя не может быть пустым!');

  try {
    // ВНИМАНИЕ: Используем новый метод updateProfile
    await API.auth.updateProfile({ name: newName });
    if (currentUser) {
      currentUser.displayName = newName;
      currentUser.name = newName;
      localStorage.setItem('user', JSON.stringify(currentUser));
    }
    document.getElementById('userName').innerText = newName;
    toggleEditName();
    updateUIForLoggedInUser(currentUser);
  } catch (err) {
    alert(err.message || 'Ошибка при сохранении имени');
  }
};

window.toggleEditEmail = function() {
  const form = document.getElementById('editEmailForm');
  const emailSpan = document.getElementById('userEmail');
  const editBtn = document.getElementById('editEmailBtn');
  const input = document.getElementById('newEmailInput');
  
  if (!form) return;

  if (form.style.display === 'none') {
    form.style.display = 'flex';
    emailSpan.style.display = 'none';
    editBtn.style.display = 'none';
    input.value = currentUser?.email || '';
    input.focus();
  } else {
    form.style.display = 'none';
    emailSpan.style.display = 'block';
    editBtn.style.display = 'block';
  }
};

window.saveNewEmail = async function() {
  const input = document.getElementById('newEmailInput');
  const newEmail = input.value.trim();
  if (!newEmail || !newEmail.includes('@')) return alert('Введите корректный адрес электронной почты!');

  try {
    await API.auth.updateProfile({ email: newEmail });
    if (currentUser) {
      currentUser.email = newEmail;
      localStorage.setItem('user', JSON.stringify(currentUser));
    }
    document.getElementById('userEmail').innerText = newEmail;
    toggleEditEmail();
    alert('Почта успешно сохранена!');
  } catch (err) {
    alert(err.message || 'Ошибка при сохранении Email');
  }
};

// ===== УВЕЛИЧЕНИЕ ФОТО ТОВАРА =====
// Динамически создаем HTML для лупы, если его еще нет
if (!document.getElementById('imgZoomModal')) {
  const modalHtml = `
  <div id="imgZoomModal" class="img-zoom-modal" onclick="closeImageModal()">
      <div class="img-zoom-content" onclick="event.stopPropagation()">
          <button class="img-zoom-close" onclick="closeImageModal()">&times;</button>
          <img id="imgZoomTarget" src="" alt="Увеличенное фото">
      </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.openImageModal = function(src) {
  document.getElementById('imgZoomTarget').src = src;
  document.getElementById('imgZoomModal').classList.add('open');
};

window.closeImageModal = function() {
  document.getElementById('imgZoomModal').classList.remove('open');
};

// ===== РОСКОМНАДЗОР (152-ФЗ) =====

function enforceRKN() {
  // 1. АВТОМАТИЧЕСКИЙ ФУТЕР
  document.querySelectorAll('.footer-links a').forEach(a => {
    if (a.textContent.includes('Политика')) {
        a.href = '/policy';
        a.textContent = 'Политика конфиденциальности';
    }
    if (a.textContent.includes('Условия')) {
        a.href = '/terms';
        a.textContent = 'Пользовательское соглашение';
    }
  });

  // 2. COOKIE БАННЕР
  const cookieForever = localStorage.getItem('rkn_cookie_consent_v3'); // Сохранение навсегда
  const cookieSession = sessionStorage.getItem('rkn_cookie_consent_v3'); // Сохранение на 1 сессию
  
  if (!cookieForever && !cookieSession && !document.getElementById('cookie-banner')) {
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
      <div style="flex: 1; display:flex; flex-direction:column; gap:8px;">
        <div style="line-height:1.4;">Мы используем файлы cookie. Продолжая работу, вы соглашаетесь с <a href="/policy" style="color:var(--brand); text-decoration:underline;">Политикой</a>.</div>
        <div style="display:flex; align-items:center; gap:8px;">
            <!-- ГАЛОЧКА СНЯТА ПО УМОЛЧАНИЮ -->
            <input type="checkbox" id="hide-cookie-forever" style="cursor:pointer; width:14px; height:14px; margin:0;">
            <label for="hide-cookie-forever" style="font-size:10px; opacity:0.8; cursor:pointer;">Больше не показывать уведомление</label>
        </div>
      </div>
      <button class="hero-btn" onclick="acceptCookies()" style="padding: 12px 24px; font-size: 10px; flex-shrink:0; background:var(--brand); border-color:var(--brand);"><i class="fas fa-check" style="margin-right:6px;"></i>Понятно</button>
    `;
    document.body.appendChild(banner);
  }

  // 3. ГАЛОЧКА В МОДАЛКЕ РЕГИСТРАЦИИ
  const authStep1 = document.getElementById('authContactStep');
  if (authStep1 && !document.getElementById('pd-consent-wrap')) {
    authStep1.insertAdjacentHTML('beforeend', `
      <div id="pd-consent-wrap" style="display:flex; gap:8px; align-items:flex-start; margin-bottom: 1rem; text-align: left;">
        <input type="checkbox" id="pd-consent" style="margin-top: 2px; cursor: pointer;">
        <label for="pd-consent" style="font-size: 9px; opacity: 0.6; line-height: 1.4; cursor: pointer;">
          Я даю согласие на обработку моих персональных данных согласно <a href="/policy" style="color:var(--brand)">Политике</a> и принимаю <a href="/terms" style="color:var(--brand)">Условия соглашения</a>.
        </label>
      </div>
    `);
  }
}

// 4. ЛОГИКА СОХРАНЕНИЯ СОГЛАСИЯ
window.acceptCookies = function() {
  const neverShow = document.getElementById('hide-cookie-forever');
  
  // Если пользователь поставил галочку -> запоминаем навсегда в localStorage
  if (neverShow && neverShow.checked) {
    localStorage.setItem('rkn_cookie_consent_v3', 'true');
  } else {
    // Если галочки нет -> запоминаем только до закрытия вкладки
    sessionStorage.setItem('rkn_cookie_consent_v3', 'true');
  }
  
  // Полностью удаляем баннер со страницы
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.remove(); 
};


// ===== ГЛОБАЛЬНЫЕ ПРИВЯЗКИ =====
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleAuth = handleAuth;
window.handleLogout = handleLogout;
window.addToCart = addToCart;
window.openCart = openCart;
window.closeCart = closeCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.checkout = checkout;
window.navigate = navigate;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.toggleEditEmail = toggleEditEmail;
window.saveNewEmail = saveNewEmail;

document.addEventListener('DOMContentLoaded', bootstrap);