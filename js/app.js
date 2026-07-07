import API from "./api.js";
import { initYandexMap, initPickupMap } from "./map.js";
window.initYandexMap = initYandexMap;
window.initPickupMap = initPickupMap;
let currentUser = null;
let allProducts = [];
let allCategories = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let currentFilter = "all";
let currentSearch = "";
let currentSort = "default";
let authCurrentContact = "";
let authStep = 1;

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function bootstrap() {
  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.innerText = new Date().getFullYear();

  setupNavigation();
  initPageFunctions();

  enforceRKN();
  initScrollFeatures();
}

// ===== SPA НАВИГАЦИЯ =====
function setupNavigation() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link && link.href && link.origin === window.location.origin) {
      const path = link.getAttribute("href");
      if (
        path &&
        !path.includes(".") &&
        !path.startsWith("mailto:") &&
        !path.startsWith("tel:") &&
        !path.startsWith("#") &&
        !path.startsWith("/admin")
      ) {
        e.preventDefault();

        document.querySelectorAll(".modal-overlay").forEach((modal) => {
          modal.classList.remove("open");
        });

        navigate(path);
      }
    }
  });
  window.onpopstate = () =>
    loadPage(window.location.pathname + window.location.search, false);
}

async function navigate(path) {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState({}, "", path);
  await loadPage(path);
}

async function loadPage(path, triggerPushState = true) {
  const main = document.getElementById("main-content");
  if (!main) return;
  main.classList.add("loading");
  try {
    const response = await fetch(path);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const newTitle = doc.querySelector("title");
    if (newTitle) document.title = newTitle.innerText;

    const newMain = doc.querySelector("main");
    if (newMain) {
      window.scrollTo(0, 0);
      main.innerHTML = newMain.innerHTML;
      const progressBar = document.getElementById("scroll-progress");
      if (progressBar) progressBar.style.width = "0%";
      updateHeaderActive(new URL(path, window.location.origin).pathname);
      initPageFunctions(
        new URL(path, window.location.origin).pathname,
        new URL(path, window.location.origin).searchParams,
      );
    }
    if (currentUser) updateUIForLoggedInUser(currentUser);
    updateCartBadge();
    enforceRKN();
  } catch (err) {
    console.error("Navigation error:", err);
  } finally {
    main.classList.remove("loading");
  }
}

function updateHeaderActive(path) {
  document.querySelectorAll(".shop-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle(
      "active",
      href === path || (path === "/" && (href === "/" || href === "/index")),
    );
  });
}

function initPageFunctions(
  path = window.location.pathname,
  params = new URLSearchParams(window.location.search),
) {
  if (path === "/" || path === "/index") {
    initPromoProducts();
    initNewProducts();
  } else if (path.includes("catalog")) initCatalog(params);
  else if (path.includes("contacts")) {
    setTimeout(() => {
      if (typeof window.initYandexMap === "function") {
        window.initYandexMap();
      }
    }, 50);
  }
}

// ===== НОВИНКИ НА ГЛАВНОЙ =====
async function initNewProducts() {
  const container = document.getElementById("newProductsContainer");
  if (!container) return;

  try {
    const products = await API.products.getAll();
    const news = products.filter((p) => p.badge === "new" && (p.quantity || 0) > 0);

    if (news.length === 0) {
      container.innerHTML = '<p style="font-size:11px; opacity:0.5; text-transform:uppercase; font-weight:900; text-align:center; padding:40px;">Новинки скоро появятся</p>';
      return;
    }

    container.innerHTML = news
      .map((p) => {
        const hasImg = p.image && p.image.length > 5;
        const imgHtml = hasImg
          ? `<img src="${p.image}" alt="${p.name}">`
          : "📦";
        const imgAction = hasImg
          ? `onclick="window.openImageModal('${p.image}')"`
          : "";

        return `<div class="product-card" style="display: flex; flex-direction: column; height: 100%;">
    <div class="product-img ${hasImg ? "has-img" : ""}" ${imgAction}>
        ${imgHtml}
        <div class="product-badge new">✨ Новинка</div>
    </div>
    <div class="product-info" style="display:flex; flex-direction:column; justify-content:space-between; padding:16px; flex-grow:1;">
        <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; line-height:1.4; margin:0 0 8px; white-space: normal; word-wrap: break-word;">
            ${p.name}
        </h3>
        <div style="font-size:9px; font-weight:900; text-transform:uppercase; opacity:0.4; margin-top:auto;">
            ${p.category_name || "Новинки"}
        </div>
    </div>
</div>`;
      })
      .join("");
  } catch (err) {
    console.error("New products error:", err);
    container.innerHTML = '<p style="font-size:11px; opacity:0.5; text-align:center; padding:40px;">Не удалось загрузить новинки</p>';
  }
}

