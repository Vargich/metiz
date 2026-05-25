export function initYandexMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    // ВАЖНО ДЛЯ SPA: Очищаем контейнер перед новой загрузкой карты
    mapEl.innerHTML = ""; 

    // Запускаем инициализацию карты
    const loadMap = () => {
        ymaps.ready(init);
    };

    // Если Я.Карты еще не скачаны (человек первый раз зашел на Контакты) - качаем их
    if (typeof ymaps === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=33642748-9cc0-49a1-8516-cef1e3433a34";
        script.type = "text/javascript";
        script.onload = loadMap;
        document.head.appendChild(script);
    } else {
        // Если уже скачаны (перешел туда-сюда) - просто запускаем
        loadMap();
    }

    // ===========================================
    // ВАША ОРИГИНАЛЬНАЯ ЛОГИКА 
    // ===========================================
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
        myMap.behaviors.disable('scrollZoom');

        const shopsContainer = document.getElementById("shops");
        if (shopsContainer) {
            shopsContainer.innerHTML = "";
            shopsContainer.style.background = "white";
        }

        shopList.forEach((city, cityIdx) => {
            const cityCollection = new ymaps.GeoObjectCollection();

            city.shops.forEach((shop, shopIdx) => {
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

                shopPlacemark.events.add("click", function (e) {
                    const target = e.get("target");
                    const data = target.properties.get("shopData");
                    openFullscreenCard(data);
                });

                cityCollection.add(shopPlacemark);

                if (shopsContainer) {
                   const item = document.createElement('div');
                   item.className = 'shop-list-item-industrial';
                   // Немного затемним фон кнопок магазинов, раз фон контейнера белый
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

    // Модальное окно (ваш красивый дизайн)
    window.openFullscreenCard = function(shopData) {
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
        document.body.style.overflow = "hidden";
    }

    window.closeFullscreenCard = function () {
        const modal = document.getElementById("shop-fullscreen-modal");
        if (modal) {
            modal.remove(); // Просто вырезаем его из дерева чтобы не плодились баги
            document.body.style.overflow = "";
        }
    };
}