// map.js — МГНОВЕННАЯ ЗАГРУЗКА КАРТЫ
// Сначала рендерится список филиалов (0ms), затем подгружается карта

let mapInstance = null;
let isMapReady = false;

// ===== ДАННЫЕ ФИЛИАЛОВ =====
const shopList = [
  {
    cityName: "Камышин",
    shops: [
      {
        coordinates: [50.10007069457058, 45.40316283702851],
        name: "г.Камышин, 2-й железнодорожный переезд, корпус 1",
        timework: "пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15",
        phone: "+78445790099",
      },
      {
        coordinates: [50.105875308002666, 45.4138970375061],
        name: "г.Камышин, ул.Ленина, 14А",
        timework: "пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15",
        phone: "+78445791119",
      },
      {
        coordinates: [50.08035315572386, 45.407588481903076],
        name: "г.Камышин, ул.Спартаковская, 75",
        timework: "пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15",
        phone: "+78445790099",
      },
      {
        coordinates: [50.135726811041174, 45.20690023899079],
        name: "г.Петров-Вал, ул.Ленина, 29",
        timework: "пн-пт: 8:00 - 18:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&z=16.15",
        phone: "+78445790099",
      },
    ],
  },
];

// ===== МГНОВЕННЫЙ РЕНДЕРИНГ СПИСКА ФИЛИАЛОВ (0ms) =====
function renderShopsListInstant() {
  const shopsContainer = document.getElementById("shops");
  if (!shopsContainer) return;

  // Очищаем контейнер
  shopsContainer.innerHTML = "";
  shopsContainer.style.background = "#FFFFFF";

  shopList.forEach((city) => {
    city.shops.forEach((shop) => {
      const shopData = {
        address: shop.name,
        time: shop.timework,
        route: shop.how,
        phone: shop.phone,
      };

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

      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:4px;">
          <span style="color:var(--brand); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:1.5px;">Склад/Магазин</span>
          <span style="font-size:11px; color:#94A3B8;">•</span>
          <span style="font-size:11px; color:#94A3B8;">${shop.phone}</span>
        </div>
        <h4 style="font-size:14px; font-weight:700; color:#0F172A; margin-bottom:4px;">${shop.name}</h4>
        <p style="font-size:12px; color:#64748B; font-weight:500; line-height:1.5;">${shop.timework}</p>
        <div style="margin-top:8px; font-size:11px; font-weight:600; color:var(--brand); opacity:0; transition:all 0.3s;">
          <i class="fas fa-arrow-right"></i> Подробнее
        </div>
      `;

      // Ховер эффект через CSS
      item.addEventListener("mouseenter", () => {
        item.style.background = "#F8FAFC";
        item.style.paddingLeft = "28px";
        const link = item.querySelector("div:last-child");
        if (link) link.style.opacity = "1";
      });

      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        item.style.paddingLeft = "20px";
        const link = item.querySelector("div:last-child");
        if (link) link.style.opacity = "0";
      });

      item.onclick = () => {
        // Если карта уже загружена - центрируем
        if (mapInstance && isMapReady) {
          mapInstance.setCenter(shop.coordinates, 15, { duration: 400 });
        }
        openFullscreenCard(shopData);
      };

      shopsContainer.appendChild(item);
    });
  });
}

// ===== МОДАЛЬНОЕ ОКНО =====
function openFullscreenCard(shopData) {
  let modal = document.getElementById("shop-fullscreen-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "shop-fullscreen-modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div onclick="window.closeFullscreenCard && closeFullscreenCard()" style="z-index: 9000; position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px;">
      <div onclick="event.stopPropagation()" style="background:white; border-radius:12px; max-width:440px; width:100%; position:relative; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
        <button onclick="window.closeFullscreenCard && closeFullscreenCard()" style="position:absolute; right:14px; top:14px; background:none; border:none; color:#94A3B8; font-size:20px; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
          <i class="fas fa-times"></i>
        </button>
        <div style="padding:32px 28px 28px;">
          <div style="color:var(--brand); font-weight:800; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Пункт выдачи</div>
          <h2 style="font-size:19px; font-weight:800; line-height:1.3; margin:12px 0 16px; color:#0F172A;">${shopData.address}</h2>
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px 16px; margin-bottom:20px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#94A3B8; margin-bottom:4px;">Режим работы</div>
            <div style="font-size:13px; font-weight:600; color:#0F172A; line-height:1.6;">${shopData.time}</div>
          </div>
          <a href="${shopData.route}" target="_blank" style="display:flex; justify-content:center; align-items:center; gap:10px; width:100%; padding:14px; background:#0F172A; color:white; text-decoration:none; border-radius:8px; font-weight:700; font-size:13px; transition:background 0.2s;">
            <span>Проложить маршрут</span>
            <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    </div>
  `;

  modal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeFullscreenCard() {
  const modal = document.getElementById("shop-fullscreen-modal");
  if (modal) {
    modal.remove();
    document.body.style.overflow = "";
  }
}

// Глобальные привязки для inline-обработчиков
window.openFullscreenCard = openFullscreenCard;
window.closeFullscreenCard = closeFullscreenCard;

// ===== БЫСТРАЯ ЗАГРУЗКА СКРИПТА ЯНДЕКСА =====
let ymapsLoadPromise = null;

function loadYandexScript() {
  if (ymapsLoadPromise) return ymapsLoadPromise;

  ymapsLoadPromise = new Promise((resolve, reject) => {
    // Проверяем, загружен ли уже ymaps
    if (typeof ymaps !== "undefined" && ymaps.ready) {
      ymaps.ready(resolve);
      return;
    }

    // Проверяем, есть ли уже скрипт в DOM
    let script = document.querySelector('script[src*="api-maps.yandex.ru"]');
    if (script) {
      // Если скрипт уже есть, ждем его загрузки
      const checkReady = setInterval(() => {
        if (typeof ymaps !== "undefined" && ymaps.ready) {
          clearInterval(checkReady);
          ymaps.ready(resolve);
        }
      }, 50);
      setTimeout(() => clearInterval(checkReady), 10000);
      return;
    }

    // Загружаем скрипт
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
        script.onerror = () => {
          reject(new Error("Ошибка загрузки скрипта Яндекс.Карт"));
        };
        document.head.appendChild(script);
      })
      .catch((err) => {
        // Если ключ не получен, пробуем загрузить без ключа
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

// ===== ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ =====
export async function initYandexMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) {
    console.warn("Элемент #map не найден");
    return;
  }

  // 1. МГНОВЕННЫЙ РЕНДЕРИНГ СПИСКА (0ms)
  renderShopsListInstant();

  // 2. ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА КАРТЫ
  try {
    await loadYandexScript();

    // Проверяем, существует ли элемент (вдруг страница уже перезагружена)
    if (!document.getElementById("map")) return;

    // Создаем карту
    mapEl.innerHTML = "";

    mapInstance = new ymaps.Map("map", {
      center: [50.108462, 45.307467],
      zoom: 11,
      controls: ["zoomControl"],
    });

    // Добавляем метки
    shopList.forEach((city) => {
      const cityCollection = new ymaps.GeoObjectCollection();

      city.shops.forEach((shop) => {
        const shopData = {
          address: shop.name,
          time: shop.timework,
          route: shop.how,
        };

        const placemark = new ymaps.Placemark(
          shop.coordinates,
          {
            hintContent: shop.name,
            shopData: shopData,
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
    });

    isMapReady = true;

    // Добавляем resize для правильного отображения
    setTimeout(() => {
      if (mapInstance) mapInstance.container.fitToViewport();
    }, 100);

  } catch (err) {
    console.warn("Карта не загрузилась:", err);
    // Показываем сообщение, но список филиалов уже есть
    if (mapEl && !mapEl.innerHTML) {
      mapEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#F8FAFC;color:#94A3B8;font-size:13px;font-weight:600;text-align:center;padding:20px;">
        <div>
          <i class="fas fa-map" style="font-size:24px;display:block;margin-bottom:8px;color:#CBD5E1;"></i>
          Карта временно недоступна<br>
          <span style="font-size:12px;font-weight:400;">Список филиалов доступен ниже</span>
        </div>
      </div>`;
    }
  }
}

// ===== ПИКАП МАП (для корзины) =====
export async function initPickupMap(containerId, onSelectCallback) {
  const mapEl = document.getElementById(containerId);
  if (!mapEl) return;

  try {
    await loadYandexScript();

    const res = await fetch("/api/pickup-points");
    const points = await res.json();

    if (!points || points.length === 0) return;

    const map = new ymaps.Map(containerId, {
      center: [50.108462, 45.307467],
      zoom: 11,
      controls: ["zoomControl"],
    });

    points.forEach((point) => {
      const coords = point.coords ? JSON.parse(point.coords) : [50.1, 45.4];
      const placemark = new ymaps.Placemark(
        coords,
        { hintContent: point.name },
        { preset: "islands#redDotIcon" }
      );

      placemark.events.add("click", () => {
        if (onSelectCallback) onSelectCallback(point);
        map.setCenter(coords, 14, { duration: 400 });
      });

      map.geoObjects.add(placemark);
    });
  } catch (err) {
    console.error("Ошибка загрузки карты пунктов выдачи:", err);
  }
}