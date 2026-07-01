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
// async function bootstrap() {
//   const savedCart = localStorage.getItem("cart");
//   if (savedCart) {
//     try {
//       cart = JSON.parse(savedCart);
//     } catch (e) {
//       cart = [];
//     }
//   }
//   ensureModalsExist();

//   const yearEl = document.getElementById("current-year");
//   if (yearEl) yearEl.innerText = new Date().getFullYear();

//   try {
//     const data = await API.auth.me();
//     if (data && data.user) {
//       currentUser = data.user;
//       updateUIForLoggedInUser(currentUser);
//     }
//   } catch (e) {
//     console.log("No user session found");
//   }

//   updateCartBadge();
//   setupNavigation();
//   initPageFunctions();
//   initAuthMasking();

//   enforceRKN();
//   initScrollFeatures();
// }

// Найти в app.js и заменить функцию bootstrap() на упрощенную:
async function bootstrap() {
  ensureModalsExist();

  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.innerText = new Date().getFullYear();

  // Удалена проверка сессии пользователя, обновление корзины и маскировка ввода

  setupNavigation();
  initPageFunctions();

  enforceRKN();
  initScrollFeatures();
}

// ===== МАСКИРОВКА ВВОДА =====
function initAuthMasking() {
  const input = document.getElementById("authContact");
  const icon = document.getElementById("input-type-icon");
  if (!input) return;

  input.addEventListener("input", (e) => {
    let val = e.target.value;

    if (!val) {
      if (icon) icon.innerHTML = "";
      return;
    }

    if (val.includes("@") || /[a-zA-Zа-яА-Я]/.test(val)) {
      if (icon) icon.innerHTML = '<i class="fas fa-envelope"></i> EMAIL';
      return;
    }

    if (icon) icon.innerHTML = '<i class="fas fa-phone"></i> PHONE';

    let cleaned = val.replace(/\D/g, "");

    if (!cleaned) {
      input.value = "";
      return;
    }

    if (cleaned.startsWith("8")) cleaned = "7" + cleaned.substring(1);
    if (!cleaned.startsWith("7")) cleaned = "7" + cleaned;

    let masked = "+7";
    if (cleaned.length > 1) {
      masked += " (" + cleaned.substring(1, 4);
    }
    if (cleaned.length >= 5) {
      masked += ") " + cleaned.substring(4, 7);
    }
    if (cleaned.length >= 8) {
      masked += "-" + cleaned.substring(7, 9);
    }
    if (cleaned.length >= 10) {
      masked += "-" + cleaned.substring(9, 11);
    }

    input.value = masked.substring(0, 18);
  });
}

// ===== SPA НАВИГАЦИЯ =====
// НАЙТИ И ЗАМЕНИТЬ В app.js:
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
        !path.startsWith("/admin") // <-- ИСКЛЮЧАЕМ АДМИНКУ ИЗ SPA-ПЕРЕХОДОВ!
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

// function initPageFunctions(
//   path = window.location.pathname,
//   params = new URLSearchParams(window.location.search),
// ) {
//   if (path === "/" || path === "/index") {
//     initHomeCategories();
//     initPromoProducts();
//     initNewProducts();
//   } else if (path.includes("catalog")) initCatalog(params);
//   else if (path.includes("account")) initAccount();
//   else if (path.includes("contacts")) {
//     setTimeout(() => {
//       if (typeof window.initYandexMap === "function") {
//         window.initYandexMap();
//       }
//     }, 50);
//   }
// }

// Найти в app.js и заменить функцию initPageFunctions() (удалена обработка личного кабинета):
function initPageFunctions(
  path = window.location.pathname,
  params = new URLSearchParams(window.location.search),
) {
  if (path === "/" || path === "/index") {
    initHomeCategories();
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

// async function initNewProducts() {
//   const container = document.getElementById("newProductsContainer");
//   if (!container) return;

//   try {
//     const products = await API.products.getAll();
//     const news = products.filter((p) => p.badge === "new" && p.quantity > 0);

//     if (news.length === 0) {
//       container.innerHTML =
//         '<p style="font-size:11px; opacity:0.5; text-transform:uppercase; font-weight:900; text-align:center; padding:40px;">Новинки скоро появятся</p>';
//       return;
//     }

//     container.innerHTML = news
//       .map((p) => {
//         const hasImg = p.image && p.image.length > 5;
//         const imgHtml = hasImg
//           ? `<img src="${p.image}" alt="${p.name}">`
//           : "📦";

//         let inCartQty = 0;
//         cart.forEach((item) => {
//           try {
//             const itemStr =
//               typeof item === "string" ? item : JSON.stringify(item);
//             const parsed = JSON.parse(itemStr);
//             if (
//               parsed &&
//               typeof parsed === "object" &&
//               String(parsed.id) === String(p.id)
//             ) {
//               inCartQty += parsed.qty;
//             } else if (
//               typeof parsed === "number" &&
//               String(parsed) === String(p.id)
//             ) {
//               inCartQty += 1;
//             }
//           } catch (e) {
//             if (String(item) === String(p.id)) {
//               inCartQty += 1;
//             }
//           }
//         });

//         const imgAction = hasImg
//           ? `onclick="window.openImageModal('${p.image}')"`
//           : "";
//         const outOfStock = (p.quantity || 0) <= 0;

//         return `<div class="product-card" style="${outOfStock ? "filter:grayscale(1);opacity:0.7;" : ""}">
    
//     <div class="product-img ${hasImg ? "has-img" : ""}" ${imgAction}>
//         ${imgHtml}
        
//         <!-- Красивый ярлык: Одинаково работает и для Новинок, и для Хитов -->
//         ${
//           p.badge === "hit" || p.badge === "new"
//             ? `<div class="product-badge ${p.badge === "new" ? "new" : ""}">${p.badge === "hit" ? "🔥 Хит" : "✨ Новинка"}</div>`
//             : ""
//         }
        
//         <!-- Пузырек с корзиной -->
//         ${
//           inCartQty > 0
//             ? `<div style="position:absolute; top:10px; right:10px; background:#10B981; color:white; min-width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; padding:0 6px; ">
//                    ${p.unit === "кг" || p.unit === "м" ? inCartQty.toFixed(1) + " " + p.unit : inCartQty}
//                </div>`
//             : ""
//         }
//     </div>

//     <div class="product-info" style="display:flex; flex-direction:column; height:100%;">
//         <div style="font-size:9px; font-weight:900; text-transform:uppercase; color:var(--dark); opacity:0.4; margin-bottom:6px; letter-spacing:1px;">
//             ${p.category_name || "Без категории"}
//         </div>
        
//         <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; margin-bottom:16px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; min-height:30px; line-height:1.2;">
//             ${p.name}
//         </h3>
        
//         <!-- === ЦЕНА СВЕРХУ, КНОПКИ ВНИЗУ === -->
//         <div style="margin-top:auto;">
            
//             <!-- Запрещаем цене разрываться на новую строку через white-space:nowrap -->
//             <div style="font-size:18px; font-weight:900; color:var(--brand); white-space:nowrap; margin-bottom:10px;">
//                 ${Number(p.price).toLocaleString()} ₽ <span style="font-size:11px; font-weight:700; color:var(--dark); opacity:0.5;">/ ${p.unit || "шт"}</span>
//             </div>
            
//             ${
//               p.unit === "кг" || p.unit === "м"
//                 ? `
//                 <!-- Контроллер ВЕСОВЫХ товаров растянут на ширину карточки -->
//                 <div class="qty-control" style="width:100%; display:flex; gap:6px;">
//                     <div class="qty-control__stepper" style="flex:1;">
//                         <button type="button" class="qty-control__btn" style="flex:1;" onclick="window.changeQtyAndAdd('${p.id}', -0.1)" ${outOfStock ? "disabled" : ""}>−</button>
//                         <input class="qty-control__input" type="number" id="qty-${p.id}" value="0.1" min="0.1" step="0.1" style="flex:1; width:100%; padding:0;" oninput="this.value = Math.max(0.1, parseFloat(this.value) || 0.1).toFixed(1)" ${outOfStock ? "disabled" : ""}>
//                         <button type="button" class="qty-control__btn" style="flex:1;" onclick="window.changeQtyAndAdd('${p.id}', 0.1)" ${outOfStock ? "disabled" : ""}>+</button>
//                     </div>
//                     <!-- Доп кнопка добавления в корзину -->
//                     <button class="qty-control__cart-btn" style="width:40px; height:28px; flex-shrink:0; font-size:13px;" onclick="window.addToCartWithQty('${p.id}')" ${outOfStock ? "disabled" : ""}>
//                         <i class="fas fa-shopping-cart"></i>
//                     </button>
//                 </div>
//             `
//                 : `
//                 <!-- Большая удобная кнопка "В корзину" для ШТУЧНЫХ товаров -->
//                 <button onclick="window.addToCart('${p.id}')" class="qty-control__cart-btn" style="width:100%; height:32px; border-radius:4px; font-size:11px; text-transform:uppercase; font-weight:900;" ${outOfStock ? "disabled" : ""}>
//                     В корзину <i class="fas fa-shopping-cart" style="margin-left:6px;"></i>
//                 </button>
//             `
//             }
//         </div>
//     </div>
// </div>`;
//       })
//       .join("");
//   } catch (err) {
//     console.error("New products error:", err);
//     container.innerHTML =
//       '<p style="font-size:11px; opacity:0.5; text-align:center; padding:40px;">Не удалось загрузить новинки</p>';
//   }
// }

// ===== КАТЕГОРИИ НА ГЛАВНОЙ =====

async function initNewProducts() {
  const container = document.getElementById("newProductsContainer");
  if (!container) return;

  try {
    const products = await API.products.getAll();
    const news = products.filter((p) => p.badge === "new");

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

        return `<div class="product-card">
    <div class="product-img ${hasImg ? "has-img" : ""}" ${imgAction}>
        ${imgHtml}
        <div class="product-badge new">✨ Новинка</div>
    </div>
    <div class="product-info" style="display:flex; flex-direction:column; justify-content:center; padding:16px; height:100%;">
        <!-- Лимит названия увеличен до 4 строк с высотой блока 72px -->
        <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; min-height:72px; line-height:1.3; margin:0;">
            ${p.name}
        </h3>
    </div>
</div>`;
      })
      .join("");
  } catch (err) {
    console.error("New products error:", err);
    container.innerHTML = '<p style="font-size:11px; opacity:0.5; text-align:center; padding:40px;">Не удалось загрузить новинки</p>';
  }
}

