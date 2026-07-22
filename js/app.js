import API from "./api.js";
import { initYandexMap, initPickupMap } from "./map.js";

window.initYandexMap = initYandexMap;
window.initPickupMap = initPickupMap;

let allProducts = [];
let allCategories = [];
let currentFilter = "all";
let currentSearch = "";
let currentSort = "default";
let currentPage = 1;
const pageLimit = 24; // уменьшил для скорости
let totalPages = 1;

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
    loadPage(window.location.pathname + window.location.search);
}

async function navigate(path) {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState({}, "", path);
  await loadPage(path);
}

async function loadPage(path) {
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
      updateHeaderActive(new URL(path, window.location.origin).pathname);
      initPageFunctions(
        new URL(path, window.location.origin).pathname,
        new URL(path, window.location.origin).searchParams
      );
    }
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
      href === path || (path === "/" && (href === "/" || href === "/index"))
    );
  });
}

// ===== ВСПОМОГАТЕЛЬНЫЙ РЕНДЕР ИЗОБРАЖЕНИЯ =====
function getProductImageHtml(p) {
  const hasImg = p.image && p.image.length > 5;
  if (hasImg) {
    return `<img src="${p.image}" alt="${p.name}" loading="lazy">`;
  }
  return `
    <div class="product-img-placeholder">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      <span>Нет фото</span>
    </div>
  `;
}

