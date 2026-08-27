# PF1e Party Folder

## Changes in version 1.9.8

- Replaced decorative corner marks with the same subtle inset and outer edge used by stash category bars.
- Immediately refreshes the public party snapshot and every open party sheet when a member actor is deleted.

## Changes in version 1.9.7

- Added NPC actors as supported party-folder members and statistics entries.
- Displayed PF1 unidentified item names throughout the stash, including nested container contents.
- Matched actor wealth to PF1's native item valuation, including containers, charges, quantities, broken items, and unidentified prices.
- Added inner corner accents to statistics, identification, and total-weight bars, and applied circular portraits to statistics in circular portrait mode.

## Changes in version 1.9.6

- Added party-menu settings for hiding identification DCs, limiting identification to the user's assigned character, and limiting party-statistic rolls to owned actors.
- Added a module-settings manager for creating independent additional party menus with separate folders, members, stashes, hero points, and metagame settings.
- Extended public snapshots, folder controls, actor hooks, and hero-point integration to support multiple party menus without changing the existing primary party.

## Changes in version 1.9.5

- Removed deprecated Foundry `Document.data` reads when opening stash items and containers.
- Kept other members' statistics private while exposing their visible or substituted party languages.
- Allowed every player to open and use party-stash item identification, with GM-authoritative automatic updates.
- Added optional Ru Improvements curse-identification rules and unidentified-icon synchronization.

## Changes in version 1.9.4

- Made container expansion arrows black in the dark theme.
- Isolated and centered current/maximum HP inputs from generic dark-theme input sizing.

## Changes in version 1.9.3

- Replaced teal ability, speed, maneuverability, and size labels with the shared interface blue palette.

## Changes in version 1.9.2

- Darkened the graphite fill used for negative HP while keeping it distinct from pure black.

## Changes in version 1.9.1

- Added graphite heart filling for negative HP, proportional to the negative value.
- Tightened current and maximum HP values around the separator.
- Unified the numeric size of current, maximum, temporary, and nonlethal HP values.

## Changes in version 1.9.0

- Smoothed the custom heart and drop shapes and introduced a more distinctive curved shield.
- Tightened current and maximum HP values around their separator.
- Reduced saving throw totals to sit just below AC values in visual weight.

## Changes in version 1.8.9

- Rebuilt HP indicators as custom outlined angular shapes with evenly spaced labels above them.
- Reduced saving throw total size to a stronger but balanced value.
- Added responsive layouts that prevent initiative and native trait editors from overlapping adjacent controls.

## Changes in version 1.8.8

- Identification now posts a separate standard Foundry roll for every item, including sound and expandable roll terms.
- Reworked HP controls into borderless heart, shield, and drop-shaped indicators.
- Increased saving throw totals and corrected native-editor gear alignment and dark-theme contrast.

## Changes in version 1.8.7

- Each item identification now makes its own Spellcraft roll and displays that roll with the matching result.
- Reworked the statistics HP display into compact, fillable health vessels.
- Improved saving throw emphasis, narrow combat layouts, and dark-theme contrast.
- Applied the selected personal background theme to the item-identification window.

## Changes in version 1.8.6

- Language chips now show only the Foundry tooltip, with speakers listed vertically.
- Fixed token-gallery filtering and compatibility warnings from Token Variant Art and Monster Knowledge.
- Restored the original bold combat-bonus typography and applied it consistently to every combat check.

## Changes in version 1.8.5

- Party token cards now have descriptive Russian names, bilingual search, stable square previews, and a larger hover preview.
- Saving throws, combat bonuses, initiative, size, travel speed, and language tooltips have been aligned and made easier to read.
- Fixed keyboard submission errors in the party-token gallery.

## Changes in version 1.8.4

- Rebuilt the defense statistics row with AC shields, combined saving-throw bonuses and a combined initiative control.
- Added visible language-speaker hints that respect player privacy and GM visibility.
- Added 399 bundled party-token choices and made `green-blank.webp` the default party image.
- Removed deprecated chat roll access and the fast-healing reapply action.
- Moved the public party snapshot out of actor flags and coalesced sheet renders to reduce third-party hook traffic.

## Changes in version 1.8.3

- Statistics stay inside their column, use compact horizontal category tabs, and adapt ability and movement fields to the sheet width.
- Special defenses are grouped by damage, energy, and conditions, with corrected Russian labels.
- Item identification supports all-items and selective modes.
- Fast-healing undo and reapply actions are available from the chat-message context menu.
- Removed unused metagame visibility options from the party settings.

## Changes in version 1.7.7

- Party Folder no longer changes the layout of Foundry's global tooltips.
- Clearing exploration activities now removes every assigned check.
- Access to party metagame settings is controlled by a minimum user role and defaults to Assistant GM.

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

## Изменения версии 1.8.2

- Статистика полностью удерживается в правой колонке, а карточки характеристик получили итоговое значение по центру.
- Скорости собраны в компактный ряд с иконками; в защите добавлены БМА, ЗБМ, МБМ и бонусы атак.
- Текущие ПЗ не могут превышать максимум, а особые защиты редактируются через штатные окна PF1.
- Добавлен выбор видимости статистики для игроков; мастер всегда видит всех участников папки партии.
- Быстрое лечение можно отменить или применить повторно по ПКМ.
- Улучшены таблицы и сообщения массового опознания предметов.

## Изменения версии 1.8.1

- Правая часть статистики больше не перекрывает боковую панель путешествия.
- Характеристики собраны в компактную горизонтальную строку и получили системные броски; добавлен бросок инициативы и иконки испытаний.
- Временные и нелетальные ПЗ получили отдельные голубой и серый слои на полосе здоровья.
- Быстрое лечение напоминает о себе в ход персонажа и применяется кнопкой из чата.
- Особые защиты получили расширенные поля и переход к нативному редактору листа персонажа.
- В опознании появился общий бросок Колдовства выбранным участником партии и настройка автоматического опознания успешных предметов.
- Пустые числовые значения теперь сохраняются как ноль.

## Изменения версии 1.8.0

- Во вкладку статистики возвращена боковая панель путешествия партии.
- Исправлено переключение всех четырёх категорий статистики, элементы сделаны крупнее и нагляднее.
- В таблицах опознания добавлены вертикальные разделители; немагические предметы больше не выводятся.

## Изменения версии 1.7.9

- Статистика использует всю ширину листа и разделена на четыре наглядные вкладки.
- Числовые поля принимают как новое значение, так и относительное изменение в формате `+5` или `-5`.
- Все виды КБ отображаются щитками, а управление опознанием тайника стало компактнее.
- Исправлено наложение поля веса на кнопку опознания.

## Изменения версии 1.7.8

- Вкладка «Исследование» заменена на «Статистику» без механики активностей; боковой расчёт передвижения партии сохранён.
- В статистике собраны редактируемые характеристики, ПЗ, скорости, размер, инициатива, испытания, КБ, УкМ и особые защиты персонажей.
- В тайник добавлены быстрые кнопки опознания и окно «Опознавание предметов» с отдельными таблицами опознанных и неопознанных предметов.
- Окно опознания показывает ауру, уровень заклинателя и СЛ опознания, включая предметы внутри контейнеров.

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
