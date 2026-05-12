import API from './api.js';
import { initYandexMap } from './map.js';

let currentUser = null;

// Export functions to global scope
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.goToStep2 = goToStep2;
window.handleAuth = handleAuth;
window.handleLogout = handleLogout;
window.addToCart = addToCart;
window.openCart = openCart;
window.closeCart = closeCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.checkout = checkout;
window.navigate = navigate;

async function bootstrap() {
  // Update year
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
}

// ===== AUTH ENHANCEMENTS =====
function initAuthMasking() {
  const input = document.getElementById('authContact');
  const icon = document.getElementById('input-type-icon');
  if (!input) return;

  input.addEventListener('input', (e) => {
    let val = e.target.value;
    
    if (val.includes('@')) {
      icon.innerHTML = '<i class="fas fa-envelope"></i> EMAIL';
      return;
    }

    // Only apply phone mask if it explicitly looks like a phone number
    // Starts with +, 7, or 8, AND contains only digits/separators
    const startsWithPhonePrefix = /^[\+78]/.test(val);
    const hasOnlyPhoneChars = /^[\d\s\+\(\)\-]+$/.test(val);
    
    if (hasOnlyPhoneChars && (startsWithPhonePrefix || val.length > 6)) {
      icon.innerHTML = '<i class="fas fa-phone"></i> PHONE';
      
      let cleaned = val.replace(/\D/g, '');
      if (cleaned.length > 0) {
        if (cleaned.startsWith('8')) cleaned = '7' + cleaned.slice(1);
        // Only force 7 if it's already clearly a phone number (e.g. they started with + or 7 or they have many digits)
        if (cleaned.length > 1 && !cleaned.startsWith('7') && (startsWithPhonePrefix || cleaned.length > 5)) {
          cleaned = '7' + cleaned;
        }
        
        let masked = '+' + cleaned.slice(0, 1) + ' (' + cleaned.slice(1, 4);
        if (cleaned.length > 4) masked += ') ' + cleaned.slice(4, 7);
        if (cleaned.length > 7) masked += '-' + cleaned.slice(7, 9);
        if (cleaned.length > 9) masked += '-' + cleaned.slice(9, 11);
        
        // Only update input value if it matches the phone pattern to avoid interfering with email-like numeric starts
        if (cleaned.length >= 2 && (startsWithPhonePrefix || cleaned.length > 5)) {
          input.value = masked.slice(0, 18);
        }
      }
    } else {
      icon.innerHTML = '';
    }
  });
}

