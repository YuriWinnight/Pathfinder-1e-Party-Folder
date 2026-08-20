# PF1e Party Folder

## Changes in version 1.7.6

- Party background and accent selections are stored on the current Foundry user.
- Each player can use a different theme, including when several accounts share one browser installation.
- Existing client theme choices are migrated to the current user on first launch.

## Changes in version 1.7.5

- Improved dark-theme contrast for Perception, exploration controls and empty activity slots.
- Restored readable stash member weights, search text, item controls, and currency values.
- Kept dark icons on the pale exploration and currency buttons.

## Changes in version 1.7.4

- The spell conversion window in the stash now uses the native PF1 actor-sheet layout.
- When Pathfinder 1e Ru Improvements is active, potion, wand, and enabled scroll conversions offer its consumable image picker.
- Ru Improvements integration is optional and is never called when that module is disabled.

## Changes in version 1.7.3

- Restored the original equal-width, centered layout of the three saving throws while keeping them clickable.

## Changes in version 1.7.2

- Fortitude, Reflex, and Will saves can now be rolled directly from each member's overview row.
- Made the primary-tab decorations visible without becoming bright in the dark theme.

## Changes in version 1.7.1

- The beige theme now uses the original PF1 parchment texture.
- Reworked the dark theme around a near-black base with muted, readable text, borders, fields, and accents.

## Changes in version 1.7.0

- Replaced the beige background with a lighter neutral paper tone.
- Brightened the brown, burgundy, and blue header colors.
- Accent selection now changes only the party header.
- Improved panel, field, border, and text contrast for the dark background.

## Changes in version 1.6.9

- Added independent client settings for light, beige, and dark party-menu backgrounds.
- Added green, dark-brown, burgundy, and blue accent themes.

## Changes in version 1.6.8

- Corrected the displayed Russian skill label from "Полет" to "Полёт".

## Changes in version 1.6.7

- Renamed the displayed Russian label for darkvision to "Ночное зрение".

## Changes in version 1.6.6

- Added a GM-only setup window for hiding or replacing each party member's senses and languages in the player-facing party menu.
- Real actor data remains unchanged and visible to the GM.

## Changes in version 1.6.5

- Increased the quantity input hit area for top-level stash items without changing nested container items.

## Changes in version 1.6.4

- Restored the previous quantity field size for top-level stash items.
- Kept the adjusted spacing only for items nested inside stash containers.

## Изменения версии 1.6.3

- Поле количества вложенного предмета больше не перекрывает кнопку увеличения.

## Изменения версии 1.6.2

- Кнопки уменьшения и увеличения количества у вложенных предметов собраны в компактную группу рядом со значением.

## Изменения версии 1.6.1

- Цена, количество и вес предметов редактируются прямо в раскрытом контейнере тайника.
- Для количества вложенных предметов добавлены кнопки уменьшения и увеличения.
- Работа с полями вложенного предмета больше не запускает его перетаскивание.

## Изменения версии 1.6.0

- Подписи щитов дополнительных видов КБ полностью показывают названия «Касание» и «Врасплох».
- Из обзора партии можно бросать МБМ, атаку ближнего боя и дистанционную атаку.

## Изменения версии 1.5.9

- Исправлен перенос вложенных предметов: из раскрытого контейнера в верхний уровень тайника переносится сама вещь, а не рюкзак.
- При переносе вложенной вещи актёру создаётся только выбранный предмет, после чего он удаляется из контейнера тайника.
- Раскрытые контейнеры оформлены как в PF2e: вложенные строки выровнены по колонкам и соединены тонкими линиями, без шкалы заполненности.
- КБ касания и КБ врасплох перенесены в отдельные щиты; боевые показатели перестроены в порядке БМА, ЗБМ, МБМ, ближний и дистанционный бой.

## Изменения версии 1.5.8

- Меню партии показывает только персонажей, которые непосредственно находятся в папке партии.
- В обзор добавлены дополнительные виды КБ и боевые бонусы.
- Добавлены настройки приватности чувств и языков, а также включения и максимума геройских очков.
- Контейнеры в тайнике можно раскрывать и наполнять перетаскиванием без открытия листа предмета.

## Изменения версии 1.5.7

- Убраны массовые предупреждения об устаревших `Actor#data` и `Item#data`, возникавшие при изменении состояний, предметов и других данных актёра.
- Старые структуры данных тайника по-прежнему читаются, но только как собственные поля обычных объектов, без обращения к устаревшим геттерам документов Foundry.

Модуль для Foundry VTT v11 и Pathfinder 1e 9.6. Добавляет актёра-партию и отдельную лист-папку партии в стиле PF2e: обзор, исследования, общий тайник и перетаскиваемую иконку партии.

Версия 1.0.13 добавляет геройские очки партии: `Shift+клик` по броску тратит очко на `+8` перед броском, а ПКМ по броску в чате позволяет потратить очко на `+4` к уже выпавшему результату.

## Установка

1. Распакуйте папку `pf1e-party-folder` в `FoundryVTT/Data/modules/`.
2. Перезапустите Foundry VTT.
3. Включите модуль в мире PF1e.
4. ГМ заходит в мир: актёр `The Party` создаётся автоматически.
5. Игроки открывают актёра партии или верхнюю карточку партии в списке актёров.

## Что есть

- Оформление листа партии в стиле встроенного меню партии Pathfinder Second Edition для Foundry v13.

### Обзор

- Языки всей партии.
- Все навыки партии с лучшим бонусом, видимым именем лучшего персонажа и броском по кнопке.
- Отдельная вкладка навыков знаний.
- По каждому участнику: КБ, испытания, Восприятие, HP и особые чувства.

### Исследование

- Скорость путешествия партии по самому медленному участнику.
- Скорость, Восприятие и HP каждого участника.
- Слоты активностей исследования.
- Настройка активности: название, навык, доп. бонус и СЛ.
- Общий бросок всех активностей.
- Кнопка долгого отдыха: восстанавливает HP до максимума у доступных владельцу персонажей.

### Тайник

- Общая валюта партии.
- Общая ценность: монеты + предметы тайника.
- Общий вес предметов тайника.
- Drag & drop предметов в тайник.
- Раскладка предметов по разделам тайника следует тем же PF1e-типам, что и инвентарь актёра.
- При переносе заклинания в тайник открывается PF1e-выбор: зелье, свиток, жезл или само заклинание.
- Открытие и редактирование параметров/описания предмета кликом по строке в тайнике.
- Разделение стопки предметов на указанное количество.
- Быстрое изменение цены, количества и веса прямо в строке тайника; нулевая стопка остаётся в списке и зачёркивается.
- Кнопки `+` и `−` количества реагируют сразу; при наведении на цену редактируется цена одной штуки, а строка показывает общую цену стопки.
- Если предмет перетащен из листа персонажа и пользователь владеет этим листом, предмет перемещается. Если удерживать Ctrl при переносе, предмет копируется.
- Передача предмета из тайника выбранному участнику.
- Ручное создание предмета прямо в категории тайника.
- Распределение монет поровну между доступными участниками партии; остаток остаётся в тайнике.

### Настройки

- Вид кнопки партии в папке актёров: белая иконка или выровненный круг с картинкой партии.

## Важно

PF1e хранит часть данных иначе, чем PF2e, поэтому модуль использует несколько резервных путей данных для навыков, языков, скорости, КБ, испытаний, валюты и предметов. Если в вашей сборке PF1e 9.6 конкретный лист или сторонний модуль хранит данные нестандартно, может понадобиться небольшая адаптация путей в `scripts/pf1e-party-folder.js`.
