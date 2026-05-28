// Локальные объявления функций (исключают ReferenceError при инициализации)
function openFullscreenCard(shopData) {
    let modal = document.getElementById("shop-fullscreen-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "shop-fullscreen-modal";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-overlay-industrial" onclick="closeFullscreenCard()" style="z-index: 9000; position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center;">
            <div class="modal-card-industrial" onclick="event.stopPropagation()" style="background:white; border:2px solid var(--dark); max-width:400px; position:relative; box-shadow: 15px 15px 0 var(--dark);">
                <button class="modal-close-industrial" onclick="closeFullscreenCard()" style="position:absolute; right:-20px; top:-20px; background:var(--brand); border:2px solid var(--dark); color:white; width:40px; height:40px; cursor:pointer;"><i class="fas fa-times"></i></button>
                <div class="modal-content-industrial" style="padding:40px;">
                    <div class="modal-label-industrial" style="color:var(--brand); font-weight:900; font-size:10px; letter-spacing:2px; text-transform:uppercase;">Локация пункта</div>
                    <h2 class="modal-title-industrial" style="font-size:24px; font-weight:900; line-height:1.2; text-transform:uppercase; margin:16px 0;">${shopData.address}</h2>
                    <div class="modal-info-block-industrial" style="background:#f3f4f6; padding:16px; margin: 24px 0;">
                        <div class="info-label" style="opacity:0.5; font-size:10px; font-weight:900; text-transform:uppercase; margin-bottom:8px;">Режим работы</div>
                        <div class="info-value" style="font-weight:700;">${shopData.time}</div>
                    </div>
                    <a href="${shopData.route}" target="_blank" class="modal-btn-industrial hero-btn" style="text-decoration:none; display:block; text-align:center; padding:16px;">
                       ПРОЛОЖИТЬ МАРШРУТ <i class="fas fa-external-link-alt ml-2"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
    
    // Принудительно перебиваем стиль "display: none" из CSS файла
    modal.style.display = "block";
    
    // Запускаем плавную CSS-анимацию через класс .show
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);

    // Блокируем прокрутку основного сайта
    document.body.style.overflow = "hidden";
}

function closeFullscreenCard() {
    const modal = document.getElementById("shop-fullscreen-modal");
    if (modal) {
        // Убираем класс анимации (запускает плавное исчезновение opacity)
        modal.classList.remove("show");
        
        // Даем 400 миллисекунд на завершение CSS-анимации, после чего удаляем элемент из DOM
        setTimeout(() => {
            modal.remove();
        }, 400);
        
        // Возвращаем прокрутку основному сайту
        document.body.style.overflow = "";
    }
}

// Привязываем к глобальному объекту window для inline-обработчиков
window.openFullscreenCard = openFullscreenCard;
window.closeFullscreenCard = closeFullscreenCard;

