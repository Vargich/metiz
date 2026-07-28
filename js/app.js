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
const cache = new Map();
const CACHE_TTL = 60000; 

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
  const currentPath = window.location.pathname;
  const currentParams = new URLSearchParams(window.location.search);
  const pageParam = currentParams.get('page');
  const categoryParam = currentParams.get('category');
  
  // Если переходим на каталог, но без параметров, добавляем page=1
  if (path.includes('/catalog') && !path.includes('page=')) {
    const hasParams = path.includes('?');
    path = path + (hasParams ? '&' : '?') + 'page=1';
  }

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

    // ✅ Обновляем мета-теги (SEO и Open Graph)
    const newMetaTags = doc.querySelectorAll('meta[name], meta[property]');
    newMetaTags.forEach(newMeta => {
      const attrName = newMeta.hasAttribute('name') ? 'name' : 'property';
      const attrValue = newMeta.getAttribute(attrName);
      let oldMeta = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
      
      if (oldMeta) {
        oldMeta.setAttribute('content', newMeta.getAttribute('content'));
      } else {
        document.head.appendChild(newMeta.cloneNode());
      }
    });

    const newMain = doc.querySelector("main");
    if (newMain) {
      window.scrollTo(0, 0);
      main.innerHTML = newMain.innerHTML;
      updateHeaderActive(new URL(path, window.location.origin).pathname);
      const url = new URL(path, window.location.origin);
      initPageFunctions(url.pathname, url.searchParams);

      
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
      href === path || (path === "/" && (href === "/" || href === "/index")),
    );
  });
}

// app.js - исправленные функции