async function initHomeCategories() {
  const container = document.getElementById("homeCategories");
  if (!container) return;
  try {
    const cats = await API.categories.getAll();
    const icons = {
      svarka:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c4-1 6-5 6-10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v6c0 5 2 9 6 10z"/><rect x="9" y="8" width="6" height="4" rx="1" stroke="var(--brand)" fill="var(--brand)" fill-opacity="0.2"/></svg>',
      takelazh:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="var(--brand)"/></svg>',
      prokat:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><circle cx="7" cy="16" r="4" stroke="var(--brand)"/><circle cx="17" cy="16" r="4"/></svg>',
      instrument:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
      krepezh:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 16 4 16 8 12 10 8 8 8 4 12 2"/><path d="M10 10v12"/><path d="M14 10v12"/><path d="M10 13h4" stroke="var(--brand)"/><path d="M10 17h4" stroke="var(--brand)"/></svg>',
      abrasives:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" stroke="var(--brand)"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
        abrazivy:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" stroke="var(--brand)"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
        
      specodezhda:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2a8 8 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" stroke="var(--brand)"/></svg>',
      default:
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    };
    container.innerHTML = cats
      .map(
        (c) => `
      <a href="/catalog?category=${c.slug}" class="category-card">
        <div class="category-icon">${icons[c.slug] || icons["default"]}</div>
        <h3 class="category-title">${c.name}</h3>
        <div class="category-footer"><span>${
          c.product_count || 0
        } товаров</span><div class="category-arrow"><i class="fas fa-chevron-right"></i></div></div>
      </a>
    `,
      )
      .join("");
  } catch (err) {
    console.error("Home categories error:", err);
  }
}

// ===== КАТЕГОРИИ И ТОВАРЫ КАТАЛОГА =====
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
      catGrid.innerHTML =
        `<div class="cat-tag-item ${
          currentFilter === "all" ? "active" : ""
        }" data-id="all">Все товары</div>` +
        cats
          .map(
            (c) =>
              `<div class="cat-tag-item ${
                currentFilter == c.slug ? "active" : ""
              }" data-id="${c.slug}">${c.name}</div>`,
          )
          .join("");
      catGrid.querySelectorAll(".cat-tag-item").forEach((item) => {
        item.onclick = () => {
          catGrid
            .querySelectorAll(".cat-tag-item")
            .forEach((i) => i.classList.remove("active"));
          item.classList.add("active");
          currentFilter = item.dataset.id;

          window.history.replaceState(
            {},
            "",
            currentFilter === "all"
              ? "/catalog"
              : `/catalog?category=${currentFilter}`,
          );
          renderProducts();
        };
      });
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
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect)
      sortSelect.onchange = (e) => {
        currentSort = e.target.value;
        renderProducts();
      };
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1; color:red; font-weight:900;">Ошибка сервера при загрузке.</div>`;
  }
}

// function renderProducts() {
//   const grid = document.getElementById("productsGrid");
//   if (!grid) return;

//   let filtered = allProducts.filter((p) => {
//     const normalName = normalizeForSearch(p.name);
//     const normalQuery = normalizeForSearch(currentSearch);
//     // Сначала проверяем соответствие поисковому запросу
//     const matchesSearch = normalName.includes(normalQuery);
//     if (!matchesSearch) return false;

//     // Если фильтр не выбран, выводим все товары
//     if (currentFilter === "all") return true;

//     // Ищем категорию по slug в сохраненном массиве категорий
//     const targetCategory = allCategories.find((c) => c.slug === currentFilter);

//     // Если категория найдена, сравниваем ID товара с ID этой категории
//     return targetCategory ? p.category_id == targetCategory.id : false;
//   });

//   if (currentSort === "price-asc") filtered.sort((a, b) => a.price - b.price);
//   if (currentSort === "price-desc") filtered.sort((a, b) => b.price - a.price);
//   if (currentSort === "name")
//     filtered.sort((a, b) => a.name.localeCompare(b.name));

//   if (filtered.length === 0) {
//     grid.innerHTML =
//       '<div style="grid-column:1/-1;padding:100px 40px;text-align:center;"><h3>Товаров не найдено</h3></div>';
//     return;
//   }

//   grid.innerHTML = filtered
//     .map((p) => {
//       const hasImg = p.image && p.image.length > 5;
//       const imgHtml = hasImg ? `<img src="${p.image}" alt="${p.name}">` : "📦";
//       let inCartQty = 0;
//       cart.forEach((item) => {
//         try {
//           const itemStr =
//             typeof item === "string" ? item : JSON.stringify(item);
//           const parsed = JSON.parse(itemStr);
//           if (
//             parsed &&
//             typeof parsed === "object" &&
//             String(parsed.id) === String(p.id)
//           ) {
//             inCartQty += parsed.qty;
//           } else if (
//             typeof parsed === "number" &&
//             String(parsed) === String(p.id)
//           ) {
//             inCartQty += 1;
//           }
//         } catch (e) {
//           if (String(item) === String(p.id)) {
//             inCartQty += 1;
//           }
//         }
//       });
//       const outOfStock = (p.quantity || 0) <= 0;
//       const imgAction = hasImg
//         ? `onclick="window.openImageModal('${p.image}')"`
//         : "";

//       return `<div class="product-card" style="${outOfStock ? 'filter:grayscale(1);opacity:0.7;' : ''}">
    
//     <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
//         ${imgHtml}
        
//         <!-- Красивый ярлык: Одинаково работает и для Новинок, и для Хитов -->
//         ${p.badge === 'hit' || p.badge === 'new' ? 
//            `<div class="product-badge ${p.badge === 'new' ? 'new' : ''}">${p.badge === 'hit' ? '🔥 Хит' : '✨ Новинка'}</div>` 
//         : ''}
        
//         <!-- Пузырек с корзиной -->
//         ${inCartQty > 0 
//             ? `<div style="position:absolute; top:10px; right:10px; background:#10B981; color:white; min-width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; padding:0 6px; ">
//                    ${p.unit === 'кг' || p.unit === 'м' ? inCartQty.toFixed(1) + ' ' + p.unit : inCartQty}
//                </div>` 
//             : ''}
//     </div>

//     <div class="product-info" style="display:flex; flex-direction:column; height:100%;">
//         <div style="font-size:9px; font-weight:900; text-transform:uppercase; color:var(--dark); opacity:0.4; margin-bottom:6px; letter-spacing:1px;">
//             ${p.category_name || 'Без категории'}
//         </div>
        
//         <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; margin-bottom:16px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; min-height:30px; line-height:1.2;">
//             ${p.name}
//         </h3>
        
//         <!-- === ЦЕНА СВЕРХУ, КНОПКИ ВНИЗУ === -->
//         <div style="margin-top:auto;">
            
//             <!-- Запрещаем цене разрываться на новую строку через white-space:nowrap -->
//             <div style="font-size:18px; font-weight:900; color:var(--brand); white-space:nowrap; margin-bottom:10px;">
//                 ${Number(p.price).toLocaleString()} ₽ <span style="font-size:11px; font-weight:700; color:var(--dark); opacity:0.5;">/ ${p.unit || 'шт'}</span>
//             </div>
            
//             ${(p.unit === 'кг' || p.unit === 'м') 
//             ? `
//                 <!-- Контроллер ВЕСОВЫХ товаров растянут на ширину карточки -->
//                 <div class="qty-control" style="width:100%; display:flex; gap:6px;">
//                     <div class="qty-control__stepper" style="flex:1;">
//                         <button type="button" class="qty-control__btn" style="flex:1;" onclick="window.changeQtyAndAdd('${p.id}', -0.1)" ${outOfStock ? 'disabled' : ''}>−</button>
//                         <input class="qty-control__input" type="number" id="qty-${p.id}" value="0.1" min="0.1" step="0.1" style="flex:1; width:100%; padding:0;" oninput="this.value = Math.max(0.1, parseFloat(this.value) || 0.1).toFixed(1)" ${outOfStock ? 'disabled' : ''}>
//                         <button type="button" class="qty-control__btn" style="flex:1;" onclick="window.changeQtyAndAdd('${p.id}', 0.1)" ${outOfStock ? 'disabled' : ''}>+</button>
//                     </div>
//                     <!-- Доп кнопка добавления в корзину -->
//                     <button class="qty-control__cart-btn" style="width:40px; height:28px; flex-shrink:0; font-size:13px;" onclick="window.addToCartWithQty('${p.id}')" ${outOfStock ? 'disabled' : ''}>
//                         <i class="fas fa-shopping-cart"></i>
//                     </button>
//                 </div>
//             ` 
//             : `
//                 <!-- Большая удобная кнопка "В корзину" для ШТУЧНЫХ товаров -->
//                 <button onclick="window.addToCart('${p.id}')" class="qty-control__cart-btn" style="width:100%; height:32px; border-radius:4px; font-size:11px; text-transform:uppercase; font-weight:900;" ${outOfStock ? 'disabled' : ''}>
//                     В корзину <i class="fas fa-shopping-cart" style="margin-left:6px;"></i>
//                 </button>
//             `}
//         </div>
//     </div>
// </div>`;
//     })
//     .join("");
// }

// ===== ЛИЧНЫЙ КАБИНЕТ =====

// Замените функцию renderProducts() целиком:

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  let filtered = allProducts.filter((p) => {
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

    return `<div class="product-card">
  <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
      ${imgHtml}
      ${p.badge === 'hit' || p.badge === 'new' ? 
         `<div class="product-badge ${p.badge === 'new' ? 'new' : ''}">${p.badge === 'hit' ? '🔥 Хит' : '✨ Новинка'}</div>` 
      : ''}
  </div>
  <div class="product-info" style="display:flex; flex-direction:column; justify-content:center; padding:16px; height:100%;">
      <!-- Лимит названия увеличен до 4 строк с высотой блока 72px -->
      <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; min-height:72px; line-height:1.3; margin:0;">
          ${p.name}
      </h3>
  </div>
</div>`;
  })
  .join("");
}

