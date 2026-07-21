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
    initHeroSlider();
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
        <div class="product-badge new">Новинка</div>
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
async function initCatalog(params) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const urlParams = new URLSearchParams(window.location.search);
  currentFilter = urlParams.get("category") || "all";

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
    
    const dropdown = document.getElementById("categoryDropdown");
    const btnText = document.getElementById("selectedCategoryName");
    const hoverSelect = document.getElementById("categoryHoverSelect");
    
    if (dropdown && btnText) {
      const activeCat = cats.find(c => c.slug === currentFilter);
      btnText.textContent = activeCat ? activeCat.name : "Все товары";
      
      dropdown.innerHTML = `
        <div class="hover-select-option ${currentFilter === 'all' ? 'active' : ''}" data-slug="all">
          Все товары
        </div>
        ${cats.map(c => `
          <div class="hover-select-option ${c.slug === currentFilter ? 'active' : ''}" data-slug="${c.slug}">
            ${c.name}
          </div>
        `).join('')}
      `;
      
      const options = dropdown.querySelectorAll(".hover-select-option");
      
      options.forEach(opt => {
        opt.onclick = (e) => {
          e.stopPropagation();
          const selectedSlug = opt.dataset.slug;
          currentFilter = selectedSlug;
          
          const selectedText = opt.textContent.trim();
          btnText.textContent = selectedText;
          
          options.forEach(o => {
            o.classList.toggle("active", o.dataset.slug === selectedSlug);
          });
          
          window.history.replaceState(
            {},
            "",
            selectedSlug === "all"
              ? "/catalog"
              : `/catalog?category=${selectedSlug}`,
          );
          
          if (hoverSelect) {
            hoverSelect.classList.remove('hover-active');
            hoverSelect.classList.add('closed');
          }
          if (dropdown) {
            dropdown.classList.remove('open');
          }
          
          setTimeout(() => {
            if (hoverSelect) {
              hoverSelect.classList.remove('closed');
            }
          }, 200);
          
          renderProducts();
        };
      });
    }

    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.value = currentSort;
      sortSelect.onchange = (e) => {
        currentSort = e.target.value;
        renderProducts();
      };
    }

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.value = currentSearch;
      searchInput.oninput = (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderProducts();
      };
    }

    setTimeout(() => {
      renderProducts();
    }, 300);

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
         `<div class="product-badge ${p.badge === 'new' ? 'new' : ''}">${p.badge === 'hit' ? 'Хит' : 'Новинка'}</div>` 
      : ''}
  </div>
  <div class="product-info" style="display:flex; flex-direction:column; justify-content:space-between; padding:16px; flex-grow:1;">
      <h3 style="font-size:12px; font-weight:600; text-transform:uppercase; line-height:1.4; margin:0 0 8px; white-space: normal; word-wrap: break-word;">
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

// ===== БУРГЕР-МЕНЮ =====
function initBurgerMenu() {
  const burgerBtn = document.getElementById('burgerBtn');
  const navMenu = document.getElementById('shopNav');
  const body = document.body;

  if (!burgerBtn || !navMenu) return;

  burgerBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    this.classList.toggle('active');
    navMenu.classList.toggle('open');
    body.classList.toggle('menu-open');
  });

  const navLinks = navMenu.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      burgerBtn.classList.remove('active');
      navMenu.classList.remove('open');
      body.classList.remove('menu-open');
    });
  });

  document.addEventListener('click', function(e) {
    if (navMenu.classList.contains('open')) {
      const isClickInside = navMenu.contains(e.target) || burgerBtn.contains(e.target);
      if (!isClickInside) {
        burgerBtn.classList.remove('active');
        navMenu.classList.remove('open');
        body.classList.remove('menu-open');
      }
    }
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth > 992 && navMenu.classList.contains('open')) {
      burgerBtn.classList.remove('active');
      navMenu.classList.remove('open');
      body.classList.remove('menu-open');
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && navMenu.classList.contains('open')) {
      burgerBtn.classList.remove('active');
      navMenu.classList.remove('open');
      body.classList.remove('menu-open');
    }
  });
}