// ===== ВСПОМОГАТЕЛЬНЫЙ РЕНДЕР ИЗОБРАЖЕНИЯ =====
function getProductImageHtml(p) {
  // Проверяем, есть ли массив images
  let images = [];
  try {
    if (p.images && typeof p.images === 'string') {
      images = JSON.parse(p.images);
    } else if (Array.isArray(p.images)) {
      images = p.images;
    }
  } catch (e) {
    images = [];
  }

  // Если images пустой, но есть image, используем его как единственное фото
  if (images.length === 0 && p.image && p.image.length > 5) {
    images = [p.image];
  }

  // Фильтруем пустые строки
  images = images.filter(img => img && img.length > 5);

  const hasMultiple = images.length > 1;

  if (images.length === 0) {
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

  const mainImg = images[0];
  // Сохраняем данные в data-атрибуте, а в onclick передаем id элемента
  const galleryId = 'gallery-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

  return `
    <div class="product-gallery" data-images='${JSON.stringify(images)}' data-gallery-id="${galleryId}">
      <div class="product-gallery-main" onclick="window.openImageModalFromElement(this)">
        <img src="${mainImg}" alt="${p.name}" loading="lazy" class="gallery-main-img">
        ${hasMultiple ? `
          <div class="gallery-nav-btn gallery-prev" data-dir="-1"><i class="fas fa-chevron-left"></i></div>
          <div class="gallery-nav-btn gallery-next" data-dir="1"><i class="fas fa-chevron-right"></i></div>
          <div class="gallery-counter">1 / ${images.length}</div>
        ` : ''}
      </div>
    </div>
  `;
}


// ===== НОВИНКИ НА ГЛАВНОЙ =====
async function initNewProducts() {
  const container = document.getElementById("newProductsContainer");
  if (!container) return;

  try {
    // const products = await API.products.getAll();
    
    // 🔥 ТОЛЬКО товары с бейджем 'new' И в наличии
    const news = await fetch('/api/products/new?limit=8').then(r => r.json());

    if (news.length === 0) {
      container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Новинки скоро появятся в каталоге</p>';
      return;
    }

    container.innerHTML = news
      .map((p) => {
        // Получаем изображения для галереи
        let images = [];
        try {
          if (p.images && typeof p.images === 'string') {
            images = JSON.parse(p.images);
          } else if (Array.isArray(p.images)) {
            images = p.images;
          }
        } catch (e) {
          images = [];
        }
        if (images.length === 0 && p.image && p.image.length > 5) {
          images = [p.image];
        }
        images = images.filter(img => img && img.length > 5);
        
        const mainImg = images.length > 0 ? images[0] : '';
        const hasMultiple = images.length > 1;
        const imagesData = JSON.stringify(images);

        // Формируем HTML галереи
        let galleryHtml = '';
        if (images.length === 0) {
          galleryHtml = `
            <div class="product-img-placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>Нет фото</span>
            </div>
          `;
        } else {
          galleryHtml = `
            <div class="product-gallery" data-images='${imagesData}'>
              <div class="product-gallery-main" onclick="window.openImageModalFromElement(this)">
                <img src="${mainImg}" alt="${p.name}" loading="lazy" class="gallery-main-img">
                ${hasMultiple ? `
                  <div class="gallery-nav-btn gallery-prev" data-dir="-1"><i class="fas fa-chevron-left"></i></div>
                  <div class="gallery-nav-btn gallery-next" data-dir="1"><i class="fas fa-chevron-right"></i></div>
                  <div class="gallery-counter">1 / ${images.length}</div>
                ` : ''}
              </div>
            </div>
          `;
        }

        return `
          <div class="product-card">
            <div class="product-img ${images.length > 0 ? 'has-img' : ''}">
              ${galleryHtml}
              <div class="product-badge new">Новинка</div>
            </div>
            <div class="product-info">
              <h3 class="product-title" title="${p.name}">${p.name}</h3>
              
            </div>
          </div>
        `;
      })
      .join("");

    // Инициализируем галереи в новинках
    initProductGalleries();
  } catch (err) {
    console.error("New products error:", err);
    container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Не удалось загрузить новинки</p>';
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ ГАЛЕРЕЙ ТОВАРОВ =====
function initProductGalleries() {
  document.querySelectorAll('.product-gallery').forEach(gallery => {
    const mainImg = gallery.querySelector('.gallery-main-img');
    const prevBtn = gallery.querySelector('.gallery-prev');
    const nextBtn = gallery.querySelector('.gallery-next');
    const counter = gallery.querySelector('.gallery-counter');
    
    if (!mainImg) return;
    
    let images = [];
    try {
      const data = gallery.dataset.images;
      if (data) {
        images = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to parse gallery images:', e);
      images = [];
    }
    
    if (!Array.isArray(images) || images.length < 2) return;
    
    let currentIndex = 0;
    
    function updateGallery(index) {
      currentIndex = (index + images.length) % images.length;
      mainImg.src = images[currentIndex];
      mainImg.alt = `Фото ${currentIndex + 1}`;
      
      if (counter) {
        counter.textContent = `${currentIndex + 1} / ${images.length}`;
      }
    }
    
    // Кнопки навигации
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateGallery(currentIndex - 1);
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateGallery(currentIndex + 1);
      });
    }
  });
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

    // const response = await fetch(`/api/products/paginated?${params}`);
    // const data = await response.json();

    const cacheKey = params.toString();
    
    // ✅ Проверяем кэш
    let data;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      data = cached.data;
    } else {
      const response = await fetch(`/api/products/paginated?${params}`);
      data = await response.json();
      // Сохраняем в кэш
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

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
        // Получаем изображения для галереи
        let images = [];
        try {
          if (p.images && typeof p.images === 'string') {
            images = JSON.parse(p.images);
          } else if (Array.isArray(p.images)) {
            images = p.images;
          }
        } catch (e) {
          images = [];
        }
        if (images.length === 0 && p.image && p.image.length > 5) {
          images = [p.image];
        }
        images = images.filter(img => img && img.length > 5);
        
        const mainImg = images.length > 0 ? images[0] : '';
        const hasMultiple = images.length > 1;
        const imagesData = JSON.stringify(images);

        // Формируем HTML галереи
        let galleryHtml = '';
        if (images.length === 0) {
          galleryHtml = `
            <div class="product-img-placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>Нет фото</span>
            </div>
          `;
        } else {
          galleryHtml = `
            <div class="product-gallery" data-images='${imagesData}'>
              <div class="product-gallery-main" onclick="window.openImageModalFromElement(this)">
              <img src="${mainImg}" alt="${p.name}" loading="lazy" decoding="async" class="gallery-main-img">
                ${hasMultiple ? `
                  <div class="gallery-nav-btn gallery-prev" data-dir="-1"><i class="fas fa-chevron-left"></i></div>
                  <div class="gallery-nav-btn gallery-next" data-dir="1"><i class="fas fa-chevron-right"></i></div>
                  <div class="gallery-counter">1 / ${images.length}</div>
                ` : ''}
              </div>
            </div>
          `;
        }

        return `
          <div class="product-card">
            <div class="product-img ${images.length > 0 ? 'has-img' : ''}">
              ${galleryHtml}
              ${p.badge ? `<div class="product-badge ${p.badge}">${p.badge === 'hit' ? 'Хит' : 'Новинка'}</div>` : ''}
            </div>
            <div class="product-info">
              <h3 class="product-title" title="${p.name}">${p.name}</h3>
              
            </div>
          </div>
        `;
      })
      .join("");

    // Инициализируем галереи
    initProductGalleries();

    updatePaginationButtons(currentPage, totalPages);
  } catch (err) {
    console.error("Render products error:", err);
    grid.innerHTML = '<div style="grid-column:1/-1; padding:60px; text-align:center; color:red;">Ошибка загрузки товаров</div>';
  }
}