async function initAccount() {
  const userNameEl = document.getElementById("userName");
  if (!userNameEl) return;
  const data = await API.auth.me();
  if (!data || !data.user) { navigate("/"); return; }
  const user = data.user;

  userNameEl.innerText = user.displayName || user.name || "Пользователь";
  const phoneEl = document.getElementById("userPhone");
  const emailEl = document.getElementById("userEmail");
  
  const companyCheck = document.getElementById('isCompany');
  const companyFields = document.getElementById('companyFields');
  const companyNameEl = document.getElementById('userCompanyName');
  const companyInnEl = document.getElementById('userCompanyInn');
  const companyAddressEl = document.getElementById('userCompanyAddress');

  if (companyCheck) {
    companyCheck.checked = user.is_company == 1;
    companyCheck.onchange = async function() {
        const checkedVal = this.checked ? 1 : 0;
        await API.auth.updateProfile({ is_company: checkedVal });
        if (companyFields) companyFields.style.display = this.checked ? 'block' : 'none';
        
        // Синхронизируем локальное состояние в памяти (исправлено)
        if (currentUser) {
            currentUser.is_company = checkedVal;
            localStorage.setItem("user", JSON.stringify(currentUser));
        }
    };
}

  if (companyFields) {
      companyFields.style.display = user.is_company == 1 ? 'block' : 'none';
  }

  if (companyNameEl) companyNameEl.value = user.company_name || '';
  if (companyInnEl) companyInnEl.value = user.company_inn || '';
  if (companyAddressEl) companyAddressEl.value = user.company_address || '';

  // Умная логика отображения номера телефона
  if (phoneEl) {
    const editPhoneBtn = document.getElementById("editPhoneBtn");
    const editPhoneForm = document.getElementById("editPhoneForm");
    
    if (user.phone && user.phone !== "null" && user.phone.trim() !== "") {
      let p = user.phone.replace(/\D/g, '');
      phoneEl.innerText = `+7 (${p.substring(1, 4)}) ${p.substring(4, 7)}-${p.substring(7, 9)}-${p.substring(9, 11)}`;
      
      // Скрываем кнопку изменения и форму, если номер уже привязан
      if (editPhoneBtn) editPhoneBtn.style.display = "none";
      if (editPhoneForm) editPhoneForm.style.display = "none";
    } else {
      phoneEl.innerText = "Не указан";
      
      if (editPhoneBtn) {
        editPhoneBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Привязать телефон';
        editPhoneBtn.style.display = "inline-flex";
      }
    }
  }

  if (emailEl) emailEl.innerText = user.email || "Не указана";

  const adminLink = document.getElementById("adminLink");
  if (user.isAdmin && adminLink) adminLink.style.display = "block";

  try {
    const orders = await API.orders.getMine();
    window.ordersData = orders;
    document.getElementById("orderCount").innerText = orders.length;
    const ordersList = document.getElementById("ordersList");

    if (orders && orders.length > 0 && ordersList) {
      const statusDict = {
        new: "Новый",
        processing: "В обработке",
        shipped: "Отправлен",
        completed: "Выполнен",
        cancelled: "Отменен",
      };

      ordersList.innerHTML = orders.map((order) => {
          const canCancel = ["new", "processing"].includes(order.status);
          const stName = statusDict[order.status] || order.status;
          const color = order.status === "cancelled" ? "#EF4444" : order.status === "completed" ? "#10B981" : "var(--dark)";
          
          const formattedTotal = Number(order.total).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

          return `<div class="about-list-item" style="border:1px solid var(--dark); padding:16px; margin-bottom:16px; background:white;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; font-size:14px; font-weight:900;">Заказ #${order.id}</h4>
            <span style="font-size:10px; font-weight:900; text-transform:uppercase; color:${color}; background:var(--gray-bg); padding:4px 8px; border-radius:4px;">${stName}</span>
          </div>
          <p style="margin-bottom:16px; font-weight:700; opacity:0.8; font-size:12px;">${new Date(order.created_at).toLocaleDateString()} | ${formattedTotal} ₽</p>
          <div style="display:flex; gap:8px;">
          <button onclick="viewUserOrder(${order.id}, '${order.status}', '${order.created_at}')" class="hero-btn" style="padding:8px; font-size:9px; flex:1; justify-content:center;"><i class="fas fa-eye" style="margin-right:4px;"></i> Инфо</button>
            ${canCancel
              ? `<button onclick="cancelUserOrder(${order.id})" class="hero-btn" style="padding:8px; font-size:9px; flex:1; justify-content:center; background:none; border:1px solid #EF4444; color:#EF4444;"><i class="fas fa-times" style="margin-right:4px;"></i> Отменить</button>`
              : ""
            }
          </div>
        </div>`;
        }).join("");
    } else {
      if (ordersList) ordersList.innerHTML = '<p style="opacity:0.5;">История заказов пуста</p>';
    }
  } catch (e) { console.error(e); }
}

// Функция нормализации текста для защиты от опечаток и перепутанной раскладки (кириллица/латиница)
function normalizeForSearch(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/m/g, 'м')  // латинская 'm' -> русская 'м' (резьба М8, М10)
    .replace(/c/g, 'с')  // латинская 'c' -> русская 'с'
    .replace(/x/g, 'х')  // латинская 'x' -> русская 'х'
    .replace(/a/g, 'а')  // латинская 'a' -> русская 'а'
    .replace(/e/g, 'е')  // латинская 'e' -> русская 'е'
    .replace(/o/g, 'о')  // латинская 'o' -> русская 'о'
    .replace(/p/g, 'р')  // латинская 'p' -> русская 'р'
    .replace(/h/g, 'н')  // латинская 'h' -> русская 'н'
    .replace(/b/g, 'в')  // латинская 'b' -> русская 'в'
    .replace(/t/g, 'т')  // латинская 't' -> русская 'т'
    .replace(/k/g, 'к'); // латинская 'k' -> русская 'к'
}


window.saveCompanyField = async function(field, value) {
    try {
        await API.auth.updateProfile({ [field]: value });
        
        // Синхронизируем локальное состояние в памяти (исправлено)
        if (currentUser) {
            currentUser[field] = value;
            localStorage.setItem("user", JSON.stringify(currentUser));
        }
    } catch (err) {
        console.error('Ошибка сохранения:', err);
    }
};
// Добавить эти функции в свободное место app.js (например, перед разделом Авторизация):

// ===== ФУНКЦИИ ПРИВЯЗКИ ТЕЛЕФОНА В ЛК =====
function toggleEditPhone() {
  const form = document.getElementById("editPhoneForm");
  if (!form) return;
  
  const phoneInput = document.getElementById("newPhoneInput");
  if (phoneInput && !phoneInput.dataset.masked) {
      phoneInput.dataset.masked = "true";
      phoneInput.addEventListener("input", (e) => {
            let val = e.target.value;
            let cleaned = val.replace(/\D/g, "");
            if (!cleaned) {
                phoneInput.value = "";
                return;
            }
            if (cleaned.startsWith("8")) cleaned = "7" + cleaned.substring(1);
            if (!cleaned.startsWith("7")) cleaned = "7" + cleaned;
            let masked = "+7";
            if (cleaned.length > 1) masked += " (" + cleaned.substring(1, 4);
            if (cleaned.length >= 5) masked += ") " + cleaned.substring(4, 7);
            if (cleaned.length >= 8) masked += "-" + cleaned.substring(7, 9);
            if (cleaned.length >= 10) masked += "-" + cleaned.substring(9, 11);
            phoneInput.value = masked.substring(0, 18);
      });
  }

  if (form.style.display === "none") {
    form.style.display = "flex";
    document.getElementById("phoneInputStep").style.display = "flex";
    document.getElementById("phoneCodeStep").style.display = "none";
    phoneInput.value = "";
    phoneInput.focus();
  } else {
    form.style.display = "none";
  }
}

async function sendPhoneVerifyCode() {
  const phoneInput = document.getElementById("newPhoneInput");
  let phone = phoneInput.value.trim().replace(/\D/g, "");
  if (phone.startsWith("8")) phone = "7" + phone.substring(1);
  if (!phone.startsWith("7")) phone = "7" + phone;

  if (phone.length !== 11) {
    alert("Пожалуйста, укажите корректный 11-значный номер телефона");
    return;
  }

  try {
    const res = await API.auth.requestCode(phone);
    document.getElementById("phoneInputStep").style.display = "none";
    document.getElementById("phoneCodeStep").style.display = "flex";
    document.getElementById("phoneVerifyCode").value = "";
    document.getElementById("phoneVerifyCode").focus();
    if (res.code) {
      alert("ТЕСТОВЫЙ РЕЖИМ!\nКод подтверждения: " + res.code);
    }
  } catch (err) {
    alert(err.message || "Ошибка отправки кода подтверждения");
  }
}

async function verifyPhoneCode() {
  const phoneInput = document.getElementById("newPhoneInput");
  let phone = phoneInput.value.trim().replace(/\D/g, "");
  if (phone.startsWith("8")) phone = "7" + phone.substring(1);
  if (!phone.startsWith("7")) phone = "7" + phone;

  const code = document.getElementById("phoneVerifyCode").value.trim();
  if (code.length !== 4) {
    alert("Пожалуйста, введите 4-значный код подтверждения");
    return;
  }

  try {
    await API.auth.updatePhone(phone, code);
    showToast("Номер телефона успешно подтвержден и привязан!");
    document.getElementById("editPhoneForm").style.display = "none";
    
    // Обновляем данные пользователя в сессии и перезагружаем ЛК
    const profileData = await API.auth.me();
    if (profileData && profileData.user) {
        currentUser = profileData.user;
        localStorage.setItem("user", JSON.stringify(currentUser));
    }
    initAccount();
  } catch (err) {
    alert(err.message || "Неверный код или ошибка сохранения");
  }
}