// ===== КАТЕГОРИИ И ТОВАРЫ КАТАЛОГА =====
// Список категорий переработан: симулирует выпадающее бруталистское меню на div с поддержкой адаптивного переноса длинных слов
async function initCatalog(params) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  currentFilter =
    params && params.get("category") ? params.get("category") : "all";

  const skeletonHtml = Array(8)
    .fill()
    .map(
      () => `
    <div class="skeleton-card">
      <div class="skeleton-box" style="aspect-ratio:1/1; width:100%; margin-bottom:16px;"></div>
      <div class="skeleton-box" style="width:50%; height:10px; margin-bottom:12px;"></div>
      <div class="skeleton-box" style="width:100%; height:14px; margin-bottom:4px;"></div>
      <div class="skeleton-box" style="width:80%; height:14px; margin-bottom:16px;"></div>
      <div style="display:flex; justify-content:space-between; margin-top:auto;">
        <div class="skeleton-box" style="width:60px; height:20px;"></div>
        <div class="skeleton-box" style="width:32px; height:32px; border-radius:4px;"></div>
      </div>
    </div>
  `,
    )
    .join("");
  grid.innerHTML = skeletonHtml;

  try {
    const [products, cats] = await Promise.all([
      API.products.getAll(),
      API.categories.getAll(),
    ]);
    allProducts = products;
    allCategories = cats;
    
    const catGrid = document.getElementById("filters");
    if (catGrid) {
      catGrid.className = ""; 
      
      const activeCat = cats.find(c => c.slug === currentFilter);
      const activeName = activeCat ? activeCat.name : "Все товары";

      // Кастомный раскрывающийся список (mock-dropdown), позволяющий тексту переноситься на несколько строк
      catGrid.innerHTML = `
        <div class="custom-select-wrap" style="position: relative; width: 100%; margin-bottom: 24px;">
          <div id="categorySelectBtn" 
            style="width: 100%; padding: 14px 44px 14px 16px; border: 2px solid var(--dark); font-family: inherit; font-weight: 900; text-transform: uppercase; font-size: 11px; outline: none; background: #ffffff url('data:image/svg+xml;utf8,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;24&quot; height=&quot;24&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;%23111827&quot; stroke-width=&quot;3&quot; stroke-linecap=&quot;square&quot;><polyline points=&quot;6 9 12 15 18 9&quot;/></svg>') no-repeat right 12px center; background-size: 14px; border-radius: 0; cursor: pointer; box-shadow: 6px 6px 0 var(--dark); transition: all 0.2s; white-space: normal; line-height: 1.4; word-wrap: break-word;">
            ${activeName}
          </div>
          <div id="categorySelectDropdown" 
            style="display: none; position: absolute; top: calc(100% + 6px); left: 0; width: 100%; max-height: 250px; overflow-y: auto; background: white; border: 2px solid var(--dark); box-shadow: 6px 6px 0 var(--dark); z-index: 1100; margin: 0; padding: 0;">
            <div class="custom-select-option" data-slug="all" 
              style="padding: 12px 16px; font-weight: 900; font-size: 11px; text-transform: uppercase; cursor: pointer; border-bottom: 1px solid var(--gray-bg); white-space: normal; line-height: 1.4; word-wrap: break-word; transition: 0.15s; background: ${currentFilter === 'all' ? 'var(--gray-bg)' : 'white'}"
              onmouseover="this.style.background='var(--gray-bg)'"
              onmouseout="if(currentFilter !== 'all') { this.style.background='white'; }">
              Все товары
            </div>
            ${cats.map(c => `
              <div class="custom-select-option" data-slug="${c.slug}" 
                style="padding: 12px 16px; font-weight: 900; font-size: 11px; text-transform: uppercase; cursor: pointer; border-bottom: 1px solid var(--gray-bg); white-space: normal; line-height: 1.4; word-wrap: break-word; transition: 0.15s; background: ${currentFilter === c.slug ? 'var(--gray-bg)' : 'white'}"
                onmouseover="this.style.background='var(--gray-bg)'"
                onmouseout="if(currentFilter !== '${c.slug}') { this.style.background='white'; }">
                ${c.name}
              </div>
            `).join('')}
          </div>
        </div>
      `;

      const btn = document.getElementById("categorySelectBtn");
      const dropdown = document.getElementById("categorySelectDropdown");

      if (btn && dropdown) {
        btn.onclick = (e) => {
          e.stopPropagation();
          const isOpen = dropdown.style.display === "block";
          dropdown.style.display = isOpen ? "none" : "block";
        };

        document.addEventListener("click", () => {
          dropdown.style.display = "none";
        });

        const options = dropdown.querySelectorAll(".custom-select-option");
        options.forEach(opt => {
          opt.onclick = (e) => {
            currentFilter = opt.dataset.slug;
            window.history.replaceState(
              {},
              "",
              currentFilter === "all"
                ? "/catalog"
                : `/catalog?category=${currentFilter}`,
            );

            const sidebar = document.getElementById("catalogSidebar");
            const overlay = document.getElementById("sidebarOverlay");
            if (sidebar && sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
                overlay.classList.remove("open");
                document.body.style.overflow = "";
            }

            renderProducts();
            initCatalog(params);
          };
        });
      }
    }

    setTimeout(() => {
      renderProducts();
    }, 300);

    const searchInput = document.getElementById("searchInput");
    if (searchInput)
      searchInput.oninput = (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderProducts();
      };
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1; color:red; font-weight:900;">Ошибка сервера при загрузке.</div>`;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("catalogSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar && overlay) {
    const isOpen = sidebar.classList.contains("open");
    if (isOpen) {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    } else {
      sidebar.classList.add("open");
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  }
}