// ===== SPA ROUTER =====
function setupNavigation() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && link.origin === window.location.origin) {
      const path = link.getAttribute('href');
      
      // Don't intercept if it's a file or special link
      if (path.includes('.') && !path.includes('.html')) return;
      
      e.preventDefault();
      navigate(path);
    }
  });

  window.onpopstate = () => {
    loadPage(window.location.pathname + window.location.search, false);
  };
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
    const url = new URL(path, window.location.origin);
    const response = await fetch(url.pathname);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newMain = doc.querySelector('main');
    
    if (newMain) {
       window.scrollTo(0, 0);
       main.innerHTML = newMain.innerHTML;
       updateHeaderActive(url.pathname);
       initPageFunctions(url.pathname, url.searchParams);
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
    if (href === path || (path === '/' && (href === '/' || href === '/index'))) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

function initPageFunctions(path = window.location.pathname, params = new URLSearchParams(window.location.search)) {
  if (path.includes('/admin')) {
    checkAdminAccess();
    initAdmin();
    return;
  }
  
  if (path === '/' || path === '/index') {
    initHomeCategories();
  } else if (path.includes('catalog')) {
    initCatalog(params);
  } else if (path.includes('account')) {
    initAccount();
  } else if (path.includes('admin')) {
    initAdmin();
  } else if (path.includes('contacts')) {
    initYandexMap();
  }
}

// ===== HOME CATEGORIES =====
async function initHomeCategories() {
  const container = document.getElementById('homeCategories');
  if (!container) return;

  try {
    const cats = await API.categories.getAll();
    const icons = {
      'welding': '🔥',
      'rigging': '🔗',
      'metal': '📦',
      'tools': '🛠️',
      'fasteners': '🔩'
    };

    container.innerHTML = cats.map((c, i) => `
      <a href="/catalog?category=${c.id}" class="category-card">
        <div class="category-tag">CATEGORY 0${i + 1}</div>
        <div class="category-icon">${icons[c.slug] || '⚙️'}</div>
        <h3 class="category-title">${c.name}</h3>
        <div class="category-footer">
          <span>${c.product_count || 0} товаров</span>
          <div class="category-arrow"><i class="fas fa-chevron-right"></i></div>
        </div>
      </a>
    `).join('');
  } catch (err) {
    console.error('Home categories error:', err);
  }
}

// ===== ADMIN LOGIC =====
window.switchTab = switchTab;
window.editProduct = editProduct;
window.cancelEdit = cancelEdit;
window.deleteProduct = deleteProduct;
window.changeOrderStatus = changeOrderStatus;

async function checkAdminAccess() {
  try {
    const data = await API.auth.me();
    if (!data || !data.user || !data.user.isAdmin) {
      window.location.href = '/admin-login';
    }
  } catch (err) {
    window.location.href = '/admin-login';
  }
}

function switchTab(tab) {
  const tabs = ['products', 'orders'];
  tabs.forEach(t => {
    document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
    const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) {
      if (t === tab) {
        btn.style.background = 'var(--dark)';
        btn.style.color = 'white';
      } else {
        btn.style.background = 'white';
        btn.style.color = 'var(--dark)';
      }
    }
  });

  if (tab === 'products') loadAdminProducts();
  if (tab === 'orders') loadAdminOrders();
}

async function initAdmin() {
  const form = document.getElementById('productForm');
  if (!form) return;

  try {
    const data = await API.auth.me();
    if (!data || !data.user || !data.user.isAdmin) {
      window.location.href = '/admin-login';
      return;
    }
  } catch (err) {
    window.location.href = '/admin-login';
    return;
  }

  loadAdminCategories();
  loadAdminProducts();

  const filter = document.getElementById('adminCategoryFilter');
  if (filter) {
    filter.onchange = () => loadAdminProducts();
  }

  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) {
    cancelBtn.onclick = cancelEdit;
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('pId').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('pName').value);
    formData.append('article', document.getElementById('pArticle').value);
    formData.append('price', document.getElementById('pPrice').value);
    formData.append('quantity', document.getElementById('pQuantity').value || 0);
    formData.append('category_id', document.getElementById('pCategory').value);
    formData.append('description', document.getElementById('pDescription').value);
    
    const fileInput = document.getElementById('pImageFile');
    if (fileInput.files[0]) {
      formData.append('image', fileInput.files[0]);
    }

    try {
      if (id) {
        await API.products.update(id, formData);
        alert('Товар обновлен');
      } else {
        await API.products.add(formData);
        alert('Товар успешно добавлен');
      }
      cancelEdit();
      loadAdminProducts();
    } catch (err) {
      alert('Ошибка при сохранении: ' + err.message);
    }
  };
}

let adminProducts = [];