function resetPhoneVerify() {
  document.getElementById("phoneInputStep").style.display = "flex";
  document.getElementById("phoneCodeStep").style.display = "none";
}
// ===== АВТОРИЗАЦИЯ =====
function openAuthModal() {
  document.getElementById("authModal")?.classList.add("open");
}
function closeAuthModal() {
  document.getElementById("authModal")?.classList.remove("open");
}

async function handleAuth() {
  const contactInput = document.getElementById("authContact");
  const contactStep = document.getElementById("authContactStep");
  const codeStep = document.getElementById("authCodeStep");
  const nameStep = document.getElementById("authNameStep");
  const codeInput = document.getElementById("authCode");
  const nameInput = document.getElementById("authName");
  const actionBtn = document.getElementById("authActionBtn");
  const codePreview = document.getElementById("codePreview");
  const consentCheckbox = document.getElementById("pd-consent");

  let contact = contactInput.value.trim();
  if (!contact.includes("@")) contact = contact.replace(/\D/g, "");

  if (!contact) {
    alert("Пожалуйста, введите email или номер телефона");
    return;
  }

  if (authStep === 1) {
    if (consentCheckbox && !consentCheckbox.checked) {
      alert(
        "Для продолжения необходимо дать согласие на обработку персональных данных!",
      );
      return;
    }

    const originalBtnText = actionBtn.innerText;
    actionBtn.innerText = "Отправка...";
    actionBtn.disabled = true;

    try {
      const res = await API.auth.requestCode(contact);

      authCurrentContact = contact;
      authStep = 2;

      if (contactStep) contactStep.style.display = "none";
      if (codeStep) codeStep.style.display = "block";

      if (res.exists === false && nameStep) {
        nameStep.style.display = "block";
      }

      actionBtn.innerText = "Подтвердить код";

      if (res.code) {
        alert("ТЕСТОВЫЙ РЕЖИМ!\nВаш код авторизации: " + res.code);
        //if (codePreview) codePreview.innerText = "Тестовый код: " + res.code;
      }
    } catch (err) {
      alert("Ошибка: " + (err.message || "Не удалось отправить код"));
      actionBtn.innerText = originalBtnText;
    } finally {
      actionBtn.disabled = false;
    }
  } else if (authStep === 2) {
    const code = codeInput.value.trim();
    const name = nameInput ? nameInput.value.trim() : "";

    if (code.length !== 4) {
      alert("Пожалуйста, введите 4-значный код");
      return;
    }

    if (nameStep && nameStep.style.display === "block" && !name) {
      alert("Пожалуйста, укажите ваше имя");
      return;
    }

    const originalBtnText = actionBtn.innerText;
    actionBtn.innerText = "Проверка...";
    actionBtn.disabled = true;

    try {
      const data = await API.auth.verifyCode(authCurrentContact, code, name);

      if (data.user) {
        completeLogin(data.user);
      }
    } catch (err) {
      alert("Ошибка: " + (err.message || "Неверный код"));
      actionBtn.innerText = originalBtnText;
    } finally {
      actionBtn.disabled = false;
    }
  }
}

function completeLogin(user) {
  localStorage.setItem("user", JSON.stringify(user));
  currentUser = user;
  updateUIForLoggedInUser(currentUser);
  closeAuthModal();
  authStep = 1;
  window.location.reload();
}

async function handleLogout() {
  await API.auth.logout();
  localStorage.removeItem("user");
  window.location.href = "/";
}

function updateUIForLoggedInUser(user) {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  if (loginBtn && user) {
    loginBtn.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;background:var(--brand);color:white;">${
      (user.displayName || user.name || "U")[0]
    }</div>`;
    loginBtn.onclick = () => navigate("/account");
  }
  if (logoutBtn && user) logoutBtn.style.display = "flex";
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

async function addToCart(productId) {
  if (allProducts.length === 0) allProducts = await API.products.getAll();
  const p = allProducts.find((item) => String(item.id) === String(productId));

  let currentQty = 0;
  cart.forEach((item) => {
    try {
      const parsed = JSON.parse(item);
      if (String(parsed.id) === String(productId)) {
        currentQty += parsed.qty;
      }
    } catch (e) {
      if (String(item) === String(productId)) {
        currentQty += 1;
      }
    }
  });

  if (p && currentQty >= p.quantity) {
    showToast(`Осталось всего ${p.quantity} ${p.unit || "шт"}.`, "error");
    return;
  }

  cart.push(String(productId));
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();

  if (p) showToast(`Добавлено: ${p.name}`);

  const cartBtn = document.querySelector('[onclick="openCart()"]');
  if (cartBtn) {
    cartBtn.classList.remove("cart-pulse");
    void cartBtn.offsetWidth;
    cartBtn.classList.add("cart-pulse");
  }

  if (window.location.pathname.includes("catalog")) renderProducts();
  if (document.getElementById("promoProductsContainer")) initPromoProducts();
  if (document.getElementById("newProductsContainer")) initNewProducts();
}

// Безопасное изменение штучного количества по знаку минус
async function updateCartQuantity(productId, delta) {
  if (delta > 0) {
    if (allProducts.length === 0) allProducts = await API.products.getAll();
    const p = allProducts.find((item) => String(item.id) === String(productId));
    let currentQty = 0;
    cart.forEach((item) => {
      try {
        const parsed = JSON.parse(item);
        if (
          parsed &&
          typeof parsed === "object" &&
          String(parsed.id) === String(productId)
        ) {
          currentQty += parsed.qty;
        }
      } catch (e) {
        if (String(item) === String(productId)) currentQty += 1;
      }
    });
    if (p && currentQty + delta > p.quantity) {
      alert("Доступно только " + p.quantity + " " + (p.unit || "шт"));
      return;
    }
    cart.push(String(productId));
  } else {
    // Удаляем ровно одну штучную позицию товара, игнорируя JSON-строки весовых товаров
    for (let i = cart.length - 1; i >= 0; i--) {
      const itemStr = String(cart[i]);
      let isMatch = false;
      if (itemStr.startsWith("{")) {
        isMatch = false;
      } else {
        isMatch = itemStr === String(productId);
      }
      if (isMatch) {
        cart.splice(i, 1);
        break;
      }
    }
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
  renderCart();
  if (window.location.pathname.includes("catalog")) renderProducts();
  if (document.getElementById("promoProductsContainer")) initPromoProducts();
  if (document.getElementById("newProductsContainer")) initNewProducts();
}

async function updateCartWeightQty(productId, newQty) {
  newQty = parseFloat(newQty);
  if (isNaN(newQty) || newQty <= 0) {
    cart = cart.filter((item) => {
      try {
        const parsed = JSON.parse(item);
        return String(parsed.id) !== String(productId);
      } catch (e) {
        return String(item) !== String(productId);
      }
    });
  } else {
    cart = cart.filter((item) => {
      try {
        const parsed = JSON.parse(item);
        return String(parsed.id) !== String(productId);
      } catch (e) {
        return String(item) !== String(productId);
      }
    });
    cart.push(JSON.stringify({ id: productId, qty: newQty, unit: null }));
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
  renderCart();
  if (window.location.pathname.includes("catalog")) renderProducts();
  if (document.getElementById("promoProductsContainer")) initPromoProducts();
}

async function openCart() {
  const savedCart = localStorage.getItem("cart");
    if (savedCart) {
        try { cart = JSON.parse(savedCart); } catch (e) { cart = []; }
    }
    document.getElementById("cartModal")?.classList.add("open");

    try {
        const res = await fetch('/api/shops');
        const shops = await res.json();
        const select = document.getElementById('pickupPoint');
        if (select) {
            select.innerHTML = '<option value="">Выберите магазин</option>' +
                shops.map(s => `<option value="${s.id}">${s.address} — ${s.phone} (${s.worktime || ''})</option>`).join('');
        }
    } catch (e) { console.error(e); }

    await renderCart();
}

function closeCart() {
  document.getElementById("cartModal")?.classList.remove("open");
}

function removeFromCart(productId) {
  cart = cart.filter((item) => {
    try {
      const parsed = JSON.parse(item);
      if (parsed && typeof parsed === "object" && parsed.id) {
        return String(parsed.id) !== String(productId);
      }
      return String(item) !== String(productId);
    } catch (e) {
      return String(item) !== String(productId);
    }
  });
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
  renderCart();
  if (window.location.pathname.includes("catalog")) renderProducts();
  if (document.getElementById("promoProductsContainer")) initPromoProducts();
  if (document.getElementById("newProductsContainer")) initNewProducts();
}

async function renderCart() {
  const container = document.getElementById("cartItems");
  const footer = document.getElementById("cartFooter");
  const totalEl = document.getElementById("cartTotal");
  if (!container) return;

  const savedCart = localStorage.getItem("cart");
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
    } catch (e) {
      cart = [];
    }
  }

  if (cart.length === 0) {
    container.innerHTML =
      '<p style="opacity:0.5;text-align:center;padding:40px 0;">Корзина пуста</p>';
    if (footer) footer.style.display = "none";
    return;
  }

  const products = await API.products.getAll();
  const discount =
    currentUser && currentUser.discount ? Number(currentUser.discount) : 0;

  const parsedCart = cart.map((item) => {
    try {
      const itemStr = typeof item === "string" ? item : JSON.stringify(item);
      const parsed = JSON.parse(itemStr);
      if (parsed && typeof parsed === "object" && parsed.id) {
        return {
          id: String(parsed.id),
          qty: parsed.qty || 1,
          unit: parsed.unit || null,
        };
      }
      return { id: String(itemStr), qty: 1, unit: null };
    } catch (e) {
      return { id: String(item), qty: 1, unit: null };
    }
  });

  const grouped = {};
  parsedCart.forEach((item) => {
    const key = item.id;
    if (!grouped[key]) {
      const product = products.find((p) => String(p.id) === key);
      if (!product) return;
      grouped[key] = { ...product, count: 0, totalQty: 0 };
    }
    grouped[key].count++;
    grouped[key].totalQty += item.qty;
  });

  const groupedArray = Object.values(grouped);

  if (groupedArray.length === 0) {
    cart = [];
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartBadge();
    container.innerHTML =
      '<p style="opacity:0.5;text-align:center;padding:40px 0;">Корзина пуста</p>';
    if (footer) footer.style.display = "none";
    return;
  }

  if (footer) footer.style.display = "block";

  let total = 0;
  container.innerHTML = groupedArray
    .map((item) => {
      const isWeight = item.unit === "кг" || item.unit === "м";
      const displayQty = isWeight ? item.totalQty.toFixed(1) : item.count;

      const originalPrice = Number(item.price);
      const discountedPrice =
        discount > 0
          ? Math.round(originalPrice * (1 - discount / 100) * 100) / 100
          : originalPrice;

      const lineTotal = isWeight
        ? discountedPrice * item.totalQty
        : discountedPrice * item.count;
      total += lineTotal;

      const imgHtml =
        item.image && item.image.length > 5
          ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:contain;">`
          : "📦";

      let priceLabel = "";
      if (discount > 0) {
        priceLabel = `<span style="text-decoration: line-through; opacity: 0.5; font-size: 11px; margin-right: 4px;">${originalPrice.toLocaleString()} ₽</span> 
                       <strong>${discountedPrice.toLocaleString()} ₽</strong>`;
      } else {
        priceLabel = `<strong>${originalPrice.toLocaleString()} ₽</strong>`;
      }

      return `<div style="display:flex;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid rgba(0,0,0,0.1);">
    <div style="width:50px;height:50px;background:var(--gray-bg);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:${item.image && item.image.length > 5 ? "16px" : "24px"};">
        ${imgHtml}
    </div>
    <div style="flex:1;">
        <div style="font-weight:700;font-size:12px;">${item.name}</div>
        <div style="color:var(--brand);font-weight:900;">
            ${priceLabel}/${item.unit || "шт"}
        </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
        ${isWeight
          ? `
          <!-- Весовой контроллер для Корзины (0.1 шаг) -->
          <div style="display:flex; align-items:center; border:1px solid var(--dark); background:white;">
              <button type="button" onclick="window.changeCartWeightQty('${item.id}', -0.1)" style="width:24px; height:24px; border:none; background:none; cursor:pointer;">−</button>
              <input type="number" id="cart-qty-${item.id}" value="${displayQty}" min="0.1" step="0.1" onchange="window.updateCartWeightQty('${item.id}', this.value)" style="width:44px; border:none; border-left:1px solid rgba(0,0,0,0.1); border-right:1px solid rgba(0,0,0,0.1); font-size:11px; text-align:center; outline:none; height:24px; padding:0;">
              <button type="button" onclick="window.changeCartWeightQty('${item.id}', 0.1)" style="width:24px; height:24px; border:none; background:none; cursor:pointer;">+</button>
          </div>
          <span style="font-weight:700;font-size:11px;">${item.unit}</span>
          `
          : `
          <!-- Штучный контроллер для Корзины (1 шт шаг) -->
          <div style="display:flex; align-items:center; border:1px solid var(--dark); background:white;">
              <button onclick="window.updateCartQuantity('${item.id}', -1)" style="width:24px; height:24px; border:none; background:none; cursor:pointer;">−</button>
              <div style="width:34px; font-weight:700; font-size:11px; text-align:center; border-left:1px solid rgba(0,0,0,0.1); border-right:1px solid rgba(0,0,0,0.1); line-height:24px; background:#fff;">${displayQty}</div>
              <button onclick="window.updateCartQuantity('${item.id}', 1)" style="width:24px; height:24px; border:none; background:none; cursor:pointer;">+</button>
          </div>
          <span style="font-weight:700;font-size:11px;">${item.unit || "шт"}</span>
          `
        }
    </div>
    <button onclick="window.removeFromCart('${item.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">&times;</button>
</div>`;
    })
    .join("");

  totalEl.textContent = Math.round(total * 100) / 100 + " ₽";
}

