
export function initYandexMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    // Wait for ymaps if not immediately available
    if (typeof ymaps === 'undefined') {
        const checkYmaps = setInterval(() => {
            if (typeof ymaps !== 'undefined') {
                clearInterval(checkYmaps);
                ymaps.ready(init);
            }
        }, 100);
        return;
    }

    ymaps.ready(init);

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
                   item.innerHTML = `
                      <div class="shop-item-tag">Склад/Магазин</div>
                      <h4 class="shop-item-name">${shop.name}</h4>
                      <p class="shop-item-time">${shop.timework}</p>
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

    window.openFullscreenCard = function(shopData) {
        let modal = document.getElementById("shop-fullscreen-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "shop-fullscreen-modal";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-overlay-industrial" onclick="closeFullscreenCard()">
                <div class="modal-card-industrial" onclick="event.stopPropagation()">
                    <button class="modal-close-industrial" onclick="closeFullscreenCard()"><i class="fas fa-times"></i></button>
                    <div class="modal-content-industrial">
                        <div class="modal-label-industrial">Локация пункта</div>
                        <h2 class="modal-title-industrial">${shopData.address}</h2>
                        <div class="modal-info-block-industrial">
                            <div class="info-label">Режим работы</div>
                            <div class="info-value">${shopData.time}</div>
                        </div>
                        <a href="${shopData.route}" target="_blank" class="modal-btn-industrial">
                           ПРОЛОЖИТЬ МАРШРУТ <i class="fas fa-external-link-alt ml-2"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'block';
        setTimeout(() => modal.classList.add("show"), 10);
        document.body.style.overflow = "hidden";
    }

    window.closeFullscreenCard = function () {
        const modal = document.getElementById("shop-fullscreen-modal");
        if (modal) {
            modal.classList.remove("show");
            document.body.style.overflow = "";
            setTimeout(() => {
                if (!modal.classList.contains("show")) modal.style.display = "none";
            }, 300);
        }
    };
}