async function loadAdminProducts() {
  const grid = document.getElementById('adminProductsGrid');
  if (!grid) return;

  const filterSelect = document.getElementById('adminCategoryFilter');
  const catFilter = filterSelect ? filterSelect.value : 'all';

  adminProducts = await API.products.getAll();
  const filteredProducts = adminProducts.filter(p => catFilter === 'all' || String(p.category_id) === String(catFilter));
  
  const totalEl = document.getElementById('totalProducts');
  if (totalEl) totalEl.innerText = filteredProducts.length;
  
  grid.innerHTML = filteredProducts.map((p) => {
    const imgSrc = p.image && p.image.length > 5 ? (p.image.startsWith('/') ? p.image : p.image) : null;
    const imgHtml = imgSrc ? `<img src="${imgSrc}" alt="${p.name}">` : (p.id ? '📦' : null);

    return `
      <div class="product-card">
        <div class="product-img">${imgHtml}</div>
        <div class="product-info">
           <div style="font-size:9px;font-weight:900;text-transform:uppercase;opacity:0.3;margin-bottom:8px;">${p.category_name || 'Без категории'}</div>
           <h3 style="font-size:14px;font-weight:900;text-transform:uppercase;margin-bottom:16px;">${p.name}</h3>
           <div style="display:flex;justify-content:space-between;align-items:flex-end;">
             <div style="font-size:20px;font-weight:900;color:var(--brand);">${p.price} ₽</div>
             <div style="display:flex; gap: 8px;">
               <button onclick="window.editProduct('${p.id}')" style="background:var(--dark); color:white; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer;">
                 <i class="fas fa-edit" style="font-size:10px;"></i>
               </button>
               <button onclick="window.deleteProduct('${p.id}')" style="background:#EF4444; color:white; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer;">
                 <i class="fas fa-trash" style="font-size:10px;"></i>
               </button>
             </div>
           </div>
        </div>
      </div>
    `;
  }).join('');
}

function editProduct(id) {
  const p = adminProducts.find(prod => String(prod.id) === String(id));
  if (!p) return;

  document.getElementById('pId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pArticle').value = p.article || '';
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pQuantity').value = p.quantity || 0;
  document.getElementById('pCategory').value = p.category_id || '';
  document.getElementById('pDescription').value = p.description || '';

  document.getElementById('formTitle').innerText = 'Редактировать товар';
  document.getElementById('submitBtn').innerText = 'Обновить данные';
  document.getElementById('cancelEditBtn').style.display = 'block';
  window.scrollTo(0, 0);
}

