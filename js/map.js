// map.js — КАРТА С ЕДИНОЙ УНИВЕРСАЛЬНОЙ КНОПКОЙ «ПОСТРОИТЬ МАРШРУТ»

let mapInstance = null;
let isMapReady = false;
let fetchedShops = [];

let currentModalShopImages = [];
let currentModalImageIndex = 0;

// Глобальная функция автоматического вызова системного навигатора
window.openUniversalRoute = function(lat, lng, address) {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isAndroid) {
    // Стандарт geo: на Android вызывает окно выбора (Яндекс.Карты, 2ГИС, Google Maps)
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(address || 'Магазин')})`;
  } else if (isIOS) {
    // На iOS универсальная ссылка с rtext открывает Яндекс.Карты или браузер
    window.location.href = `https://yandex.ru/maps/?rtext=~${lat}%2C${lng}&rtt=auto`;
  } else {
    // На ПК открываем веб-карту в новой вкладке
    window.open(`https://yandex.ru/maps/?rtext=~${lat}%2C${lng}&rtt=auto`, '_blank');
  }
};

// Парсер координат
function parseCoords(coords) {
  if (!coords) return null;
  if (Array.isArray(coords) && coords.length === 2) return coords.map(Number);
  try {
    const parsed = JSON.parse(coords);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed.map(Number);
  } catch (e) {}
  if (typeof coords === 'string') {
    const parts = coords.replace(/[\[\]]/g, '').split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
    if (parts.length === 2) return parts;
  }
  return null;
}

// Парсер фото
function parseImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  if (typeof images === 'string') {
    return images.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Загрузка магазинов с сервера
async function loadShopsFromServer() {
  try {
    const res = await fetch('/api/shops');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        fetchedShops = data.map(s => {
          const coords = parseCoords(s.coords) || [50.10007, 45.40316];
          return {
            id: s.id,
            name: s.name || 'Склад / Магазин',
            address: s.address,
            city: s.city || 'Камышин',
            phone: s.phone,
            worktime: s.worktime,
            route: s.route,
            coordinates: coords,
            images: parseImages(s.images)
          };
        });
        return fetchedShops;
      }
    }
  } catch (err) {
    console.warn("Ошибка загрузки магазинов с сервера:", err);
  }
  return [];
}

// Рендеринг списка магазинов
async function renderShopsListInstant() {
  const shopsContainer = document.getElementById("shops");
  if (!shopsContainer) return;

  if (fetchedShops.length === 0) {
    await loadShopsFromServer();
  }

  shopsContainer.innerHTML = "";
  shopsContainer.style.background = "#FFFFFF";

  if (fetchedShops.length === 0) {
    shopsContainer.innerHTML = `<div style="padding:24px; text-align:center; color:#94A3B8; font-size:13px;">Магазины не найдены</div>`;
    return;
  }

  fetchedShops.forEach((shop) => {
    const item = document.createElement("div");
    item.className = "shop-list-item-industrial";
    item.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #F1F5F9;
      cursor: pointer;
      transition: all 0.2s ease;
      background: transparent;
      color: #0F172A;
    `;

    const hasPhotos = shop.images && shop.images.length > 0;
    const photoBadge = hasPhotos 
      ? `<span style="font-size:10px; background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:4px; font-weight:700;"><i class="fas fa-camera" style="margin-right:4px;"></i> ${shop.images.length} фото</span>`
      : '';

    item.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:var(--brand); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:1.5px;">${shop.name}</span>
          <span style="font-size:11px; color:#94A3B8;">•</span>
          <span style="font-size:11px; color:#94A3B8;">${shop.phone}</span>
        </div>
        ${photoBadge}
      </div>
      <h4 style="font-size:14px; font-weight:700; color:#0F172A; margin-bottom:4px;">${shop.address}</h4>
      <p style="font-size:12px; color:#64748B; font-weight:500; line-height:1.5;">${shop.worktime}</p>
    `;

    item.addEventListener("mouseenter", () => {
      item.style.background = "#F8FAFC";
      item.style.paddingLeft = "24px";
    });

    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
      item.style.paddingLeft = "20px";
    });

    item.onclick = () => {
      if (mapInstance && isMapReady) {
        mapInstance.setCenter(shop.coordinates, 15, { duration: 400 });
      }
      openFullscreenCard(shop);
    };

    shopsContainer.appendChild(item);
  });
}