export function initYandexMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    mapEl.innerHTML = "";

    const loadMap = () => {
        ymaps.ready(init);
    };

    if (typeof ymaps === 'undefined') {
        fetch('/api/config/yandex-maps')
            .then(res => res.json())
            .then(config => {
                const script = document.createElement('script');
                script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${config.apiKey}`;
                script.type = "text/javascript";
                script.onload = loadMap;
                document.head.appendChild(script);
            })
            .catch(err => {
                console.error("Не удалось получить API ключ Яндекс.Карт:", err);
            });
    } else {
        loadMap();
    }

    function init() {
        const shopList = [
            {
                cityName: "Камышин",
                shops: [
                    {
                        coordinates: [50.10007069457058, 45.40316283702851],
                        name: "г.Камышин, 2-й железнодорожный переезд, корпус 1",
                        timework: "пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
                        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&ruri=~&z=16.15",
                        phone: "+78445790099",
                    },
                    {
                        coordinates: [50.105875308002666, 45.4138970375061],
                        name: "г.Камышин, ул.Ленина, 14А",
                        timework: "пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
                        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&ruri=~&z=16.15",
                        phone: "+78445791119",
                    },
                    {
                        coordinates: [50.08035315572386, 45.407588481903076],
                        name: "г.Камышин, ул.Спартаковская, 75",
                        timework: "пн-пт: 8:00 - 17:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
                        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&ruri=~&z=16.15",
                        phone: "+78445790099",
                    },
                    {
                        coordinates: [50.135726811041174, 45.20690023899079],
                        name: "г.Петров-Вал, ул.Ленина, 29",
                        timework: "пн-пт: 8:00 - 18:00<br>сб: 8:30 - 15:00<br>вс: 8:30 - 14:00<br>ПЕРЕРЫВ: 12:00 - 12:30",
                        how: "https://yandex.ru/maps/10959/kamishin/?ll=45.406037%2C50.097563&mode=routes&rtext=~50.100138%2C45.403078&rtt=auto&ruri=~&z=16.15",
                        phone: "+78445790099",
                    },
                ],
            },
        ];

        const myMap = new ymaps.Map("map", {
            center: [50.108462, 45.307467],
            zoom: 11,
            controls: ["zoomControl"],
        });

        const shopsContainer = document.getElementById("shops");
        if (shopsContainer) {
            shopsContainer.innerHTML = "";
            shopsContainer.style.background = "white";
        }

        shopList.forEach((city) => {
            const cityCollection = new ymaps.GeoObjectCollection();

            city.shops.forEach((shop) => {
                const shopData = {
                    address: shop.name,
                    time: shop.timework,
                    route: shop.how,
                };

                const shopPlacemark = new ymaps.Placemark(
                    shop.coordinates,
                    {
                        hintContent: shop.name,
                        shopData: shopData,
                        balloonContent: "",
                    },
                    { preset: "islands#redDotIcon" }
                );

                // Корректный вызов локально доступного метода
                shopPlacemark.events.add("click", function (e) {
                    const target = e.get("target");
                    const data = target.properties.get("shopData");
                    openFullscreenCard(data);
                });

                cityCollection.add(shopPlacemark);

                if (shopsContainer) {
                    const item = document.createElement('div');
                    item.className = 'shop-list-item-industrial';
                    item.style.color = '#000';
                    item.style.borderBottom = '1px solid #e5e7eb';
                    item.innerHTML = `
                      <div class="shop-item-tag" style="color:var(--brand); font-weight:900; font-size:10px; text-transform:uppercase;">Склад/Магазин</div>
                      <h4 class="shop-item-name" style="margin-top:4px;">${shop.name}</h4>
                      <p class="shop-item-time" style="opacity:0.6; font-size:12px;">${shop.timework}</p>
                      `;
                    item.onclick = () => {
                        myMap.setCenter(shop.coordinates, 15, { duration: 500 });
                        openFullscreenCard(shopData);
                    };
                    shopsContainer.appendChild(item);
                }
            });
            myMap.geoObjects.add(cityCollection);
        });
    }
}

// Мини-карта для корзины — загружает точки из API
export function initPickupMap(containerId, onSelectCallback) {
    const mapEl = document.getElementById(containerId);
    if (!mapEl) return;

    mapEl.innerHTML = "";

    const loadMap = async () => {
        await ymaps.ready();
        try {
            const res = await fetch('/api/pickup-points');
            const points = await res.json();
            initPickup(mapEl, points, onSelectCallback);
        } catch (e) {
            console.error('Ошибка загрузки пунктов выдачи:', e);
        }
    };

    if (typeof ymaps === 'undefined') {
        fetch('/api/config/yandex-maps')
            .then(res => res.json())
            .then(config => {
                const script = document.createElement('script');
                script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${config.apiKey}`;
                script.type = "text/javascript";
                script.onload = loadMap;
                document.head.appendChild(script);
            })
            .catch(err => {
                console.error('Ошибка загрузки скрипта Яндекс.Карт:', err);
            });
    } else {
        loadMap();
    }
}

function initPickup(container, points, onSelectCallback) {
    if (points.length === 0) return;

    const map = new ymaps.Map(container, {
        center: [50.108462, 45.307467],
        zoom: 11,
        controls: ["zoomControl"]
    });

    points.forEach(point => {
        const coords = point.coords ? JSON.parse(point.coords) : [50.1, 45.4];
        const placemark = new ymaps.Placemark(
            coords,
            {
                hintContent: point.name,
                balloonContent: `<strong>${point.name}</strong><br>${point.address}<br>${point.worktime || ''}`
            },
            { preset: "islands#redDotIcon" }
        );

        placemark.events.add("click", function () {
            if (onSelectCallback) onSelectCallback(point);
            map.setCenter(coords, 14, { duration: 400 });
        });

        map.geoObjects.add(placemark);
    });

    container._mapInstance = map;
}