// ===== ПРЕДЗАГРУЗКА СЛЕДУЮЩЕЙ СТРАНИЦЫ =====
let preloadTimeout = null;

function preloadNextPage() {
  if (currentPage < totalPages) {
    clearTimeout(preloadTimeout);
    preloadTimeout = setTimeout(() => {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams({
        page: nextPage,
        limit: pageLimit,
        category: currentFilter,
        search: currentSearch,
        sort: currentSort
      });
      const cacheKey = params.toString();
      if (!cache.has(cacheKey)) {
        fetch(`/api/products/paginated?${params}`)
          .then(r => r.json())
          .then(data => {
            cache.set(cacheKey, { data, timestamp: Date.now() });
          })
          .catch(() => {});
      }
    }, 500);
  }
}

// Вызываем после рендера
function updatePaginationButtons(page, totalPages) {
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");

  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
  if (pageInfo) pageInfo.textContent = `Страница ${page} из ${totalPages}`;
  
  // ✅ Предзагружаем следующую страницу
  if (page < totalPages) {
    preloadNextPage();
  }
}


// ===== РЕКОМЕНДАЦИИ =====
async function initPromoProducts() {
  const container = document.getElementById("promoProductsContainer");
  if (!container) return;

  try {
    // const products = await API.products.getAll();
    const hits = await fetch('/api/products/hit?limit=8').then(r => r.json());

    if (hits.length === 0) {
      container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Рекомендации скоро появятся</p>';
      return;
    }

    container.innerHTML = hits
      .map((p) => {
        // Получаем изображения для галереи
        let images = [];
        try {
          if (p.images && typeof p.images === 'string') {
            images = JSON.parse(p.images);
          } else if (Array.isArray(p.images)) {
            images = p.images;
          }
        } catch (e) {
          images = [];
        }
        if (images.length === 0 && p.image && p.image.length > 5) {
          images = [p.image];
        }
        images = images.filter(img => img && img.length > 5);
        
        const mainImg = images.length > 0 ? images[0] : '';
        const hasMultiple = images.length > 1;
        const imagesData = JSON.stringify(images);

        // Формируем HTML галереи
        let galleryHtml = '';
        if (images.length === 0) {
          galleryHtml = `
            <div class="product-img-placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>Нет фото</span>
            </div>
          `;
        } else {
          galleryHtml = `
            <div class="product-gallery" data-images='${imagesData}'>
              <div class="product-gallery-main" onclick="window.openImageModalFromElement(this)">
                <img src="${mainImg}" alt="${p.name}" loading="lazy" class="gallery-main-img">
                ${hasMultiple ? `
                  <div class="gallery-nav-btn gallery-prev" data-dir="-1"><i class="fas fa-chevron-left"></i></div>
                  <div class="gallery-nav-btn gallery-next" data-dir="1"><i class="fas fa-chevron-right"></i></div>
                  <div class="gallery-counter">1 / ${images.length}</div>
                ` : ''}
              </div>
            </div>
          `;
        }

        return `
          <div class="product-card">
            <div class="product-img ${images.length > 0 ? 'has-img' : ''}">
              ${galleryHtml}
              <div class="product-badge">Хит</div>
            </div>
            <div class="product-info">
              <h3 class="product-title" title="${p.name}">${p.name}</h3>
              
            </div>
          </div>
        `;
      })
      .join("");

    // Инициализируем галереи
    initProductGalleries();
  } catch (err) {
    console.error("Promo products error:", err);
  }
}