// ===== НОВИНКИ НА ГЛАВНОЙ =====
async function initNewProducts() {
  const container = document.getElementById("newProductsContainer");
  if (!container) return;

  try {
    const products = await API.products.getAll();
    
    // 🔥 ТОЛЬКО товары с бейджем 'new' И в наличии
    const news = products
      .filter(p => p.badge === 'new' && (p.quantity || 0) > 0)
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 8);

    if (news.length === 0) {
      container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Новинки скоро появятся в каталоге</p>';
      return;
    }

    container.innerHTML = news
      .map((p) => {
        const hasImg = p.image && p.image.length > 5;
        const imgAction = hasImg ? `onclick="window.openImageModal('${p.image}')"` : "";

        return `
          <div class="product-card">
            <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
              ${getProductImageHtml(p)}
              <div class="product-badge new">Новинка</div>
            </div>
            <div class="product-info">
              <h3 class="product-title" title="${p.name}">${p.name}</h3>
              <div class="product-category-label">${p.category_name || "Новинки"}</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("New products error:", err);
    container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Не удалось загрузить новинки</p>';
  }
}




// ===== ИНИЦИАЛИЗАЦИЯ КАТАЛОГА =====
async function initCatalog(params) {
  const grid = document.getElementById("productsGrid");
  if (!grid) {
    console.warn('ProductsGrid not found, retrying...');
    setTimeout(() => initCatalog(params), 200);
    return;
  }

  const urlParams = params || new URLSearchParams(window.location.search);
  currentFilter = urlParams.get("category") || "all";
  currentPage = parseInt(urlParams.get("page")) || 1;

  // Сортировка как выпадающий список
  const sortContainer = document.querySelector('.catalog-sort-container');
  if (sortContainer) {
    sortContainer.innerHTML = `
      <select id="sortSelect" class="sort-select-top">
        <option value="default">По умолчанию</option>
        <option value="name">По алфавиту (А-Я)</option>
        <option value="price_asc">Сначала дешевле</option>
        <option value="price_desc">Сначала дороже</option>
      </select>
    `;
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.value = currentSort;
      sortSelect.onchange = (e) => {
        currentSort = e.target.value;
        renderProducts(1);
      };
    }
  }

  // Категории как выпадающий список
  const categoryContainer = document.querySelector('.catalog-category-container');
  if (categoryContainer) {
    try {
      const cats = await API.categories.getAll();
      allCategories = cats;
      categoryContainer.innerHTML = `
        <select id="categorySelect" class="sort-select-top">
          <option value="all">Все категории</option>
          ${cats.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}
        </select>
      `;
      const catSelect = document.getElementById('categorySelect');
      if (catSelect) {
        // Устанавливаем выбранную категорию из URL
        catSelect.value = currentFilter;
        catSelect.onchange = (e) => {
          currentFilter = e.target.value;
          window.history.replaceState(
            {},
            "",
            currentFilter === "all" ? "/catalog" : `/catalog?category=${currentFilter}`
          );
          renderProducts(1);
        };
      }
    } catch (err) {
      console.error('Categories error:', err);
    }
  }

  // Поиск
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = currentSearch;
    let timeout;
    searchInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentSearch = e.target.value;
        renderProducts(1);
      }, 300);
    };
  }

  // Пагинационные кнопки
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        renderProducts(currentPage - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        renderProducts(currentPage + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  // 🔥 Добавляем отображение выбранной категории в заголовке
  updateCategoryTitle(currentFilter);
  
  renderProducts(currentPage);

  setTimeout(initStickyFilterBar, 200);
}

// ===== ОБНОВЛЕНИЕ ЗАГОЛОВКА С ВЫБРАННОЙ КАТЕГОРИЕЙ =====
function updateCategoryTitle(categorySlug) {
  const titleElement = document.querySelector('.catalog-title');
  if (!titleElement) return;
  
  if (categorySlug === 'all') {
    titleElement.textContent = 'Все товары';
  } else {
    const category = allCategories.find(c => c.slug === categorySlug);
    titleElement.textContent = category ? category.name : 'Все товары';
  }
}

// ===== ОТОБРАЖЕНИЕ ТОВАРОВ С ПАГИНАЦИЕЙ (серверная) =====
async function renderProducts(page = 1) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  // Показываем скелетон
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-box" style="aspect-ratio:1/1; width:100%;"></div>
    </div>
  `).join('');

  try {
    const params = new URLSearchParams({
      page: page,
      limit: pageLimit,
      category: currentFilter,
      search: currentSearch,
      sort: currentSort
    });

    const response = await fetch(`/api/products/paginated?${params}`);
    const data = await response.json();

    const products = data.products || [];
    totalPages = data.totalPages || 1;
    currentPage = Math.min(Math.max(1, page), totalPages);

    if (products.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; padding:80px 20px; text-align:center;"><h3>Товаров не найдено</h3><p style="color:var(--text-muted); margin-top:8px;">Попробуйте изменить параметры поиска или категории</p></div>';
      updatePaginationButtons(currentPage, totalPages);
      return;
    }

    grid.innerHTML = products
      .map((p) => {
        const hasImg = p.image && p.image.length > 5;
        const imgAction = hasImg ? `onclick="window.openImageModal('${p.image}')"` : "";

        return `
          <div class="product-card">
            <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
              ${getProductImageHtml(p)}
              ${p.badge ? `<div class="product-badge ${p.badge}">${p.badge === 'hit' ? 'Хит' : 'Новинка'}</div>` : ''}
            </div>
            <div class="product-info">
              <h3 class="product-title" title="${p.name}">${p.name}</h3>
              <div class="product-category-label">${p.category_name || "Каталог"}</div>
            </div>
          </div>
        `;
      })
      .join("");

    updatePaginationButtons(currentPage, totalPages);
  } catch (err) {
    console.error("Render products error:", err);
    grid.innerHTML = '<div style="grid-column:1/-1; padding:60px; text-align:center; color:red;">Ошибка загрузки товаров</div>';
  }
}

// ===== ЭФФЕКТ ПРИЛИПАНИЯ ДЛЯ ФИЛЬТРОВ =====
function initStickyFilterBar() {
  const filterBar = document.querySelector('.catalog-filter-bar');
  if (!filterBar) return;
  
  let isSticky = false;
  
  window.addEventListener('scroll', () => {
    const rect = filterBar.getBoundingClientRect();
    const top = rect.top;
    
    // Если верх фильтра доходит до шапки
    if (top <= 80 && !isSticky) {
      filterBar.classList.add('is-sticky');
      isSticky = true;
    } else if (top > 80 && isSticky) {
      filterBar.classList.remove('is-sticky');
      isSticky = false;
    }
  });
}




function updatePaginationButtons(page, totalPages) {
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");

  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
  if (pageInfo) pageInfo.textContent = `Страница ${page} из ${totalPages}`;
}

// ===== МОБИЛЬНЫЙ САЙДБАР =====
function toggleSidebar() {
  const sidebar = document.getElementById("catalogSidebar");
  if (!sidebar) return;

  let overlay = document.getElementById("sidebarOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "dropdown-overlay";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", toggleSidebar);
  }

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

// ===== РЕКОМЕНДАЦИИ =====
async function initPromoProducts() {
  const container = document.getElementById("promoProductsContainer");
  if (!container) return;

  try {
    const products = await API.products.getAll();
    const hits = products.filter((p) => p.badge === "hit" && (p.quantity || 0) > 0);

    if (hits.length === 0) {
      container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Рекомендации скоро появятся</p>';
      return;
    }

    container.innerHTML = hits
      .map((p) => {
        const hasImg = p.image && p.image.length > 5;
        const imgAction = hasImg ? `onclick="window.openImageModal('${p.image}')"` : "";

        return `
          <div class="product-card">
            <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
              ${getProductImageHtml(p)}
              <div class="product-badge">Хит</div>
            </div>
            <div class="product-info">
              <h3 class="product-title" title="${p.name}">${p.name}</h3>
              <div class="product-category-label">${p.category_name || 'Рекомендации'}</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Promo products error:", err);
  }
}

// ===== БУРГЕР-МЕНЮ =====
function initBurgerMenu() {
  const burgerBtn = document.getElementById("burgerBtn");
  const navMenu = document.getElementById("shopNav");
  if (!burgerBtn || !navMenu) return;

  burgerBtn.onclick = (e) => {
    e.stopPropagation();
    burgerBtn.classList.toggle("active");
    navMenu.classList.toggle("open");
  };

  navMenu.querySelectorAll("a").forEach((link) => {
    link.onclick = () => {
      burgerBtn.classList.remove("active");
      navMenu.classList.remove("open");
    };
  });
}

function initScrollFeatures() {
  window.addEventListener("scroll", () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const btn = document.getElementById("scroll-to-top");
    if (btn) {
      if (winScroll > 300) btn.classList.add("show");
      else btn.classList.remove("show");
    }
  });
}

function enforceRKN() {
  const cookieConsent = localStorage.getItem("rkn_cookie_consent");
  if (!cookieConsent && !document.getElementById("cookie-banner")) {
    const banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.innerHTML = `
      <div>Мы используем файлы cookie. Продолжая работу, вы соглашаетесь с <a href="/policy">Политикой конфиденциальности</a>.</div>
      <button class="btn btn-primary" onclick="acceptCookies()">Согласен</button>
    `;
    document.body.appendChild(banner);
  }
}

window.acceptCookies = function () {
  localStorage.setItem("rkn_cookie_consent", "true");
  const banner = document.getElementById("cookie-banner");
  if (banner) banner.remove();
};

if (!document.getElementById("imgZoomModal")) {
  const modalHtml = `
  <div id="imgZoomModal" class="img-zoom-modal" onclick="closeImageModal()">
      <div class="img-zoom-content" onclick="event.stopPropagation()">
          <button class="img-zoom-close" onclick="closeImageModal()">&times;</button>
          <img id="imgZoomTarget" src="" alt="Просмотр фото">
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

function initPageFunctions(
  path = window.location.pathname,
  params = new URLSearchParams(window.location.search)
) {
  console.log('initPageFunctions called for:', path);
  
  if (path === "/" || path === "/index") {
    console.log('Initializing main page...');
    initPromoProducts();
    initNewProducts();
    initHeroSlider();
    initAboutSlider();
  } else if (path.includes("catalog")) {
    console.log('Initializing catalog...');
    // Проверяем наличие grid, если нет — ждем
    const grid = document.getElementById("productsGrid");
    if (grid) {
      initCatalog(params);
    } else {
      console.warn('ProductsGrid not found, retrying in 200ms...');
      setTimeout(() => {
        const gridRetry = document.getElementById("productsGrid");
        if (gridRetry) {
          initCatalog(params);
        } else {
          console.error('ProductsGrid not found after retry');
        }
      }, 200);
    }
  } else if (path.includes("contacts")) {
    console.log('Initializing contacts...');
    setTimeout(() => {
      initYandexMap();
    }, 100);
  }
}

// ===== СЛАЙДЕР НА ГЛАВНОЙ =====
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-slider-dot');
  if (!slides.length) return;

  let currentSlide = 0;
  let interval;

  function goToSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    currentSlide = index;
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % slides.length);
  }

  function startAutoPlay() {
    if (interval) clearInterval(interval);
    interval = setInterval(nextSlide, 5000);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index);
      startAutoPlay();
    });
  });

  const slider = document.querySelector('.hero-slider');
  if (slider) {
    slider.addEventListener('mouseenter', () => clearInterval(interval));
    slider.addEventListener('mouseleave', startAutoPlay);
  }

  goToSlide(0);
  startAutoPlay();
}