// ===== ФУНКЦИЯ ДЛЯ КНОПОК ПЛЮС/МИНУС В КОРЗИНЕ (Для ВЕСОВЫХ) =====
window.changeCartWeightQty = function(productId, delta) {
    const input = document.getElementById(`cart-qty-${productId}`);
    if (!input) return;

    // Парсим текущий вес из инпута
    let currentQty = parseFloat(input.value) || 0.1;
    
    // Рассчитываем новый вес без проблемы лишних нулей (напр., 0.1+0.2 != 0.300000004)
    let newQty = (Math.round(currentQty * 10) + Math.round(delta * 10)) / 10;

    // Минимум - это 0.1. Ниже быть не может!
    if (newQty < 0.1) {
        newQty = 0.1;
    }
    
    // Передаем команду "главному" обработчику, который сам обновит локалсторадж и нарисует корзину
    window.updateCartWeightQty(productId, newQty);
};

async function checkout() {
    const data = await API.auth.me();
    const pickupId = document.getElementById('pickupPoint')?.value;
    
    if (!data || !data.user) {
        alert("Войдите для оформления заказа");
        closeCart();
        openAuthModal();
        return;
    }
    if (cart.length === 0) return;
    
    // Проверка выбора пункта выдачи
    if (!pickupId) {
        alert("Пожалуйста, выберите магазин для самовывоза");
        document.getElementById('pickupPoint')?.focus();
        return;
    }

    const products = await API.products.getAll();

    const grouped = {};
    cart.forEach((item) => {
        let productId = null;
        let qty = 1;

        if (typeof item === 'string' && item.startsWith('{')) {
            try {
                const parsed = JSON.parse(item);
                if (parsed && parsed.id) {
                    productId = String(parsed.id);
                    qty = Number(parsed.qty) || 0.1;
                }
            } catch (e) {}
        } else {
            productId = String(item);
            qty = 1;
        }

        if (!productId) return;

        if (!grouped[productId]) {
            const product = products.find(p => String(p.id) === productId);
            if (!product) return;
            grouped[productId] = { id: product.id, quantity: 0 };
        }
        grouped[productId].quantity += qty;
    });

    const items = Object.values(grouped);
    

    if (items.length === 0) {
        alert("Корзина пуста или товары не найдены");
        return;
    }

    try {
        await API.orders.create({
            items: items.map(it => ({ id: it.id, quantity: it.quantity })),
            pickup_point_id: pickupId
        });
        alert("Заказ оформлен!");
        cart = [];
        localStorage.setItem("cart", "[]");
        updateCartBadge();
        closeCart();
        navigate("/account");
    } catch (err) {
        alert(err.message || "Ошибка при оформлении заказа");
    }
}
// ===== СМЕНА ИМЕНИ В ЛИЧНОМ КАБИНЕТЕ =====
window.toggleEditName = function () {
  const form = document.getElementById("editNameForm");
  const nameSpan = document.getElementById("userName");
  const editBtn = document.getElementById("editNameBtn");
  const input = document.getElementById("newNameInput");

  if (!form) return;

  if (form.style.display === "none") {
    form.style.display = "flex";
    nameSpan.style.display = "none";
    editBtn.style.display = "none";
    input.value = currentUser?.displayName || currentUser?.name || "";
    input.focus();
  } else {
    form.style.display = "none";
    nameSpan.style.display = "block";
    editBtn.style.display = "block";
  }
};