// ===== МОБИЛЬНЫЙ ДРОПДАУН КАТЕГОРИЙ =====
function initMobileDropdown() {
  const hoverSelect = document.getElementById('categoryHoverSelect');
  const dropdown = document.getElementById('categoryDropdown');
  const btn = document.getElementById('categorySelectBtn');
  
  if (!hoverSelect || !dropdown || !btn) return;
  
  let overlay = document.querySelector('.dropdown-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'dropdown-overlay';
    document.body.appendChild(overlay);
  }
  
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = hoverSelect.classList.contains('open');
    
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });
  
  function openDropdown() {
    hoverSelect.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  function closeDropdown() {
    hoverSelect.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  overlay.addEventListener('click', closeDropdown);
  
  const options = dropdown.querySelectorAll('.hover-select-option');
  options.forEach(opt => {
    opt.addEventListener('click', function() {
      setTimeout(closeDropdown, 100);
    });
  });
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && hoverSelect.classList.contains('open')) {
      closeDropdown();
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initBurgerMenu();
  initMobileDropdown();
});

// ===== HERO СЛАЙДЕР =====
async function initHeroSlider() {
  const slider = document.getElementById('heroSlider');
  const dotsContainer = document.getElementById('heroSliderDots');
  
  if (!slider || !dotsContainer) {
    console.warn('Элементы слайдера не найдены');
    return;
  }

  try {
    const response = await fetch('/banner/list.json');
    
    if (!response.ok) {
      throw new Error(`Ошибка загрузки: ${response.status}`);
    }
    
    const banners = await response.json();
    console.log(`📸 Найдено баннеров: ${banners.length}`, banners);
    
    const textSlide = {
      tag: 'Надежный партнер с 2006 года',
      title: 'Крепёж<br/>Сила<br/><span class="text-outline">Сталь</span>',
      desc: 'Знаем толк в крепеже и сварке',
      btn1: { text: 'Смотреть каталог', link: '/catalog' },
      btn2: { text: 'О компании', link: '/about' }
    };

    const promoData = [
      { badge: 'Новинка', title: 'Высокопрочный крепёж класса 10.9', desc: 'Новое поступление болтов и гаек повышенной прочности.', price: '350', unit: 'кг', link: '/catalog?category=fasteners' },
      { badge: 'Поступление', title: 'Электроды УОНИ-13/55 (ЧЗСИ)', desc: 'Профессиональные сварочные электроды для ответственных швов.', price: '280', unit: 'уп', link: '/catalog?category=welding' },
      { badge: 'Хит', title: 'Сварочное оборудование ДОНМЕТ', desc: 'Надежная техника для сварки и резки металла.', price: '1200', unit: 'шт', link: '/catalog?category=equipment' },
      { badge: 'Акция', title: 'Электроинструмент Makita и Bosch', desc: 'Профессиональный инструмент для строительных задач.', price: '500', unit: 'шт', link: '/catalog?category=tools' },
      { badge: 'Новинка', title: 'Промышленный прокат металла', desc: 'Листы, уголки, арматура и профтрубы в наличии.', price: '200', unit: 'кг', link: '/catalog?category=metal' }
    ];

    let allSlides = [];

    allSlides.push({ type: 'text', data: textSlide });

    banners.forEach((filename, index) => {
      const data = promoData[index % promoData.length];
      allSlides.push({ type: 'image', filename: filename, data: data });
    });

    const slidesHtml = allSlides.map((slide, index) => {
      const activeClass = index === 0 ? 'active' : '';
      
      if (slide.type === 'text') {
        const d = slide.data;
        return `
          <div class="hero-slide hero-slide-text ${activeClass}">
            <div class="hero-slide-text-content">
              <div class="hero-slide-text-tag">${d.tag}</div>
              <h1 class="hero-slide-text-title">${d.title}</h1>
              <p class="hero-slide-text-desc">${d.desc}</p>
              <div class="hero-slide-text-buttons">
                <a href="${d.btn1.link}" class="hero-slide-text-btn primary">${d.btn1.text}</a>
                <a href="${d.btn2.link}" class="hero-slide-text-btn secondary">${d.btn2.text}</a>
              </div>
            </div>
            <div class="hero-slide-overlay"></div>
          </div>
        `;
      } else {
        const d = slide.data;
        return `
          <div class="hero-slide ${activeClass}">
            <img src="/banner/${slide.filename}" alt="${d.title}" loading="${index === 0 ? 'eager' : 'lazy'}">
            <div class="hero-slide-overlay"></div>
            <!--<div class="promo-banner-card">
              <span class="promo-banner-badge">${d.badge}</span>
              <h3 class="promo-banner-title">${d.title}</h3>
              <p class="promo-banner-desc">${d.desc}</p>
              <div class="promo-banner-action-row">
                <div class="promo-banner-price">от <span class="price-num">${d.price}</span> ₽/${d.unit}</div>
                <a href="${d.link}" class="promo-banner-btn">Подробнее <i class="fas fa-arrow-right"></i></a>
              </div>
            </div>-->
          </div>
        `;
      }
    }).join('');

    slider.innerHTML = slidesHtml;

    const totalSlides = allSlides.length;
    dotsContainer.innerHTML = Array.from({ length: totalSlides }, (_, i) => `
      <button class="hero-slider-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Слайд ${i + 1}"></button>
    `).join('');

    startSlider(slider, dotsContainer, totalSlides);

  } catch (error) {
    console.error('❌ Ошибка загрузки баннеров:', error);
    
    slider.innerHTML = `
      <div class="hero-slide active hero-slide-text">
        <div class="hero-slide-text-content">
          <div class="hero-slide-text-tag">Надежный партнер с 2006 года</div>
          <h1 class="hero-slide-text-title">Крепёж<br/>Сила<br/><span class="text-outline">Сталь</span></h1>
          <p class="hero-slide-text-desc">Знаем толк в крепеже и сварке</p>
          <div class="hero-slide-text-buttons">
            <a href="/catalog" class="hero-slide-text-btn primary">Смотреть каталог</a>
            <a href="/about" class="hero-slide-text-btn secondary">О компании</a>
          </div>
        </div>
        <div class="hero-slide-overlay"></div>
      </div>
    `;
    dotsContainer.innerHTML = `<button class="hero-slider-dot active" data-index="0"></button>`;
  }
}

