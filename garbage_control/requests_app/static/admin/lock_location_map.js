(function () {
  function disableMapEdits() {
    // GeoDjango admin хранит карты в window.geodjango.maps
    const maps = window.geodjango && window.geodjango.maps;
    if (!maps) return;

    Object.values(maps).forEach((m) => {
      if (!m || !m.map) return;
      const map = m.map;

      // отключаем управление картой
      map.dragging && map.dragging.disable();
      map.touchZoom && map.touchZoom.disable();
      map.doubleClickZoom && map.doubleClickZoom.disable();
      map.scrollWheelZoom && map.scrollWheelZoom.disable();
      map.boxZoom && map.boxZoom.disable();
      map.keyboard && map.keyboard.disable();
      if (map.tap) map.tap.disable();

      // самое главное: убираем обработчики, которые меняют точку по клику
      map.off("click");

      // блокируем перетаскивание маркера (если он draggable)
      map.eachLayer((layer) => {
        if (layer && layer.dragging && layer.dragging.disable) {
          layer.dragging.disable();
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", disableMapEdits);
})();