// ===== ПРОСМОТР И ОТМЕНА ЗАКАЗА ПОЛЬЗОВАТЕЛЕМ =====
window.viewUserOrder = async function (orderId, status, date, orderPickupId) {
  document.getElementById("userOrderModal").classList.add("open");
  document.getElementById("modalUserOrderTitle").innerText = "Заказ #" + orderId;
  const list = document.getElementById("userOrderItemsList");

  let trackerHtml = "";
  let htmlContent = "";
  
  if (status === "cancelled") {
    trackerHtml = `<div style="text-align:center; padding:10px; color:#EF4444; font-size:12px; font-weight:900; background:#fef2f2; border:1px solid #fecaca; margin-bottom:16px;">ЗАКАЗ БЫЛ ОТМЕНЕН</div>`;
  } else {
    let fill = 0;
    if (status === "new") fill = 0;
    if (status === "processing") fill = 33;
    if (status === "shipped") fill = 66;
    if (status === "completed") fill = 100;
    const isActive = (lvl) => (fill >= lvl ? "completed" : "");
    trackerHtml = `
      <div class="tracker-wrap">
        <div class="tracker-line"></div>
        <div class="tracker-line-fill" style="width: ${fill}%;"></div>
        <div class="tracker-step ${isActive(0)}"><div class="tracker-dot">&#xf00c;</div><div class="tracker-label">Оформлен</div></div>
        <div class="tracker-step ${isActive(33)}"><div class="tracker-dot">&#xf00c;</div><div class="tracker-label">Сборка</div></div>
        <div class="tracker-step ${isActive(66)}"><div class="tracker-dot">&#xf00c;</div><div class="tracker-label">В пути</div></div>
        <div class="tracker-step ${isActive(100)}"><div class="tracker-dot">&#xf00c;</div><div class="tracker-label">Готов</div></div>
      </div>
    `;
  }

  // Получаем pickup_point_id из глобальных данных
  if (orderPickupId == null && window.ordersData) {
      const order = window.ordersData.find(o => o.id == orderId);
      if (order) orderPickupId = order.pickup_point_id;
  }

  // Пункт выдачи: виден всегда, но редактируется только при статусах 'new' и 'processing'
  const isEditable = (status === 'new' || status === 'processing');
  htmlContent += `
      <div style="margin-bottom:16px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:10px; font-weight:900; text-transform:uppercase; opacity:0.5;">Пункт выдачи:</span>
          <select id="userOrderPickup" onchange="changeUserOrderPickup(${orderId})" 
              ${isEditable ? '' : 'disabled'}
              style="flex:1; padding:8px; border:1px solid var(--dark); font-size:11px; font-weight:700; ${isEditable ? '' : 'background:#f3f4f6; cursor:not-allowed; opacity:0.8;'}">
              <option value="">Загрузка...</option>
          </select>
      </div>
  `;
  
  htmlContent += trackerHtml;  // Добавляем трекер

  list.innerHTML = `<p style="font-size:11px; opacity:0.5; text-align:center;">Анализ чека...</p>`;

  try {
    const items = await API.orders.getItems(orderId);

    let totalScore = 0;
    items.forEach((i) => {
      totalScore += parseFloat(i.quantity) * parseFloat(i.price);
      const safePrice = Number(i.price).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
      htmlContent += `
         <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:8px;">
           <span style="font-weight:700;">${i.product_name || "Скрытая номенклатура"}</span>
           <span>${Number(i.quantity).toFixed(1)} ${i.product_unit || 'шт'} × <span style="color:var(--brand);">${safePrice} ₽</span></span>
         </div>`;
    });

    totalScore = (Math.round(totalScore * 100) / 100);

    if (status !== "cancelled" && items.length > 0) {
      const orderDateStr = new Date(date).toLocaleDateString("ru-RU");
      const encodedData = encodeURIComponent(
        JSON.stringify({
          id: orderId,
          total: totalScore,
          date: orderDateStr,
          items: items,
        }),
      );
      htmlContent += `
         <div style="margin-top:20px; display:flex; justify-content:flex-end; border-top: 2px solid var(--dark); padding-top:16px;">
            <button class="hero-btn" style="background:#10B981; padding: 12px 20px; font-size:9px;" onclick="printB2BInvoice('${encodedData}')">
               <i class="fas fa-file-invoice" style="margin-right:8px; font-size:12px;"></i> Распечатать счет
            </button>
         </div>`;
    }

    // 1. СНАЧАЛА вставляем сгенерированный HTML в DOM, чтобы селект появился на странице
    list.innerHTML = htmlContent;

    // 2. ТЕПЕРЬ ищем селект в DOM и заполняем его списком магазинов (работает всегда)
    try {
      const shopsRes = await fetch('/api/shops');
      const shops = await shopsRes.json();
      const pickupSelect = document.getElementById('userOrderPickup');
      if (pickupSelect) {
          pickupSelect.innerHTML = '<option value="">Не выбран</option>' +
              shops.map(s => `<option value="${s.id}" ${s.id == orderPickupId ? 'selected' : ''}>${s.address}</option>`).join('');
      }
    } catch (e) {
        console.error("Ошибка загрузки магазинов:", e);
    }
  } catch (e) {
    list.innerHTML = '<p style="font-size:11px; color:#EF4444;">Ошибка базы</p>';
  }
};
window.changeUserOrderPickup = async function(orderId) {
    const pickupId = document.getElementById('userOrderPickup')?.value;
    if (!pickupId) return;
    try {
        await fetch(`/api/orders/${orderId}/pickup`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pickup_point_id: pickupId })
        });
        showToast('Пункт выдачи изменён');
    } catch (err) {
        alert('Ошибка при изменении пункта выдачи');
    }
};
function numberToWordsRu(num) {
  let number = parseFloat(num).toFixed(2).split(".");
  let rubles = parseInt(number[0]);
  let kopecks = number[1];

  if (rubles === 0) return `Ноль рублей ${kopecks} копеек`;

  const units = [
    "",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
  ];
  const unitsFem = [
    "",
    "одна",
    "две",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
  ];
  const tens = [
    "",
    "десять",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
  ];
  const hundreds = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьдесят",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
  ];

  function getWordStr(val, type) {
    if (val === 0) return "";
    let str = "";
    let h = Math.floor(val / 100);
    let t = val % 100;
    let u = t % 10;

    str += hundreds[h] + " ";
    if (t >= 10 && t <= 19) str += units[t] + " ";
    else {
      str += tens[Math.floor(t / 10)] + " ";
      str += (type === "тысячи" ? unitsFem[u] : units[u]) + " ";
    }
    return str.trim();
  }

  function pluralize(val, forms) {
    let t = Math.abs(val) % 100;
    let u = t % 10;
    if (t >= 11 && t <= 19) return forms[2];
    if (u === 1) return forms[0];
    if (u >= 2 && u <= 4) return forms[1];
    return forms[2];
  }

  let result = "";
  let thousands = Math.floor(rubles / 1000) % 1000;
  let millions = Math.floor(rubles / 1000000) % 1000;
  let rem = rubles % 1000;

  if (millions > 0)
    result +=
      getWordStr(millions, "миллионы") +
      " " +
      pluralize(millions, ["миллион", "миллиона", "миллионов"]) +
      " ";
  if (thousands > 0)
    result +=
      getWordStr(thousands, "тысячи") +
      " " +
      pluralize(thousands, ["тысяча", "тысячи", "тысяч"]) +
      " ";
  if (rem > 0) result += getWordStr(rem, "единицы") + " ";

  let resultStr =
    result.trim() + " " + pluralize(rubles, ["рубль", "рубля", "рублей"]);
  resultStr = resultStr.charAt(0).toUpperCase() + resultStr.slice(1);

  return `${resultStr} ${kopecks} копеек`;
}

window.printB2BInvoice = function (encodedData) {
  const data = JSON.parse(decodeURIComponent(encodedData));
  const buyerName = currentUser?.is_company 
    ? `${currentUser.company_name || 'Компания'}, ИНН ${currentUser.company_inn || 'не указан'}, ${currentUser.company_address || ''}`
    : (currentUser?.name || currentUser?.displayName || 'Частное лицо / Контрагент');

  let tbodyHtml = "";
  data.items.forEach((item, index) => {
    const sum = (item.quantity * item.price).toFixed(2);
    tbodyHtml += `
    <tr>
      <td style="border: 1px solid #000; padding: 6px; text-align:center;">${index + 1}</td>
      <td style="border: 1px solid #000; padding: 6px;">${item.product_name || "Удаленный товар"}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align:center;">${Number(item.quantity).toFixed(1)}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align:center;">${item.product_unit || 'шт'}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align:right;">${Number(item.price).toFixed(2)}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align:right;">${sum}</td>
    </tr>`;
  });

  const totalNum = parseFloat(data.total).toFixed(2);
  const ndsSum = ((parseFloat(totalNum) * 20) / 120).toFixed(2);
  const amountWords = numberToWordsRu(totalNum);
  const itemsCount = data.items.length;

  // === ГЕНЕРАЦИЯ СТРОКИ СТАНДАРТА ГОСТ Р 56042-2014 ===
  const gostString = `ST00012|Name=ИП Варгич Вадим Леонидович|PersonalAcc=40802810211000000000|BankName=ФИЛИАЛ "ЦЕНТРАЛЬНЫЙ" ПАО БАНК|BIC=040000000|CorrespAcc=30101810100000000000|PayeeINN=343608258210|Purpose=Оплата заказа N ${data.id}|Sum=${Math.round(totalNum * 100)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(gostString)}`;

  const printHtml = `
  <!DOCTYPE html>
  <html lang="ru">
    <head>
      <title>Счет на оплату №${data.id}</title>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Arial', sans-serif; font-size: 13px; color: #000; margin: 40px auto; max-width: 800px; line-height: 1.4; }
        
        .bank-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px; }
        .bank-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
        .bank-label { font-size: 10px; padding-top: 15px; }
        .no-border-bot { border-bottom: 0 !important; }
        .no-border-top { border-top: 0 !important; }

        .title-text { font-size: 20px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
        .party-info { display: grid; grid-template-columns: 120px 1fr; gap: 8px; margin-bottom: 25px; align-items: start;}
        
        .items-table { width: 100%; border-collapse: collapse; font-size: 13px; border: 2px solid #000; margin-bottom: 10px;}
        .items-table th { border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; }

        .sum-table { margin-left: auto; width: 350px; text-align: right; margin-bottom: 20px;}
        .sum-table td { padding: 4px 8px; font-weight: bold; }
        
        .amount-words-text { font-size: 13px; font-weight: bold; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 10px;}
        
        .sign-block { display: flex; align-items: flex-end; margin-bottom: 30px;}
        .sign-title { font-weight: bold; width: 140px; }
        .sign-line { border-bottom: 1px solid #000; width: 180px; margin: 0 10px; position: relative;}
        .sign-name { border-bottom: 1px solid #000; width: 220px; display: inline-block; position: relative;}
        .sign-text-sub { position: absolute; top: 100%; left: 0; width: 100%; text-align: center; font-size: 9px; font-weight: normal; margin-top: 2px;}
      </style>
    </head>
    <body onload="window.print();">

      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
          <table class="bank-table" style="flex: 1; margin-right: 20px; margin-bottom: 0;">
            <tr>
              <td colspan="2" rowspan="2" style="width: 55%;">
                ФИЛИАЛ "ЦЕНТРАЛЬНЫЙ" ПАО БАНК<br/>
                <div class="bank-label">Банк получателя</div>
              </td>
              <td style="width: 10%;">БИК</td>
              <td class="no-border-bot" style="width: 35%;">040000000</td>
            </tr>
            <tr>
              <td>Сч. №</td>
              <td class="no-border-top">30101810100000000000</td>
            </tr>
            <tr>
              <td style="width: 25%;">ИНН 343608258210</td>
              <td style="width: 30%;">КПП 343434</td>
              <td rowspan="2" style="vertical-align: middle;">Сч. №</td>
              <td rowspan="2" style="vertical-align: middle;">40802810211000000000</td>
            </tr>
            <tr>
              <td colspan="2">
                ИП Варгич Вадим Леонидович<br/>
                <div class="bank-label">Получатель</div>
              </td>
            </tr>
          </table>
          
          <!-- Блок рендеринга QR-кода -->
          <div style="text-align: center; border: 0px solid #000; padding: 10px; width: 150px; flex-shrink: 0;">
              <img src="${qrCodeUrl}" style="width: 110px; height: 110px; display: block; margin: 0 auto 6px;" alt="QR-код для оплаты">
              
          </div>
      </div>

      <div class="title-text">
          Счет на оплату № ${data.id} от ${data.date}
      </div>

      <div class="party-info">
          <span>Поставщик<br/>(Исполнитель):</span>
          <strong>ИП Варгич В.Л., ИНН 343608258210, 403893, Волгоградская обл, г. Камышин, 2-й железнодорожный переезд, корпус 1.</strong>
          
          <span>Покупатель<br/>(Заказчик):</span>
          <strong>${buyerName}</strong>
      </div>

      <table class="items-table">
        <tr>
          <th style="width:40px;">№</th>
          <th>Наименование работ, услуг</th>
          <th style="width:60px;">Кол-во</th>
          <th style="width:50px;">Ед.</th>
          <th style="width:100px;">Цена</th>
          <th style="width:100px;">Сумма</th>
        </tr>
        ${tbodyHtml}
      </table>

      <table class="sum-table">
        <tr>
          <td>Итого:</td>
          <td style="width:100px; border:none;">${totalNum}</td>
        </tr>
        <tr>
          <td>В том числе НДС (20%):</td>
          <td>${ndsSum}</td>
        </tr>
        <tr>
          <td>Всего к оплате:</td>
          <td>${totalNum}</td>
        </tr>
      </table>

      <div style="font-size: 13px;">Всего наименований ${itemsCount}, на сумму ${totalNum} руб.</div>
      <div class="amount-words-text">${amountWords}</div>

      <div class="sign-block">
          <div class="sign-title">Руководитель</div>
          <div class="sign-line"></div>
          <div class="sign-name"></div>
      </div>
      
      <div class="sign-block" style="margin-top:40px;">
          <div class="sign-title">Бухгалтер</div>
          <div class="sign-line"></div>
          <div class="sign-name"></div>
      </div>

    </body>
  </html>
`;

  const win = window.open("", "_blank");
  win.document.write(printHtml);
  win.document.close();
};