function cancelEdit() {
  document.getElementById('productForm').reset();
  document.getElementById('pId').value = '';
  document.getElementById('formTitle').innerText = 'Добавить новый товар';
  document.getElementById('submitBtn').innerText = 'Сохранить';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

async function loadAdminCategories() {
  const cats = await API.categories.getAll();
  const select = document.getElementById('pCategory');
  if (select) {
    select.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  
  const filterSelect = document.getElementById('adminCategoryFilter');
  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = `<option value="all">Все категории</option>` + 
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    filterSelect.value = currentVal;
  }
}

async function loadAdminOrders() {
    const list = document.getElementById('adminOrdersList');
    if (!list) return;

    try {
        const orders = await API.orders.getAll();
        if (orders.length === 0) {
            list.innerHTML = '<p style="opacity:0.5;">Заказов пока нет</p>';
            return;
        }

        list.innerHTML = '';
        for (const order of orders) {
            const items = await API.orders.getItems(order.id);
            const date = new Date(order.created_at).toLocaleDateString();
            
            const itemsHtml = items.map(it => `
                <tr>
                    <td>${it.product_name}</td>
                    <td>${it.quantity} x ${it.price} ₽</td>
                </tr>
            `).join('');

            list.innerHTML += `
                <div class="order-card">
                    <header>
                        <div>
                            <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:var(--brand);margin-bottom:4px;">Заказ #${order.id}</div>
                            <div style="font-size:14px;font-weight:900;">${order.user_name}</div>
                            <div style="font-size:11px;opacity:0.6;">${order.user_email} | ${date}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:18px;font-weight:900;margin-bottom:8px;">${order.total} ₽</div>
                            <select onchange="window.changeOrderStatus('${order.id}', this.value)" style="padding:6px; font-size:10px; font-weight:700; border:1px solid var(--dark); text-transform:uppercase;">
                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>В обработке</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Отправлен</option>
                                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Завершен</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Отменен</option>
                            </select>
                        </div>
                    </header>
                    <table class="order-items-table">
                        <thead><tr><th>ТОВАР</th><th>КОЛИЧЕСТВО / ЦЕНА</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>
            `;
        }
    } catch (e) {
        console.error(e);
    }
}

async function changeOrderStatus(id, status) {
    try {
        await API.orders.updateStatus(id, status);
        alert('Статус заказа обновлен');
    } catch (e) {
        alert('Ошибка при обновлении статуса');
    }
}

async function deleteProduct(id) {
  if (confirm('Удалить этот товар?')) {
    await API.products.delete(id);
    loadAdminProducts();
  }
}

// ===== ACCOUNT LOGIC =====
async function initAccount() {
  const userNameEl = document.getElementById('userName');
  if (!userNameEl) return;

  const data = await API.auth.me();
  if (!data || !data.user) {
    navigate('/');
    return;
  }

  const user = data.user;
  userNameEl.innerText = user.displayName || 'Пользователь';
  document.getElementById('userEmail').innerText = user.email;

  const adminLink = document.getElementById('adminLink');
  if (user.isAdmin && adminLink) {
    adminLink.style.display = 'block';
  }

  // Load orders
  try {
    const orders = await API.orders.getMine();
    document.getElementById('orderCount').innerText = orders.length;

    const ordersList = document.getElementById('ordersList');
    if (orders && orders.length > 0) {
      ordersList.innerHTML = '';
      orders.forEach((order) => {
        const date = new Date(order.created_at).toLocaleDateString();
        ordersList.innerHTML += `
          <div class="about-list-item">
            <h4>Заказ #${order.id}</h4>
            <p>Дата: ${date} | Сумма: ${order.total} ₽ | Статус: ${order.status}</p>
          </div>
        `;
      });
    }
  } catch (e) {
    console.error('Error loading orders', e);
  }
}

// ===== CATALOG LOGIC (Integrated) =====
let allProducts = [];
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'default';

async function initCatalog(params) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  // Set initial filter from URL if present
  if (params && params.get('category')) {
    currentFilter = params.get('category');
  } else {
    currentFilter = 'all';
  }

  try {
    const [products, cats] = await Promise.all([
      API.products.getAll(),
      API.categories.getAll()
    ]);
    
    allProducts = products;
    
    // Render Categories
    const catGrid = document.getElementById('filters');
    if (catGrid) {
      catGrid.innerHTML = `
        <div class="cat-tag-item ${currentFilter === 'all' ? 'active' : ''}" data-id="all">Все товары</div>
        ${cats.map(c => `
          <div class="cat-tag-item ${currentFilter == c.id ? 'active' : ''}" data-id="${c.id}">${c.name}</div>
        `).join('')}
      `;
      
      catGrid.querySelectorAll('.cat-tag-item').forEach(item => {
        item.onclick = () => {
          catGrid.querySelectorAll('.cat-tag-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          currentFilter = item.dataset.id;
          
          // Update URL without reloading to reflect filter
          const newUrl = currentFilter === 'all' ? '/catalog' : `/catalog?category=${currentFilter}`;
          window.history.replaceState({}, '', newUrl);
          
          renderProducts();
        };
      });
    }

    // Search & Sort Listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderProducts();
      };
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        currentSort = e.target.value;
        renderProducts();
      };
    }

    renderProducts();
  } catch (err) {
    console.error('Catalog init error:', err);
  }
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let filtered = allProducts.filter(p => {
    const matchesCat = currentFilter === 'all' || p.category_id == currentFilter;
    const matchesSearch = p.name.toLowerCase().includes(currentSearch) || 
                          p.article.toLowerCase().includes(currentSearch);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 100px 40px; text-align: center; border: 1px dashed var(--dark);">
        <i class="fas fa-search" style="font-size: 48px; opacity: 0.1; margin-bottom: 24px;"></i>
        <h3 style="font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">Товаров не найдено</h3>
        <p style="opacity: 0.5; font-size: 12px; margin-top: 8px;">Попробуйте изменить параметры поиска или выбрать другую категорию</p>
      </div>
    `;
    return;
  }

  // Sort
  if (currentSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  if (currentSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  if (currentSort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

  grid.innerHTML = filtered.map(p => {
    const imgSrc = p.image && p.image.length > 5 ? (p.image.startsWith('/') ? p.image : p.image) : null;
    const imgHtml = imgSrc ? `<img src="${imgSrc}" alt="${p.name}">` : (p.id ? '📦' : null);
    const inCartQty = cart.filter(id => String(id) === String(p.id)).length;
    const isOutOfStock = (p.quantity || 0) <= 0;

    return `
      <div class="product-card" style="${isOutOfStock ? 'filter: grayscale(1); opacity: 0.7; pointer-events: none;' : ''}">
        <div class="product-img">
          ${imgHtml}
          ${inCartQty > 0 ? `<div style="position:absolute; top:10px; right:10px; background:var(--brand); color:white; font-size:10px; font-weight:900; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid var(--dark);">${inCartQty}</div>` : ''}
          ${isOutOfStock ? `<div style="position:absolute; bottom:10px; left:0; width:100%; background:rgba(0,0,0,0.8); color:white; font-size:10px; font-weight:900; text-transform:uppercase; padding:4px; text-align:center;">Нет в наличии</div>` : ''}
        </div>
        <div class="product-info">
           <div style="font-size:9px;font-weight:900;text-transform:uppercase;opacity:0.3;margin-bottom:8px;">${p.category_name || 'Индустриал'}</div>
           <h3 style="font-size:14px;font-weight:900;text-transform:uppercase;margin-bottom:16px;line-height:1.2;min-height:34px;">${p.name}</h3>
           <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;">
             <div style="font-size:20px;font-weight:900;color:var(--brand);">${p.price} ₽</div>
             <button onclick="window.addToCart('${p.id}')" class="icon-btn" style="background:var(--dark); color:white; border:none; width:40px; height:40px; position:relative;" ${isOutOfStock ? 'disabled' : ''}>
               <i class="fas fa-shopping-cart"></i>
             </button>
           </div>
        </div>
      </div>
    `;
  }).join('');
}

// AUTH & MODALS
function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('open');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('open');
}

function goToStep2() {
  document.getElementById('authStep1').style.display = 'none';
  document.getElementById('authStep2').style.display = 'block';
}

let authCurrentContact = '';
let authStep = 1;

async function handleAuth() {
  const contactInput = document.getElementById('authContact');
  const codeStep = document.getElementById('authCodeStep');
  const nameStep = document.getElementById('authNameStep');
  const codeInput = document.getElementById('authCode');
  const nameInput = document.getElementById('authName');
  const actionBtn = document.getElementById('authActionBtn');
  const codePreview = document.getElementById('codePreview');

  let contact = contactInput.value;
  if (!contact.includes('@')) {
    contact = contact.replace(/\D/g, '');
  }

  if (!contact) {
    alert('Введите данные для входа');
    return;
  }

  if (authStep === 1) {
    // Step 1: Request code
    try {
      const res = await API.auth.requestCode(contact);
      authCurrentContact = contact;
      authStep = 2;
      
      document.getElementById('authContactStep').style.display = 'none';
      codeStep.style.display = 'block';
      actionBtn.innerText = 'Подтвердить код';
      
      if (res.previewCode) {
        codePreview.innerText = `Тестовый код: ${res.previewCode}`;
      }
    } catch (err) {
      alert('Ошибка при отправке кода: ' + (err.error || err.message));
    }
  } else if (authStep === 2) {
    // Step 2: Verify code
    const code = codeInput.value;
    if (code.length !== 6) {
      alert('Введите 6-значный код');
      return;
    }

    try {
      const data = await API.auth.verifyCode(authCurrentContact, code);
      if (data.status === 'needs_registration') {
        // Switch to name step
        authStep = 3;
        codeStep.style.display = 'none';
        nameStep.style.display = 'block';
        actionBtn.innerText = 'Завершить регистрацию';
      } else if (data.user) {
        completeLogin(data.user);
      }
    } catch (err) {
      alert('Ошибка: ' + (err.error || err.message));
    }
  } else if (authStep === 3) {
    // Step 3: Registration with name
    const name = nameInput.value;
    const code = codeInput.value; // Still need code or just the fact that it was verified
    if (!name) {
      alert('Пожалуйста, введите ваше имя');
      return;
    }

    try {
      const data = await API.auth.verifyCode(authCurrentContact, code, name);
      if (data.user) {
        completeLogin(data.user);
      }
    } catch (err) {
      alert('Ошибка регистрации: ' + (err.error || err.message));
    }
  }
}

function completeLogin(user) {
  localStorage.setItem('user', JSON.stringify(user));
  currentUser = user;
  updateUIForLoggedInUser(currentUser);
  closeAuthModal();
  
  // Reset auth state
  authStep = 1;
  authCurrentContact = '';
  const cInput = document.getElementById('authContact');
  if (cInput) {
    cInput.disabled = false;
    cInput.value = '';
  }
  const cStep = document.getElementById('authContactStep');
  if (cStep) cStep.style.display = 'block';
  
  document.getElementById('authCode').value = '';
  document.getElementById('authName').value = '';
  document.getElementById('authCodeStep').style.display = 'none';
  document.getElementById('authNameStep').style.display = 'none';
  document.getElementById('authActionBtn').innerText = 'Получить код';
  document.getElementById('codePreview').innerText = '';
  
  window.location.reload();
}

async function handleLogout() {
  await API.auth.logout();
  window.location.href = '/';
}

function updateUIForLoggedInUser(user) {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (loginBtn && user) {
    loginBtn.innerHTML = `<div style="width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; background:var(--brand); color:white;">${user.displayName ? user.displayName[0] : 'U'}</div>`;
    loginBtn.onclick = () => navigate('/account');
  }

  if (logoutBtn && user) {
    logoutBtn.style.display = 'flex';
  }

  const authBtnArr = document.querySelectorAll('.icon-btn');
  authBtnArr.forEach(btn => {
      if (btn.innerHTML.includes('fa-user') || btn.innerHTML.includes('fa-sign-in')) {
          btn.innerHTML = `<div style="width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; background:var(--brand); color:white;">${user.displayName ? user.displayName[0] : 'U'}</div>`;
          btn.onclick = () => navigate('/account');
      }
  });
}

// Cart Logic
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) badge.innerText = cart.length;
}

async function addToCart(productId) {
  // If we don't have allProducts (e.g. on home page), fetch them
  if (allProducts.length === 0) {
    try {
      allProducts = await API.products.getAll();
    } catch (e) {
      console.error('Failed to fetch products for inventory check', e);
    }
  }

  const p = allProducts.find(item => String(item.id) === String(productId));
  const inCartQty = cart.filter(id => String(id) === String(productId)).length;

  if (p && inCartQty >= p.quantity) {
    alert(`Извините, доступно только ${p.quantity} шт.`);
    return;
  }

  cart.push(productId);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  
  // Visual feedback
  const btn = event.currentTarget;
  if (btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => btn.innerHTML = originalHtml, 2000);
  }

  // Refresh current view if needed
  if (window.location.pathname.includes('catalog')) {
    renderProducts();
  }
}

async function updateCartQuantity(productId, delta) {
  if (delta > 0) {
    // Check inventory
    if (allProducts.length === 0) {
      allProducts = await API.products.getAll();
    }
    const p = allProducts.find(item => String(item.id) === String(productId));
    const inCartQty = cart.filter(id => String(id) === String(productId)).length;

    if (p && inCartQty >= p.quantity) {
      alert(`Извините, доступно только ${p.quantity} шт.`);
      return;
    }
    cart.push(productId);
  } else {
    const idx = cart.findIndex(id => String(id) === String(productId));
    if (idx !== -1) {
      cart.splice(idx, 1);
    }
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
  
  if (window.location.pathname.includes('catalog')) {
    renderProducts();
  }
}

async function openCart() {
  const modal = document.getElementById('cartModal');
  if (modal) modal.classList.add('open');
  renderCart();
}

function closeCart() {
  const modal = document.getElementById('cartModal');
  if (modal) modal.classList.remove('open');
}

async function renderCart() {
  const container = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');
  
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 40px 0;">Корзина пуста</p>';
    footer.style.display = 'none';
    return;
  }

  try {
    const products = await API.products.getAll();
    const cartProducts = cart.map(id => products.find(p => String(p.id) === String(id))).filter(Boolean);
    
    const grouped = cartProducts.reduce((acc, p) => {
      if (!acc[p.id]) acc[p.id] = { ...p, count: 0 };
      acc[p.id].count++;
      return acc;
    }, {});

    let total = 0;
    container.innerHTML = Object.values(grouped).map(item => {
      total += item.price * item.count;
      const imgSrc = item.image && item.image.length > 5 ? item.image : null;
      return `
        <div style="display:flex; gap: 20px; align-items:center; padding: 15px 0; border-bottom: 1px solid #eee;">
          <div style="width:60px; height:60px; background:#f5f5f5; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${imgSrc ? `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;">` : '📦'}
          </div>
          <div style="flex:1;">
            <div style="font-size:12px; font-weight:900; text-transform:uppercase;">${item.name}</div>
            <div style="display:flex; align-items:center; gap: 10px; margin-top: 5px;">
              <div style="font-size:14px; font-weight:900; color:var(--brand);">${item.price} ₽</div>
              <div style="display:flex; align-items:center; border: 1px solid var(--dark); padding: 2px;">
                <button onclick="window.updateCartQuantity('${item.id}', -1)" style="background:none; border:none; width:20px; cursor:pointer; font-weight:900;">-</button>
                <span style="font-size:12px; font-weight:900; min-width:20px; text-align:center;">${item.count}</span>
                <button onclick="window.updateCartQuantity('${item.id}', 1)" style="background:none; border:none; width:20px; cursor:pointer; font-weight:900;">+</button>
              </div>
            </div>
          </div>
          <button onclick="removeFromCart('${item.id}')" style="background:none; border:none; color:#EF4444; cursor:pointer; font-size:16px;">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
    }).join('');

    totalEl.innerText = total + ' ₽';
    footer.style.display = 'block';
  } catch (err) {
    console.error('Cart render error:', err);
  }
}

function removeFromCart(productId) {
  cart = cart.filter(id => String(id) !== String(productId));
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}

async function checkout() {
  try {
    const data = await API.auth.me();
    if (!data || !data.user) {
      alert('Пожалуйста, войдите в аккаунт для оформления заказа');
      closeCart();
      openAuthModal();
      return;
    }

    if (cart.length === 0) return;

    const products = await API.products.getAll();
    const cartProducts = cart.map(id => products.find(p => String(p.id) === String(id))).filter(Boolean);
    
    const grouped = cartProducts.reduce((acc, p) => {
      if (!acc[p.id]) acc[p.id] = { ...p, quantity: 0 };
      acc[p.id].quantity++;
      return acc;
    }, {});

    const total = Object.values(grouped).reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderData = {
      total: total,
      items: Object.values(grouped).map(it => ({ id: it.id, quantity: it.quantity, price: it.price }))
    };

    await API.orders.create(orderData);
    
    alert('Заказ успешно оформлен!');
    cart = [];
    localStorage.setItem('cart', '[]');
    updateCartBadge();
    closeCart();
    navigate('/account');
  } catch (err) {
    alert('Ошибка при оформлении заказа: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