// ===== МОДАЛЬНОЕ ОКНО ДЛЯ ПРОСМОТРА ФОТО С НАВИГАЦИЕЙ =====
window.openImageModalFromElement = function(element) {
  // Находим родительский элемент .product-gallery
  const gallery = element.closest('.product-gallery');
  if (!gallery) {
    console.warn('Gallery element not found');
    return;
  }
  
  let images = [];
  try {
    const data = gallery.dataset.images;
    if (data) {
      images = JSON.parse(data);
    }
  } catch (e) {
    console.warn('Failed to parse images data:', e);
    images = [];
  }
  
  // Фильтруем пустые
  images = images.filter(img => img && typeof img === 'string' && img.length > 5);
  
  if (images.length === 0) {
    console.warn('No valid images found');
    return;
  }
  
  // Определяем текущий индекс по src главного изображения
  const mainImg = gallery.querySelector('.gallery-main-img');
  let currentIndex = 0;
  if (mainImg) {
    const currentSrc = mainImg.src;
    const index = images.indexOf(currentSrc);
    if (index !== -1) {
      currentIndex = index;
    }
  }
  
  const modal = document.getElementById("imgZoomModal");
  const target = document.getElementById("imgZoomTarget");
  const counter = document.getElementById("imgZoomCounter");
  const prevBtn = document.getElementById("imgZoomPrev");
  const nextBtn = document.getElementById("imgZoomNext");
  
  if (!modal || !target) return;
  
  function updateZoomImage(index) {
    currentIndex = (index + images.length) % images.length;
    target.src = images[currentIndex];
    if (counter) {
      counter.textContent = `${currentIndex + 1} / ${images.length}`;
    }
    if (prevBtn) {
      prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
    }
    if (nextBtn) {
      nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
    }
  }
  
  // Обновляем навигацию
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      updateZoomImage(currentIndex - 1);
    };
  }
  
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      updateZoomImage(currentIndex + 1);
    };
  }
  
  // Клавиши влево/вправо
  const keyHandler = (e) => {
    if (!modal.classList.contains('open')) {
      document.removeEventListener('keydown', keyHandler);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      updateZoomImage(currentIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      updateZoomImage(currentIndex + 1);
    } else if (e.key === 'Escape') {
      closeImageModal();
    }
  };
  
  // Удаляем старый обработчик, добавляем новый
  document.removeEventListener('keydown', keyHandler);
  document.addEventListener('keydown', keyHandler);
  
  // Сохраняем обработчик для удаления при закрытии
  modal._keyHandler = keyHandler;
  
  updateZoomImage(currentIndex);
  modal.classList.add("open");
};

window.closeImageModal = function () {
  const modal = document.getElementById("imgZoomModal");
  if (modal) {
    modal.classList.remove("open");
    if (modal._keyHandler) {
      document.removeEventListener('keydown', modal._keyHandler);
      delete modal._keyHandler;
    }
  }
};