// ===== МОДАЛЬНОЕ ОКНО ФИЛИАЛА С ЕДИНОЙ КНОПКОЙ НАВИГАЦИИ =====
export function openFullscreenCard(shopData) {
  closeFullscreenCard();

  const images = shopData.images || [];
  currentModalShopImages = Array.isArray(images) ? images : [];
  currentModalImageIndex = 0;

  const hasImages = currentModalShopImages.length > 0;

  const lat = shopData.coordinates ? shopData.coordinates[0] : 50.10007;
  const lng = shopData.coordinates ? shopData.coordinates[1] : 45.40316;
  const escapedAddress = (shopData.address || '').replace(/'/g, "\\'");

  const modal = document.createElement("div");
  modal.id = "shop-fullscreen-modal";
  modal.className = "shop-modal-wrapper";

  let galleryHtml = "";
  if (hasImages) {
    galleryHtml = `
      <div class="shop-modal-gallery">
        <div class="shop-modal-main-img-wrap" onclick="window.openShopImageZoom(${currentModalImageIndex})">
          <img id="shopModalMainImg" src="${currentModalShopImages[0]}" alt="${shopData.address}" />
          <div class="shop-modal-zoom-badge">
            <i class="fas fa-expand"></i> Увеличить
          </div>
          <div class="shop-modal-img-counter" id="shopModalImgCounter">
            1 / ${currentModalShopImages.length}
          </div>
        </div>
        ${currentModalShopImages.length > 1 ? `
          <div class="shop-modal-thumbs">
            ${currentModalShopImages.map((img, idx) => `
              <div class="shop-modal-thumb ${idx === 0 ? 'active' : ''}" 
                   onclick="switchShopMainImage(${idx})"
                   id="shopThumb_${idx}">
                <img src="${img}" alt="Миниатюра ${idx + 1}" />
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="shop-modal-backdrop" onclick="closeFullscreenCard()">
      <div class="shop-modal-card" onclick="event.stopPropagation()">
        <button class="shop-modal-close-btn" onclick="closeFullscreenCard()" title="Закрыть (Esc)">
          <i class="fas fa-times"></i>
        </button>

        ${galleryHtml}

        <div class="shop-modal-body">
          <div class="shop-modal-meta">
            <span class="shop-modal-tag">${shopData.name || 'Склад / Магазин'}</span>
            <span class="shop-modal-city"><i class="fas fa-map-marker-alt"></i> ${shopData.city || 'Камышин'}</span>
          </div>

          <h2 class="shop-modal-title">${shopData.address}</h2>

          <div class="shop-modal-info-grid">
            <div class="shop-modal-info-item">
              <div class="info-icon"><i class="far fa-clock"></i></div>
              <div class="info-content">
                <div class="info-label">Режим работы</div>
                <div class="info-value">${shopData.worktime || shopData.time || 'График не указан'}</div>
              </div>
            </div>

            ${shopData.phone ? `
              <div class="shop-modal-info-item">
                <div class="info-icon"><i class="fas fa-phone-alt"></i></div>
                <div class="info-content">
                  <div class="info-label">Телефон филиала</div>
                  <div class="info-value">
                    <a href="tel:${shopData.phone}">${shopData.phone}</a>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- ЕДИНАЯ УНИВЕРСАЛЬНАЯ КНОПКА ПОСТРОЕНИЯ МАРШРУТА -->
          <div class="shop-route-block">
            <button onclick="window.openUniversalRoute(${lat}, ${lng}, '${escapedAddress}')" class="universal-route-btn">
              <i class="fas fa-location-arrow"></i>
              <span>Построить маршрут</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  window.addEventListener("keydown", handleShopModalKeydown);
}

function handleShopModalKeydown(e) {
  if (e.key === "Escape") {
    if (document.getElementById("shopImageZoomModal")) {
      closeShopImageZoom();
    } else {
      closeFullscreenCard();
    }
  }
}

// Переключение главного изображения
window.switchShopMainImage = function(index) {
  if (!currentModalShopImages[index]) return;
  currentModalImageIndex = index;
  
  const mainImg = document.getElementById("shopModalMainImg");
  if (mainImg) {
    mainImg.style.opacity = "0.4";
    setTimeout(() => {
      mainImg.src = currentModalShopImages[index];
      mainImg.style.opacity = "1";
    }, 120);
  }

  const counter = document.getElementById("shopModalImgCounter");
  if (counter) {
    counter.textContent = `${index + 1} / ${currentModalShopImages.length}`;
  }

  document.querySelectorAll(".shop-modal-thumb").forEach((thumb, i) => {
    thumb.classList.toggle("active", i === index);
  });
};

// Lightbox
window.openShopImageZoom = function(index = 0) {
  if (!currentModalShopImages.length) return;
  currentModalImageIndex = index;

  let zoomModal = document.getElementById("shopImageZoomModal");
  if (!zoomModal) {
    zoomModal = document.createElement("div");
    zoomModal.id = "shopImageZoomModal";
    zoomModal.className = "shop-zoom-modal";
    document.body.appendChild(zoomModal);
  }

  renderShopZoomContent();
};

function renderShopZoomContent() {
  const zoomModal = document.getElementById("shopImageZoomModal");
  if (!zoomModal) return;

  const currentImg = currentModalShopImages[currentModalImageIndex];
  const hasMultiple = currentModalShopImages.length > 1;

  zoomModal.innerHTML = `
    <div class="shop-zoom-backdrop" onclick="closeShopImageZoom()">
      <button class="shop-zoom-close" onclick="closeShopImageZoom()">&times;</button>
      
      ${hasMultiple ? `
        <button class="shop-zoom-nav prev" onclick="event.stopPropagation(); prevShopZoomImg();">
          <i class="fas fa-chevron-left"></i>
        </button>
        <button class="shop-zoom-nav next" onclick="event.stopPropagation(); nextShopZoomImg();">
          <i class="fas fa-chevron-right"></i>
        </button>
      ` : ''}

      <div class="shop-zoom-img-container" onclick="event.stopPropagation()">
        <img src="${currentImg}" alt="Просмотр фотографии" />
        ${hasMultiple ? `
          <div class="shop-zoom-counter">${currentModalImageIndex + 1} из ${currentModalShopImages.length}</div>
        ` : ''}
      </div>
    </div>
  `;

  zoomModal.classList.add("open");
}

window.prevShopZoomImg = function() {
  currentModalImageIndex = (currentModalImageIndex - 1 + currentModalShopImages.length) % currentModalShopImages.length;
  renderShopZoomContent();
  switchShopMainImage(currentModalImageIndex);
};

window.nextShopZoomImg = function() {
  currentModalImageIndex = (currentModalImageIndex + 1) % currentModalShopImages.length;
  renderShopZoomContent();
  switchShopMainImage(currentModalImageIndex);
};

window.closeShopImageZoom = function() {
  const zoomModal = document.getElementById("shopImageZoomModal");
  if (zoomModal) {
    zoomModal.classList.remove("open");
    setTimeout(() => zoomModal.remove(), 200);
  }
};

export function closeFullscreenCard() {
  const modal = document.getElementById("shop-fullscreen-modal");
  if (modal) {
    modal.remove();
    document.body.style.overflow = "";
  }
  window.removeEventListener("keydown", handleShopModalKeydown);
}

window.openFullscreenCard = openFullscreenCard;
window.closeFullscreenCard = closeFullscreenCard;

let ymapsLoadPromise = null;

function loadYandexScript() {
  if (ymapsLoadPromise) return ymapsLoadPromise;

  ymapsLoadPromise = new Promise((resolve, reject) => {
    if (typeof ymaps !== "undefined" && ymaps.ready) {
      ymaps.ready(resolve);
      return;
    }

    let script = document.querySelector('script[src*="api-maps.yandex.ru"]');
    if (script) {
      const checkReady = setInterval(() => {
        if (typeof ymaps !== "undefined" && ymaps.ready) {
          clearInterval(checkReady);
          ymaps.ready(resolve);
        }
      }, 50);
      setTimeout(() => clearInterval(checkReady), 10000);
      return;
    }

    fetch("/api/config/yandex-maps")
      .then((res) => res.json())
      .then((config) => {
        const apiKey = config.apiKey || "";
        script = document.createElement("script");
        script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU${apiKey ? `&apikey=${apiKey}` : ""}`;
        script.async = true;
        script.onload = () => {
          if (typeof ymaps !== "undefined") {
            ymaps.ready(resolve);
          } else {
            reject(new Error("ymaps не загрузился"));
          }
        };
        script.onerror = () => reject(new Error("Ошибка загрузки скрипта карт"));
        document.head.appendChild(script);
      })
      .catch((err) => {
        script = document.createElement("script");
        script.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
        script.async = true;
        script.onload = () => {
          if (typeof ymaps !== "undefined") {
            ymaps.ready(resolve);
          } else {
            reject(new Error("ymaps не загрузился"));
          }
        };
        script.onerror = () => reject(err);
        document.head.appendChild(script);
      });
  });

  return ymapsLoadPromise;
}

// ===== ИНИЦИАЛИЗАЦИЯ КАРТЫ С АВТОМАШТАБИРОВАНИЕМ =====
export async function initYandexMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  await renderShopsListInstant();

  try {
    await loadYandexScript();

    if (!document.getElementById("map")) return;

    mapEl.innerHTML = "";

    mapInstance = new ymaps.Map("map", {
      center: [50.108462, 45.307467],
      zoom: 11,
      controls: ["zoomControl"],
    });

    const cityCollection = new ymaps.GeoObjectCollection();

    fetchedShops.forEach((shop) => {
      const placemark = new ymaps.Placemark(
        shop.coordinates,
        {
          hintContent: `${shop.name}: ${shop.address}`,
          shopData: shop,
        },
        { preset: "islands#redDotIcon" }
      );

      placemark.events.add("click", function (e) {
        const target = e.get("target");
        const data = target.properties.get("shopData");
        openFullscreenCard(data);
      });

      cityCollection.add(placemark);
    });

    mapInstance.geoObjects.add(cityCollection);
    isMapReady = true;

    if (cityCollection.getLength() > 0) {
      mapInstance.setBounds(cityCollection.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 50
      });
    }

    setTimeout(() => {
      if (mapInstance) mapInstance.container.fitToViewport();
    }, 100);

  } catch (err) {
    console.warn("Карта не загрузилась:", err);
  }
}

export async function initPickupMap(containerId, onSelectCallback) {
  const mapEl = document.getElementById(containerId);
  if (!mapEl) return;

  try {
    await loadYandexScript();

    const res = await fetch("/api/shops");
    const points = await res.json();

    if (!points || points.length === 0) return;

    const map = new ymaps.Map(containerId, {
      center: [50.108462, 45.307467],
      zoom: 11,
      controls: ["zoomControl"],
    });

    const pickupCollection = new ymaps.GeoObjectCollection();

    points.forEach((point) => {
      const coords = parseCoords(point.coords) || [50.1, 45.4];
      const placemark = new ymaps.Placemark(
        coords,
        { hintContent: point.address },
        { preset: "islands#redDotIcon" }
      );

      placemark.events.add("click", () => {
        if (onSelectCallback) onSelectCallback(point);
        map.setCenter(coords, 14, { duration: 400 });
      });

      pickupCollection.add(placemark);
    });

    map.geoObjects.add(pickupCollection);

    if (pickupCollection.getLength() > 0) {
      map.setBounds(pickupCollection.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    }
  } catch (err) {
    console.error("Ошибка загрузки карты пунктов выдачи:", err);
  }
}