// ===== ЗАПУСК СЛАЙДЕРА (ОДНА ФУНКЦИЯ) =====
function startSlider(slider, dotsContainer, totalSlides) {
  if (totalSlides === 0) return;
  
  let current = 0;
  let interval;

  function goTo(index) {
    if (index === current) return;
    const slidesElements = slider.querySelectorAll('.hero-slide');
    const dots = dotsContainer.querySelectorAll('.hero-slider-dot');
    
    if (slidesElements.length === 0) return;
    
    slidesElements[current]?.classList.remove('active');
    dots[current]?.classList.remove('active');
    
    const targetIndex = ((index % totalSlides) + totalSlides) % totalSlides;
    slidesElements[targetIndex]?.classList.add('active');
    dots[targetIndex]?.classList.add('active');
    
    current = targetIndex;
  }

  function next() {
    goTo(current + 1);
  }

  dotsContainer.querySelectorAll('.hero-slider-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const index = parseInt(dot.dataset.index);
      if (!isNaN(index)) {
        goTo(index);
        resetInterval();
      }
    });
  });

  let touchStartX = 0;
  let touchEndX = 0;
  
  slider.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  slider.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goTo(current + 1);
      } else {
        goTo(current - 1);
      }
      resetInterval();
    }
  }, { passive: true });

  function startInterval() {
    if (interval) clearInterval(interval);
    interval = setInterval(next, 6000);
  }

  function resetInterval() {
    clearInterval(interval);
    startInterval();
  }

  const container = slider.closest('.hero');
  if (container) {
    container.addEventListener('mouseenter', () => clearInterval(interval));
    container.addEventListener('mouseleave', startInterval);
  }

  startInterval();
}

// ===== ГЛОБАЛЬНЫЕ ПРИВЯЗКИ =====
window.navigate = navigate;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.toggleSidebar = toggleSidebar;
document.addEventListener("DOMContentLoaded", bootstrap);