// Отрисовка товаров каталога
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  let filtered = allProducts.filter((p) => {
    if ((p.quantity || 0) <= 0) return false;
    const normalName = normalizeForSearch(p.name);
    const normalQuery = normalizeForSearch(currentSearch);
    const matchesSearch = normalName.includes(normalQuery);
    if (!matchesSearch) return false;

    if (currentFilter === "all") return true;

    const targetCategory = allCategories.find((c) => c.slug === currentFilter);
    return targetCategory ? p.category_id == targetCategory.id : false;
  });

  if (currentSort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:100px 40px;text-align:center;"><h3>Товаров не найдено</h3></div>';
    return;
  }

  grid.innerHTML = filtered
  .map((p) => {
    const hasImg = p.image && p.image.length > 5;
    const imgHtml = hasImg ? `<img src="${p.image}" alt="${p.name}">` : "📦";
    const imgAction = hasImg
      ? `onclick="window.openImageModal('${p.image}')"`
      : "";

    return `<div class="product-card" style="display: flex; flex-direction: column; height: 100%;">
  <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
      ${imgHtml}
      ${p.badge === 'hit' || p.badge === 'new' ? 
         `<div class="product-badge ${p.badge === 'new' ? 'new' : ''}">${p.badge === 'hit' ? '🔥 Хит' : '✨ Новинка'}</div>` 
      : ''}
  </div>
  <div class="product-info" style="display:flex; flex-direction:column; justify-content:space-between; padding:16px; flex-grow:1;">
      <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; line-height:1.4; margin:0 0 8px; white-space: normal; word-wrap: break-word;">
          ${p.name}
      </h3>
      <div style="font-size:9px; font-weight:900; text-transform:uppercase; opacity:0.4; margin-top:auto;">
          ${p.category_name || 'Каталог'}
      </div>
  </div>
</div>`;
  })
  .join("");
}

// ===== РЕКОМЕНДАЦИИ =====
async function initPromoProducts() {
  const container = document.getElementById("promoProductsContainer");
  if (!container) return;

  try {
    const products = await API.products.getAll();
    const hits = products.filter((p) => p.badge === "hit" && (p.quantity || 0) > 0);

    if (hits.length === 0) {
      container.innerHTML = '<p style="font-size:11px; opacity:0.5; text-transform:uppercase; font-weight:900; text-align:center; padding:40px;">Рекомендации скоро появятся</p>';
      return;
    }

    container.innerHTML = hits
      .map((p) => {
        const hasImg = p.image && p.image.length > 5;
        const imgHtml = hasImg
          ? `<img src="${p.image}" alt="${p.name}">`
          : "📦";
        const imgAction = hasImg
          ? `onclick="window.openImageModal('${p.image}')"`
          : "";

        return `<div class="product-card" style="display: flex; flex-direction: column; height: 100%;">
    <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
        ${imgHtml}
        <div class="product-badge">Хит</div>
    </div>
    <div class="product-info" style="display:flex; flex-direction:column; justify-content:space-between; padding:16px; flex-grow:1;">
        <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; line-height:1.4; margin:0 0 8px; white-space: normal; word-wrap: break-word;">
            ${p.name}
        </h3>
        <div style="font-size:9px; font-weight:900; text-transform:uppercase; opacity:0.4; margin-top:auto;">
            ${p.category_name || 'Рекомендации'}
        </div>
    </div>
</div>`;
      })
      .join("");
  } catch (err) {
    console.error("Promo products error:", err);
    container.innerHTML = '<p style="font-size:11px; opacity:0.5; text-align:center; padding:40px;">Не удалось загрузить рекомендации</p>';
  }
}