window.closeUserOrderModal = function () {
  document.getElementById("userOrderModal").classList.remove("open");
};

window.cancelUserOrder = async function (orderId) {
  if (!confirm("Вы уверены, что хотите отменить этот заказ?")) return;

  try {
    await API.orders.updateStatus(orderId, "cancelled");
    alert("Заказ успешно отменен!");
    initAccount();
  } catch (e) {
    alert(e.message || "Ошибка при отмене заказа");
  }
};

window.saveNewName = async function () {
  const input = document.getElementById("newNameInput");
  const newName = input.value.trim();
  if (!newName) return alert("Имя не может быть пустым!");

  try {
    await API.auth.updateProfile({ name: newName });
    if (currentUser) {
      currentUser.displayName = newName;
      currentUser.name = newName;
      localStorage.setItem("user", JSON.stringify(currentUser));
    }
    document.getElementById("userName").innerText = newName;
    toggleEditName();
    updateUIForLoggedInUser(currentUser);
  } catch (err) {
    alert(err.message || "Ошибка при сохранении имени");
  }
};

window.toggleEditEmail = function () {
  const form = document.getElementById("editEmailForm");
  const emailSpan = document.getElementById("userEmail");
  const editBtn = document.getElementById("editEmailBtn");
  const input = document.getElementById("newEmailInput");

  if (!form) return;

  if (form.style.display === "none") {
    form.style.display = "flex";
    emailSpan.style.display = "none";
    editBtn.style.display = "none";
    input.value = currentUser?.email || "";
    input.focus();
  } else {
    form.style.display = "none";
    emailSpan.style.display = "block";
    editBtn.style.display = "block";
  }
};

window.saveNewEmail = async function () {
  const input = document.getElementById("newEmailInput");
  const newEmail = input.value.trim();
  if (!newEmail || !newEmail.includes("@"))
    return alert("Введите корректный адрес электронной почты!");

  try {
    await API.auth.updateProfile({ email: newEmail });
    if (currentUser) {
      currentUser.email = newEmail;
      localStorage.setItem("user", JSON.stringify(currentUser));
    }
    document.getElementById("userEmail").innerText = newEmail;
    toggleEditEmail();
    alert("Почта успешно сохранена!");
  } catch (err) {
    alert(err.message || "Ошибка при сохранении Email");
  }
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

// ===== РОСКОМНАДЗОР (152-ФЗ) =====
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

  const authStep1 = document.getElementById("authContactStep");
  if (authStep1 && !document.getElementById("pd-consent-wrap")) {
    authStep1.insertAdjacentHTML(
      "beforeend",
      `
      <div id="pd-consent-wrap" style="display:flex; gap:8px; align-items:flex-start; margin-bottom: 1rem; text-align: left;">
        <input type="checkbox" id="pd-consent" style="margin-top: 2px; cursor: pointer;">
        <label for="pd-consent" style="font-size: 9px; opacity: 0.6; line-height: 1.4; cursor: pointer;">
          Я даю согласие на обработку моих персональных данных согласно <a href="/policy" style="color:var(--brand)">Политике</a> и принимаю <a href="/terms" style="color:var(--brand)">Условия соглашения</a>.
        </label>
      </div>
    `,
    );
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

function ensureModalsExist() {
  if (!document.getElementById("cartModal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="cartModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 600px;">
          <button onclick="closeCart()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
          <div style="margin-bottom:2rem;">
            <div style="width:48px;height:48px;background:var(--brand);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;">
              <i class="fas fa-shopping-cart" style="color:white;"></i>
            </div>
            <h2 style="font-size:1.5rem;font-weight:900;text-transform:uppercase;">Ваша корзина</h2>
          </div>
          <div id="cartItems" style="max-height: 400px; overflow-y: auto; margin-bottom: 2rem;">
            <p style="opacity: 0.5; text-align: center; padding: 40px 0;">Корзина пуста</p>
          </div>
          <div id="cartFooter" style="display:none; border-top: 2px solid var(--dark); padding-top: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
              <span style="font-size: 10px; font-weight: 900; text-transform: uppercase;">Итого к оплате:</span>
              <span id="cartTotal" style="font-size: 24px; font-weight: 900; color: var(--brand);">0 ₽</span>
            </div>
            <div id="pickupSelect" style="margin-bottom: 20px;">
    <label style="font-size: 10px; font-weight: 900; text-transform: uppercase; margin-bottom: 8px; display: block;">Пункт самовывоза</label>
    <select id="pickupPoint" style="width:100%; padding:12px; border:1px solid var(--dark); font-weight:700; font-size: 11px;">
        <option value="">Выберите магазин</option>
    </select>
</div>
            <button onclick="checkout()" style="width:100%;padding:1rem;background:var(--dark);color:white;border:none;font-weight:900;text-transform:uppercase;cursor:pointer;">Оформить заказ</button>
          </div>
        </div>
      </div>
    `,
    );
  }

  if (!document.getElementById("authModal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="authModal" class="modal-overlay">
        <div class="modal-content">
          <button onclick="closeAuthModal()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
          <div id="authStep1">
            <div style="margin-bottom:2rem;">
              <div style="width:48px;height:48px;background:var(--brand);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;">
                <i class="fas fa-user-lock" style="color:white;"></i>
              </div>
              <h2 style="font-size:1.5rem;font-weight:900;text-transform:uppercase;">Вход / Регистрация</h2>
            </div>
            <div style="margin-bottom:1.5rem;">
              <div id="authContactStep">
                <div style="position:relative; margin-bottom:1rem;">
                   <input type="text" id="authContact" placeholder="EMAIL ИЛИ ТЕЛЕФОН" style="width:100%;padding:1rem;border:2px solid var(--dark);font-weight:700;outline:none;" />
                   <div id="input-type-icon" style="position:absolute; right:15px; top:15px; opacity:0.3; font-size:12px;"></div>
                </div>
              </div>
              <div id="authCodeStep" style="display:none; margin-bottom:1rem;">
                <input type="text" id="authCode" placeholder="КОД ИЗ СМС / ПОЧТЫ" maxlength="4" style="width:100%;padding:1rem;border:2px solid var(--dark);font-weight:700;outline:none;text-align:center;letter-spacing:10px;font-size:20px;" />
                <div id="codePreview" style="font-size:10px; opacity:0.5; margin-top:5px; text-align:center;"></div>
                <div style="text-align:center; margin-top:10px;">
                  <button id="resendCodeBtn" onclick="resendAuthCode()" style="background:none;border:none;color:var(--brand);font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;opacity:1;transition:0.3s;">Отправить повторно</button>
                  <span id="resendTimer" style="font-size:10px; font-weight:900; opacity:0.5; display:none; margin-left:8px;">(60 сек)</span>
                </div>
              </div>
              <div id="authNameStep" style="display:none; margin-bottom:1rem;">
                <p style="font-size:10px; font-weight:900; margin-bottom:10px; opacity:0.5; text-align:center;">ВЫ У НАС ВПЕРВЫЕ! КАК ВАС ЗОВУТ?</p>
                <input type="text" id="authName" placeholder="ВАШЕ ИМЯ" style="width:100%;padding:1rem;border:2px solid var(--dark);font-weight:700;outline:none;text-align:center;" />
              </div>
            </div>
            <button id="authActionBtn" onclick="handleAuth()" style="width:100%;padding:1rem;background:var(--dark);color:white;border:none;font-weight:900;text-transform:uppercase;cursor:pointer;">Получить код</button>
          </div>
          <div id="authStep2" style="display:none;">
            <h2 style="font-size:1.5rem;font-weight:900;text-transform:uppercase;margin-bottom:1.5rem;">Добро пожаловать</h2>
            <p>Вы успешно вошли в систему.</p>
            <button onclick="closeAuthModal()" style="width:100%;padding:1rem;background:var(--brand);color:white;border:none;font-weight:900;text-transform:uppercase;cursor:pointer;margin-top:1rem;">Продолжить</button>
          </div>
        </div>
      </div>
    `,
    );
    if (typeof initAuthMasking === "function") initAuthMasking();
  } else {
    const authCodeStep = document.getElementById("authCodeStep");
    if (authCodeStep && !document.getElementById("resendCodeBtn")) {
      authCodeStep.insertAdjacentHTML(
        "beforeend",
        `
        <div style="text-align:center; margin-top:10px;">
          <button id="resendCodeBtn" onclick="resendAuthCode()" style="background:none;border:none;color:var(--brand);font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;opacity:1;transition:0.3s;">Отправить повторно</button>
          <span id="resendTimer" style="font-size:10px; font-weight:900; opacity:0.5; display:none; margin-left:8px;">(60 сек)</span>
        </div>
      `,
      );
    }
  }
}

window.resendAuthCode = async function () {
  const btn = document.getElementById("resendCodeBtn");
  if (btn && btn.disabled) return;

  authStep = 1;
  document.getElementById("authCode").value = "";

  await handleAuth();

  startResendTimer(60);
};

function startResendTimer(seconds) {
  const btn = document.getElementById("resendCodeBtn");
  const timerSpan = document.getElementById("resendTimer");
  if (!btn || !timerSpan) return;

  btn.disabled = true;
  btn.style.opacity = "0.3";
  timerSpan.style.display = "inline";

  let left = seconds;
  timerSpan.innerText = `(${left} сек)`;

  const intv = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(intv);
      btn.disabled = false;
      btn.style.opacity = "1";
      timerSpan.style.display = "none";
    } else {
      timerSpan.innerText = `(${left} сек)`;
    }
  }, 1000);
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