// ===== СЛАЙДЕР "О НАС" =====
function initAboutSlider() {
  const slides = document.querySelectorAll('.about-slide');
  const dots = document.querySelectorAll('.about-slider-dot');
  if (!slides.length) return;

  let currentSlide = 0;
  let interval;

  function goToSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    currentSlide = index;
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % slides.length);
  }

  function startAutoPlay() {
    if (interval) clearInterval(interval);
    interval = setInterval(nextSlide, 5000);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index);
      startAutoPlay();
    });
  });

  const container = document.querySelector('.about-slider-container');
  if (container) {
    container.addEventListener('mouseenter', () => clearInterval(interval));
    container.addEventListener('mouseleave', startAutoPlay);
  }

  goToSlide(0);
  startAutoPlay();
}

async function bootstrap() {
  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.innerText = new Date().getFullYear();

  setupNavigation();
  
  // Инициализируем бургер-меню и скролл
  initBurgerMenu();
  initScrollFeatures();
  enforceRKN();
  
  // 🔥 ВАЖНО: инициализируем страницу при загрузке с проверкой готовности DOM
  const currentPath = window.location.pathname;
  const currentParams = new URLSearchParams(window.location.search);
  
  // Функция для безопасной инициализации
  const safeInit = () => {
    // Проверяем, что нужные элементы существуют
    if (currentPath.includes("catalog")) {
      const grid = document.getElementById("productsGrid");
      if (grid) {
        console.log('DOM ready, initializing catalog...');
        initCatalog(currentParams);
        return true;
      }
      return false;
    } else if (currentPath === "/" || currentPath === "/index") {
      // Для главной проверяем наличие контейнеров
      const container = document.getElementById("newProductsContainer");
      if (container) {
        console.log('DOM ready, initializing main page...');
        initPromoProducts();
        initNewProducts();
        initHeroSlider();
        initAboutSlider();
        return true;
      }
      return false;
    } else if (currentPath.includes("contacts")) {
      const map = document.getElementById("map");
      if (map) {
        console.log('DOM ready, initializing contacts...');
        initYandexMap();
        return true;
      }
      return false;
    }
    return true; // для других страниц
  };

  // Пробуем инициализировать сразу
  if (document.readyState === 'complete') {
    // Страница уже загружена
    setTimeout(safeInit, 50);
  } else {
    // Ждем полной загрузки
    const onLoad = () => {
      console.log('Page fully loaded, initializing...');
      // Даем браузеру время на отрисовку
      setTimeout(safeInit, 100);
      document.removeEventListener('readystatechange', onLoad);
    };
    document.addEventListener('readystatechange', onLoad);
    // Фолбек на случай, если событие не сработает
    setTimeout(onLoad, 1000);
  }
}

window.navigate = navigate;
window.toggleSidebar = toggleSidebar;

document.addEventListener("DOMContentLoaded", bootstrap);