// ===== КОРЗИНА И СКИДКИ =====
function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;

  const uniqueIds = new Set();
  cart.forEach((item) => {
    try {
      const parsed = JSON.parse(item);
      uniqueIds.add(String(parsed.id));
    } catch (e) {
      uniqueIds.add(String(item));
    }
  });

  badge.innerText = uniqueIds.size;
}

function normalizeForSearch(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/m/g, 'м')  
    .replace(/c/g, 'с')  
    .replace(/x/g, 'х')  
    .replace(/a/g, 'а')  
    .replace(/e/g, 'е')  
    .replace(/o/g, 'о')  
    .replace(/p/g, 'р')  
    .replace(/h/g, 'н')  
    .replace(/b/g, 'в')  
    .replace(/t/g, 'т')  
    .replace(/k/g, 'к'); 
}

// ===== TOASTS =====
if (!document.getElementById("toast-container")) {
  const tc = document.createElement("div");
  tc.id = "toast-container";
  document.body.appendChild(tc);
}

window.showToast = function (message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `custom-toast toast-${type}`;

  const iconHtml =
    type === "success"
      ? '<i class="fas fa-check"></i>'
      : '<i class="fas fa-exclamation-triangle"></i>';

  toast.innerHTML = `<div class="toast-icon">${iconHtml}</div> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
};

// ===== ПРОГРЕСС ЧТЕНИЯ И КНОПКА ВВЕРХ =====
function initScrollFeatures() {
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div id="scroll-progress"></div>',
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<button id="scroll-to-top" onclick="window.scrollTo({top:0, behavior:'smooth'})"><i class="fas fa-arrow-up"></i></button>`,
  );

  window.addEventListener("scroll", () => {
    const winScroll =
      document.body.scrollTop || document.documentElement.scrollTop;
    const height =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    document.getElementById("scroll-progress").style.width = scrolled + "%";

    const btn = document.getElementById("scroll-to-top");
    if (winScroll > 300) btn.classList.add("show");
    else btn.classList.remove("show");
  });
}

function enforceRKN() {
  document.querySelectorAll(".footer-links a").forEach((a) => {
    if (a.textContent.includes("Админ")) {
      a.remove();
    }
    if (a.textContent.includes("Политика")) {
      a.href = "/policy";
      a.textContent = "Политика конфиденциальности";
    }
    if (a.textContent.includes("Условия")) {
      a.href = "/terms";
      a.textContent = "Пользовательское соглашение";
    }
  });

  const cookieForever = localStorage.getItem("rkn_cookie_consent_v3");
  const cookieSession = sessionStorage.getItem("rkn_cookie_consent_v3");

  if (
    !cookieForever &&
    !cookieSession &&
    !document.getElementById("cookie-banner")
  ) {
    const banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.innerHTML = `
      <div style="flex: 1; display:flex; flex-direction:column; gap:8px;">
        <div style="line-height:1.4;">Мы используем файлы cookie. Продолжая работу, вы соглашаетесь с <a href="/policy" style="color:var(--brand); text-decoration:underline;">Политикой</a>.</div>
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="hide-cookie-forever" style="cursor:pointer; width:14px; height:14px; margin:0;">
            <label for="hide-cookie-forever" style="font-size:10px; opacity:0.8; cursor:pointer;">Больше не показывать уведомление</label>
        </div>
      </div>
      <button class="hero-btn" onclick="acceptCookies()" style="padding: 12px 24px; font-size: 10px; flex-shrink:0; background:var(--brand); border-color:var(--brand);"><i class="fas fa-check" style="margin-right:6px;"></i>Согласен</button>
    `;
    document.body.appendChild(banner);
  }
}

window.acceptCookies = function () {
  const neverShow = document.getElementById("hide-cookie-forever");

  if (neverShow && neverShow.checked) {
    localStorage.setItem("rkn_cookie_consent_v3", "true");
  } else {
    sessionStorage.setItem("rkn_cookie_consent_v3", "true");
  }

  const banner = document.getElementById("cookie-banner");
  if (banner) banner.remove();
};

if (!document.getElementById("imgZoomModal")) {
  const modalHtml = `
  <div id="imgZoomModal" class="img-zoom-modal" onclick="closeImageModal()">
      <div class="img-zoom-content" onclick="event.stopPropagation()">
          <button class="img-zoom-close" onclick="closeImageModal()">&times;</button>
          <img id="imgZoomTarget" src="" alt="Увеличенное фото">
      </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

window.openImageModal = function (src) {
  document.getElementById("imgZoomTarget").src = src;
  document.getElementById("imgZoomModal").classList.add("open");
};

window.closeImageModal = function () {
  document.getElementById("imgZoomModal").classList.remove("open");
};

// ===== ГЛОБАЛЬНЫЕ ПРИВЯЗКИ =====
window.navigate = navigate;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.toggleSidebar = toggleSidebar;
document.addEventListener("DOMContentLoaded", bootstrap);