async function addToCartWithQty(productId) {
  const qtyInput = document.getElementById("qty-" + productId);
  if (!qtyInput) return;

  let qty = parseFloat(qtyInput.value);
  if (isNaN(qty) || qty <= 0) {
    alert("Введите корректное количество");
    return;
  }

  qty = Math.round(qty * 10) / 10;

  if (allProducts.length === 0) allProducts = await API.products.getAll();
  const p = allProducts.find((item) => String(item.id) === String(productId));

  if (!p) return;
  if (qty > p.quantity) {
    alert("Доступно только " + p.quantity + " " + (p.unit || "шт"));
    return;
  }

  const cartItem = { id: productId, qty: qty, unit: p.unit || "шт" };
  cart.push(JSON.stringify(cartItem));

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
  if (p) showToast(`Добавлено: ${p.name} (${qty} ${p.unit || "шт"})`);
  if (window.location.pathname.includes("catalog")) renderProducts();
  if (document.getElementById("promoProductsContainer")) initPromoProducts();
}

// async function initPromoProducts() {
//   const container = document.getElementById("promoProductsContainer");
//   if (!container) return;

//   try {
//     const products = await API.products.getAll();
//     const hits = products.filter((p) => p.badge === "hit" && p.quantity > 0);

//     if (hits.length === 0) {
//       container.innerHTML =
//         '<p style="font-size:11px; opacity:0.5; text-transform:uppercase; font-weight:900; text-align:center; padding:40px;">Хиты продаж скоро появятся</p>';
//       return;
//     }

//     container.innerHTML = hits
//       .map((p) => {
//         const hasImg = p.image && p.image.length > 5;
//         const imgHtml = hasImg
//           ? `<img src="${p.image}" alt="${p.name}">`
//           : "📦";

//         let inCartQty = 0;
//         cart.forEach((item) => {
//           try {
//             const parsed = JSON.parse(item);
//             if (
//               parsed &&
//               typeof parsed === "object" &&
//               String(parsed.id) === String(p.id)
//             ) {
//               inCartQty += parsed.qty;
//             } else if (
//               typeof parsed === "number" &&
//               String(parsed) === String(p.id)
//             ) {
//               inCartQty += 1;
//             }
//           } catch (e) {
//             if (String(item) === String(p.id)) {
//               inCartQty += 1;
//             }
//           }
//         });

//         const imgAction = hasImg
//           ? `onclick="window.openImageModal('${p.image}')"`
//           : "";
//         const outOfStock = (p.quantity || 0) <= 0;

//         return `<div class="product-card" style="${outOfStock ? 'filter:grayscale(1);opacity:0.7;' : ''}">
    
//     <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
//         ${imgHtml}
        
//         <!-- Красивый ярлык: Одинаково работает и для Новинок, и для Хитов -->
//         ${p.badge === 'hit' || p.badge === 'new' ? 
//            `<div class="product-badge ${p.badge === 'new' ? 'new' : ''}">${p.badge === 'hit' ? '🔥 Хит' : '✨ Новинка'}</div>` 
//         : ''}
        
//         <!-- Пузырек с корзиной -->
//         ${inCartQty > 0 
//             ? `<div style="position:absolute; top:10px; right:10px; background:#10B981; color:white; min-width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; padding:0 6px; ">
//                    ${p.unit === 'кг' || p.unit === 'м' ? inCartQty.toFixed(1) + ' ' + p.unit : inCartQty}
//                </div>` 
//             : ''}
//     </div>

//     <div class="product-info" style="display:flex; flex-direction:column; height:100%;">
//         <div style="font-size:9px; font-weight:900; text-transform:uppercase; color:var(--dark); opacity:0.4; margin-bottom:6px; letter-spacing:1px;">
//             ${p.category_name || 'Без категории'}
//         </div>
        
//         <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; margin-bottom:16px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; min-height:30px; line-height:1.2;">
//             ${p.name}
//         </h3>
        
//         <!-- === ЦЕНА СВЕРХУ, КНОПКИ ВНИЗУ === -->
//         <div style="margin-top:auto;">
            
//             <!-- Запрещаем цене разрываться на новую строку через white-space:nowrap -->
//             <div style="font-size:18px; font-weight:900; color:var(--brand); white-space:nowrap; margin-bottom:10px;">
//                 ${Number(p.price).toLocaleString()} ₽ <span style="font-size:11px; font-weight:700; color:var(--dark); opacity:0.5;">/ ${p.unit || 'шт'}</span>
//             </div>
            
//             ${(p.unit === 'кг' || p.unit === 'м') 
//             ? `
//                 <!-- Контроллер ВЕСОВЫХ товаров растянут на ширину карточки -->
//                 <div class="qty-control" style="width:100%; display:flex; gap:6px;">
//                     <div class="qty-control__stepper" style="flex:1;">
//                         <button type="button" class="qty-control__btn" style="flex:1;" onclick="window.changeQtyAndAdd('${p.id}', -0.1)" ${outOfStock ? 'disabled' : ''}>−</button>
//                         <input class="qty-control__input" type="number" id="qty-${p.id}" value="0.1" min="0.1" step="0.1" style="flex:1; width:100%; padding:0;" oninput="this.value = Math.max(0.1, parseFloat(this.value) || 0.1).toFixed(1)" ${outOfStock ? 'disabled' : ''}>
//                         <button type="button" class="qty-control__btn" style="flex:1;" onclick="window.changeQtyAndAdd('${p.id}', 0.1)" ${outOfStock ? 'disabled' : ''}>+</button>
//                     </div>
//                     <!-- Доп кнопка добавления в корзину -->
//                     <button class="qty-control__cart-btn" style="width:40px; height:28px; flex-shrink:0; font-size:13px;" onclick="window.addToCartWithQty('${p.id}')" ${outOfStock ? 'disabled' : ''}>
//                         <i class="fas fa-shopping-cart"></i>
//                     </button>
//                 </div>
//             ` 
//             : `
//                 <!-- Большая удобная кнопка "В корзину" для ШТУЧНЫХ товаров -->
//                 <button onclick="window.addToCart('${p.id}')" class="qty-control__cart-btn" style="width:100%; height:32px; border-radius:4px; font-size:11px; text-transform:uppercase; font-weight:900;" ${outOfStock ? 'disabled' : ''}>
//                     В корзину <i class="fas fa-shopping-cart" style="margin-left:6px;"></i>
//                 </button>
//             `}
//         </div>
//     </div>
// </div>`;
//       })
//       .join("");
//   } catch (err) {
//     console.error("Promo products error:", err);
//     container.innerHTML =
//       '<p style="font-size:11px; opacity:0.5; text-align:center; padding:40px;">Не удалось загрузить рекомендации</p>';
//   }
// }

// Замените функцию initPromoProducts() целиком:

async function initPromoProducts() {
  const container = document.getElementById("promoProductsContainer");
  if (!container) return;

  try {
    const products = await API.products.getAll();
    const hits = products.filter((p) => p.badge === "hit");

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

        return `<div class="product-card" style="height:100%;">
    <div class="product-img ${hasImg ? 'has-img' : ''}" ${imgAction}>
        ${imgHtml}
        <div class="product-badge">Хит</div>
    </div>
    <div class="product-info" style="display:flex; flex-direction:column; justify-content:center; padding:16px; height:100%;">
        <!-- Название расширено до 3 строк (line-clamp: 3) -->
        <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; min-height:48px; line-height:1.2; margin:0;">
            ${p.name}
        </h3>
    </div>
</div>`;
      })
      .join("");
  } catch (err) {
    console.error("Promo products error:", err);
    container.innerHTML = '<p style="font-size:11px; opacity:0.5; text-align:center; padding:40px;">Не удалось загрузить рекомендации</p>';
  }
}

window.changeQtyAndAdd = function(productId, delta) {
  const input = document.getElementById(`qty-${productId}`);
  if (!input) return;

  // Берем текущее значение инпута, переводим в число (или ставим 0.1 если там пусто)
  let currentValue = parseFloat(input.value);
  if (isNaN(currentValue)) {
      currentValue = 0.1;
  }
  
  // Математика JavaScript (0.1 + 0.1 иногда дает 0.200000001, решаем это умножением на 10)
  let newValue = (Math.round(currentValue * 10) + Math.round(delta * 10)) / 10;
  
  // Нельзя уходить в минус или ноль, минимум 0.1
  if (newValue < 0.1) {
    newValue = 0.1;
  }
  
  // Вписываем новое число обратно в инпут
  input.value = newValue.toFixed(1);
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
window.printB2BInvoice = printB2BInvoice;
window.addToCartWithQty = addToCartWithQty;
window.updateCartWeightQty = updateCartWeightQty;
window.changeQtyAndAdd = changeQtyAndAdd;
window.changeCartWeightQty = changeCartWeightQty;
window.toggleEditPhone = toggleEditPhone;
window.sendPhoneVerifyCode = sendPhoneVerifyCode;
window.verifyPhoneCode = verifyPhoneCode;
window.resetPhoneVerify = resetPhoneVerify;
document.addEventListener("DOMContentLoaded", bootstrap);