// Добавляем элементы навигации в модальное окно при инициализации
if (!document.getElementById("imgZoomModal")) {
  const modalHtml = `
  <div id="imgZoomModal" class="img-zoom-modal" onclick="closeImageModal()">
      <div class="img-zoom-content" onclick="event.stopPropagation()">
          <button class="img-zoom-close" onclick="closeImageModal()">&times;</button>
          <button class="img-zoom-nav img-zoom-prev" id="imgZoomPrev"><i class="fas fa-chevron-left"></i></button>
          <img id="imgZoomTarget" src="" alt="Просмотр фото">
          <button class="img-zoom-nav img-zoom-next" id="imgZoomNext"><i class="fas fa-chevron-right"></i></button>
          <div class="img-zoom-counter" id="imgZoomCounter">1 / 1</div>
      </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// Единый метод для синхронизации параметров в адресной строке
function updateCatalogUrl(page = 1, category = currentFilter, search = currentSearch, replace = false) {
  const params = new URLSearchParams();
  
  // Параметр page подставляется ВСЕГДА
  params.set('page', page);

  if (category && category !== 'all') {
    params.set('category', category);
  }
  if (search && search.trim() !== '') {
    params.set('search', search.trim());
  }

  const newUrl = window.location.pathname + '?' + params.toString();

  if (replace) {
    window.history.replaceState({ page }, '', newUrl);
  } else {
    window.history.pushState({ page }, '', newUrl);
  }
}
// ===== ИНИЦИАЛИЗАЦИЯ КАТАЛОГА =====
async function initCatalog(params) {
  const grid = document.getElementById("productsGrid");
  if (!grid) {
    // console.warn("ProductsGrid not found, retrying...");
    setTimeout(() => initCatalog(params), 200);
    return;
  }

  const urlParams = params || new URLSearchParams(window.location.search);
  currentFilter = urlParams.get("category") || "all";
  currentPage = parseInt(urlParams.get("page")) || 1;
  currentSearch = urlParams.get("search") || "";

  if (!new URLSearchParams(window.location.search).has("page")) {
    updateCatalogUrl(currentPage, currentFilter, currentSearch, true);
  }

  // ==== СОРТИРОВКА (Yandex Market Style) ====
  const sortContainer = document.querySelector(".catalog-sort-container");
  if (sortContainer) {
    const sortOptions = [
      { value: "default", label: "По умолчанию" },
      { value: "name", label: "По алфавиту (А-Я)" },
    ];

    sortContainer.innerHTML = `
      <div class="ym-filter-section">
        <h4 class="ym-filter-title">Сортировка</h4>
        <div class="ym-filter-list" id="sortList">
          ${sortOptions.map(o => `
            <label class="ym-radio">
              <input type="radio" name="sort" value="${o.value}" ${o.value === currentSort ? 'checked' : ''}>
              <span class="ym-radio-text">${o.label}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;

    sortContainer.querySelectorAll('input[name="sort"]').forEach(input => {
      input.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderProducts(1);
      });
    });
  }

  // ==== КАТЕГОРИИ (Yandex Market Style) ====
  const categoryContainer = document.querySelector(".catalog-category-container");
  if (categoryContainer) {
    try {
      const cats = await API.categories.getAll();
      allCategories = cats;

      categoryContainer.innerHTML = `
        <div class="ym-filter-section">
          <h4 class="ym-filter-title">Категории</h4>
          <div class="ym-filter-list" id="categoryList">
            <label class="ym-radio">
              <input type="radio" name="category" value="all" ${currentFilter === 'all' ? 'checked' : ''}>
              <span class="ym-radio-text">Все товары</span>
            </label>
            ${cats.map(c => `
              <label class="ym-radio">
                <input type="radio" name="category" value="${c.slug}" ${c.slug === currentFilter ? 'checked' : ''}>
                <span class="ym-radio-text">${c.name}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;

      categoryContainer.querySelectorAll('input[name="category"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilter = e.target.value;
          const pageParam = `?page=1${currentFilter !== 'all' ? `&category=${currentFilter}` : ''}`;
          window.history.replaceState({}, "", `/catalog${pageParam}`);
          renderProducts(1);
        });
      });
    } catch (err) {
      console.error("Categories error:", err);
    }
  }

  // ===== ПОИСК =====

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = currentSearch;
    let timeout;
    searchInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1;
        // ✅ При поиске сбрасываем на 1 страницу и обновляем URL
        updateCatalogUrl(1, currentFilter, currentSearch, true);
        renderProducts(1);
      }, 300);
    };
  }

// ===== ПАГИНАЦИЯ =====

const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        updateCatalogUrl(currentPage, currentFilter, currentSearch, false);
        renderProducts(currentPage);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        updateCatalogUrl(currentPage, currentFilter, currentSearch, false);
        renderProducts(currentPage);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }
function updateUrlWithPage(page) {
  const params = new URLSearchParams(window.location.search);
  params.set('page', page);
  
  // Если категория не выбрана, удаляем параметр
  if (currentFilter === 'all') {
    params.delete('category');
  } else {
    params.set('category', currentFilter);
  }
  
  const newUrl = window.location.pathname + '?' + params.toString();
  window.history.pushState({ page: page }, '', newUrl);
}

  // Заголовок
  updateCategoryTitle(currentFilter);

  renderProducts(currentPage);

  setTimeout(initStickyFilterBar, 200);
  
}

// Закрытие всех дропдаунов при клике вне
document.addEventListener("click", () => {
  document.querySelectorAll(".dropdown-list.open").forEach((el) => {
    el.classList.remove("open");
  });
  document.querySelectorAll(".dropdown-header.active").forEach((el) => {
    el.classList.remove("active");
  });
});

// ===== ОБНОВЛЕНИЕ ЗАГОЛОВКА С ВЫБРАННОЙ КАТЕГОРИЕЙ =====
function updateCategoryTitle(categorySlug) {
  const titleElement = document.querySelector(".catalog-title");
  if (!titleElement) return;

  if (categorySlug === "all") {
    titleElement.textContent = "Все товары";
  } else {
    const category = allCategories.find((c) => c.slug === categorySlug);
    titleElement.textContent = category ? category.name : "Все товары";
  }
}



// ===== ЭФФЕКТ ПРИЛИПАНИЯ ДЛЯ ФИЛЬТРОВ =====
function initStickyFilterBar() {
  const filterBar = document.querySelector(".catalog-filter-bar");
  if (!filterBar) return;

  let isSticky = false;

  window.addEventListener("scroll", () => {
    const rect = filterBar.getBoundingClientRect();
    const top = rect.top;

    // Если верх фильтра доходит до шапки
    if (top <= 80 && !isSticky) {
      filterBar.classList.add("is-sticky");
      isSticky = true;
    } else if (top > 80 && isSticky) {
      filterBar.classList.remove("is-sticky");
      isSticky = false;
    }
  });
}

// function updatePaginationButtons(page, totalPages) {
//   const prevBtn = document.getElementById("prevPageBtn");
//   const nextBtn = document.getElementById("nextPageBtn");
//   const pageInfo = document.getElementById("pageInfo");

//   if (prevBtn) prevBtn.disabled = page <= 1;
//   if (nextBtn) nextBtn.disabled = page >= totalPages;
//   if (pageInfo) pageInfo.textContent = `Страница ${page} из ${totalPages}`;
// }

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


// Добавляем элементы навигации в модальное окно при инициализации



// Добавляем элементы навигации в модальное окно при инициализации


// ===== БУРГЕР-МЕНЮ =====
function initBurgerMenu() {
  const burgerBtn = document.getElementById("burgerBtn");
  const navMenu = document.getElementById("shopNav");
  if (!burgerBtn || !navMenu) return;

  burgerBtn.onclick = (e) => {
    e.stopPropagation();
    burgerBtn.classList.toggle("active");
    navMenu.classList.toggle("open");
    document.body.classList.toggle("menu-open");
  };

  navMenu.querySelectorAll("a").forEach((link) => {
    link.onclick = () => {
      burgerBtn.classList.remove("active");
      navMenu.classList.remove("open");
      document.body.classList.remove("menu-open");
    };
  });
}

function initScrollFeatures() {
  window.addEventListener("scroll", () => {
    const winScroll =
      document.body.scrollTop || document.documentElement.scrollTop;
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



window.openImageModal = function (src) {
  document.getElementById("imgZoomTarget").src = src;
  document.getElementById("imgZoomModal").classList.add("open");
};

window.closeImageModal = function () {
  document.getElementById("imgZoomModal").classList.remove("open");
};

function initPageFunctions(
  path = window.location.pathname,
  params = new URLSearchParams(window.location.search),
) {
  // console.log("initPageFunctions called for:", path);

  if (path === "/" || path === "/index") {
    // // console.log("Initializing main page...");
    initPromoProducts();
    initNewProducts();
    initHeroSlider();
    initAboutSlider();
  } else if (path.includes("catalog")) {
    // // console.log("Initializing catalog...");
    // Проверяем наличие grid, если нет — ждем
    const grid = document.getElementById("productsGrid");
    if (grid) {
      initCatalog(params);
    } else {
      // // console.warn("ProductsGrid not found, retrying in 200ms...");
      setTimeout(() => {
        const gridRetry = document.getElementById("productsGrid");
        if (gridRetry) {
          initCatalog(params);
        } else {
          // //   console.error("ProductsGrid not found after retry");
        }
      }, 200);
    }
  } else if (path.includes("contacts")) {
    // //     console.log("Initializing contacts...");
    setTimeout(() => {
      initYandexMap();
    }, 100);
  }
}

// ===== СЛАЙДЕР НА ГЛАВНОЙ =====
function initHeroSlider() {
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".hero-slider-dot");
  if (!slides.length) return;

  let currentSlide = 0;
  let interval;

  function goToSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle("active", i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === index);
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
    dot.addEventListener("click", () => {
      goToSlide(index);
      startAutoPlay();
    });
  });

  const slider = document.querySelector(".hero-slider");
  if (slider) {
    slider.addEventListener("mouseenter", () => clearInterval(interval));
    slider.addEventListener("mouseleave", startAutoPlay);
  }

  goToSlide(0);
  startAutoPlay();
}

// ===== СЛАЙДЕР "О НАС" =====
function initAboutSlider() {
  const slides = document.querySelectorAll(".about-slide");
  const dots = document.querySelectorAll(".about-slider-dot");
  if (!slides.length) return;

  let currentSlide = 0;
  let interval;

  function goToSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle("active", i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === index);
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
    dot.addEventListener("click", () => {
      goToSlide(index);
      startAutoPlay();
    });
  });

  const container = document.querySelector(".about-slider-container");
  if (container) {
    container.addEventListener("mouseenter", () => clearInterval(interval));
    container.addEventListener("mouseleave", startAutoPlay);
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

  const currentPath = window.location.pathname;
  const currentParams = new URLSearchParams(window.location.search);

  // Если зашли в каталог без указания page, устанавливаем page=1 по умолчанию
  if (currentPath.includes('/catalog') && !currentParams.has('page')) {
    currentParams.set('page', '1');
    const newUrl = currentPath + '?' + currentParams.toString();
    window.history.replaceState({}, '', newUrl);
  }

  // Функция для безопасной инициализации страницы
  const safeInit = () => {
    if (currentPath.includes("catalog")) {
      const grid = document.getElementById("productsGrid");
      if (grid) {
        // ✅ ВАЖНО: берем актуальные параметры прямо из URL
        const actualParams = new URLSearchParams(window.location.search);
        initCatalog(actualParams);
        return true;
      }
      return false;
    } else if (currentPath === "/" || currentPath === "/index") {
      const container = document.getElementById("newProductsContainer");
      if (container) {
        initPromoProducts();
        initNewProducts();
        setTimeout(() => {
          initHeroSlider();
          initAboutSlider();
        }, 100);
        return true;
      }
      return false;
    } else if (currentPath.includes("contacts")) {
      const map = document.getElementById("map");
      if (map) {
        initYandexMap();
        return true;
      }
      return false;
    }
    return true;
  };

  if (document.readyState === "complete") {
    setTimeout(safeInit, 50);
  } else {
    const onLoad = () => {
      setTimeout(safeInit, 100);
      document.removeEventListener("readystatechange", onLoad);
    };
    document.addEventListener("readystatechange", onLoad);
    setTimeout(onLoad, 1000);
  }
}

window.navigate = navigate;
window.toggleSidebar = toggleSidebar;

document.addEventListener("DOMContentLoaded", bootstrap);
// ===== УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК КНОПКИ ФИЛЬТРА (фаза захвата) =====
function closeMobileFilter() {
  const filterBar = document.getElementById('catalogFilterBar');
  if (filterBar) filterBar.classList.remove('is-open');
  document.body.style.overflow = '';
  const overlayEl = document.querySelector('.mobile-filter-overlay');
  if (overlayEl) overlayEl.classList.remove('open');
}

document.addEventListener('click', function(e) {
  const toggleBtn = e.target.closest('#filterToggleBtn');
  const closeBtn = e.target.closest('.mobile-filter-close, .ym-apply-btn');
  const overlay = e.target.closest('.mobile-filter-overlay');

  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();
    
    const filterBar = document.getElementById('catalogFilterBar');
    if (filterBar) {
      filterBar.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      // 1. Оверлей
      let overlayEl = document.querySelector('.mobile-filter-overlay');
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.className = 'mobile-filter-overlay';
        document.body.appendChild(overlayEl);
        overlayEl.addEventListener('click', closeMobileFilter);
      }
      setTimeout(() => overlayEl.classList.add('open'), 10);

      // 2. Структура шторки (если еще не создана)
      const body = filterBar.querySelector('.filter-dropdown-body');
      if (body && !body.querySelector('.mobile-filter-header')) {
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'mobile-filter-scroll';
        
        // Переносим элементы в скролл-обертку
        while(body.firstChild) {
          scrollWrapper.appendChild(body.firstChild);
        }
        
        const header = document.createElement('div');
        header.className = 'mobile-filter-header';
        header.innerHTML = `
            <h3>Фильтры</h3>
            <button type="button" class="mobile-filter-close">&times;</button>
        `;
        
        const footer = document.createElement('div');
        footer.className = 'mobile-filter-footer';
        footer.innerHTML = `<button type="button" class="ym-apply-btn">Показать товары</button>`;
        
        body.appendChild(header);
        body.appendChild(scrollWrapper);
        body.appendChild(footer);
      }
    }
  } else if (closeBtn) {
    e.preventDefault();
    e.stopPropagation();
    closeMobileFilter();
  }
}, true); // <-- true включает фазу захвата