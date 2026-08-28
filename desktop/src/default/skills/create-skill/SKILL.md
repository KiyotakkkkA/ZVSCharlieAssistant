---
name: "create-skill"
description: "Writes a new reusable skill with detailed instructions from the user's description and saves it as a draft."
---

# Skill creation

A skill is a reusable how-to that agents can pull in: it spells out how one specific job gets done, step by step. Take the user's plain-language request and turn it into that instruction, then save it with one `skill_create` call.

## How this goes

1. Read what they asked for.
2. Work out the slug, the name, and the one-liner.
3. Write the full instructions — this is where the real work is.
4. Pick tools from the catalog you're given.
5. Call `skill_create` once.
6. Say one short sentence confirming it's done, and stop there.

## Ground rules

- One `skill_create` call, and you're finished.
- Make the calls yourself. Reach for `ask_user` only when you're genuinely stuck on something that would blow up the result if you guessed wrong — once or twice at most, never for stuff you can reasonably work out.
- Everything except the slug is in Russian — that's what the user reads.
- Tool ids must come from the catalog you're given. Nothing invented; empty list if nothing fits.
- A skill describes **how the work gets done**, not **who's doing it**. Never write «ты — помощник по X» — write «чтобы сделать X, выполни следующие шаги».

## The fields, one by one

### slug

Lowercase Latin letters, digits, hyphens. Two to five words.

Good: `email-triage`, `weekly-report-docx`, `csv-cleanup`
Bad: `Навык1`, `email_triage`, `my-super-mega-skill-for-everything`

### name

A Russian title, 2–5 words. This is the heading wherever the skill shows up in the list.

### description

One sentence, 60–160 characters, Russian, answering "when does this apply". An agent decides whether to pull in the full instructions based on this line alone, so it needs to actually contain the words someone would search for.

Good: `Разбирает входящие письма: определяет тему, срочность и нужен ли ответ.`
Bad: `Навык для писем.`

### instructions

This field carries the entire value of the skill — everything else is just packaging. Write 400–900 words, Russian, aimed at someone doing this exact job for the first time who won't get a chance to ask a follow-up question.

Shape it like this:

```
## Когда применять
Один абзац: в каких ситуациях навык подходит, а в каких — нет.

## Что понадобится
Входные данные. Что делать, если чего-то из них нет.

## Порядок работы
4–10 нумерованных шагов. Один шаг — одно действие и признак,
что шаг выполнен.

## Правила и детали
Форматы, единицы, пороги, названия полей, шаблоны текста.
Примеры «хорошо / плохо».

## Проверка результата
Что перепроверить перед выдачей ответа.

## Типичные ошибки
3–6 пунктов: что делают неправильно и как правильно.
```

A few things that matter for how this reads:

- Every step in the imperative: «открой», «проверь», «сохрани».
- No «возможно», «желательно», «по ситуации» — if there's a real choice, spell out the condition: «если X, то делай A, иначе делай B».
- Thresholds and formats as numbers and concrete examples, never as «немного» or «покороче».
- If the job produces text, hand over a template that can be copied as-is.
- At least one worked example: input in, expected result out.

### requiredToolIds

Tools the skill literally cannot work without. A pure methodology skill — «как писать хорошие коммит-сообщения» — needs none at all.

### version

Always `1.0.0` for something new.

## Worked example

Request: «навык, который приводит csv-файлы в порядок».

```json
{
  "slug": "csv-cleanup",
  "name": "Приведение CSV в порядок",
  "description": "Чистит выгруженные CSV-файлы: чинит заголовки, убирает пустые строки и приводит типы колонок.",
  "requiredToolIds": [],
  "version": "1.0.0",
  "instructions": "## Когда применять\nПрименяй, когда пользователь дал CSV-файл выгрузки и просит его почистить, привести в порядок или подготовить к анализу. Не применяй, если нужно посчитать метрики или построить график — это другая работа.\n\n## Что понадобится\nПуть к исходному файлу и понимание, что в нём за данные. Если пользователь не сказал, что за файл, — открой первые 20 строк и определи сам. Если файл не читается как CSV, скажи об этом и остановись.\n\n## Порядок работы\n1. Определи разделитель. Проверь запятую, точку с запятой и табуляцию — выбери тот, при котором число колонок одинаково в первых десяти строках.\n2. Найди строку заголовков. Обычно это первая непустая строка, где все значения текстовые и не повторяются.\n3. Удали строки выше заголовка: подписи выгрузки, даты формирования, пустые строки.\n4. Приведи имена колонок к нижнему регистру, пробелы замени на подчёркивания, убери спецсимволы. Дубли имён разведи суффиксами `_2`, `_3`.\n5. Удали полностью пустые строки и полностью пустые колонки.\n6. Приведи типы: числа — к числам, даты — к формату `ГГГГ-ММ-ДД`, булевы значения — к `true` и `false`.\n7. Сохрани результат рядом с исходником, добавив к имени суффикс `_clean`.\n\n## Правила и детали\nДесятичный разделитель в результате — точка. Разделитель тысяч убирай. Кодировка результата — UTF-8 без BOM.\n\nХорошо: колонка `Дата продажи` → `data_prodazhi`, значение `01.03.2026` → `2026-03-01`.\nПлохо: колонка `Дата продажи` → `Дата продажи`, значение осталось `01.03.2026`.\n\nИсходный файл не перезаписывай никогда.\n\n## Проверка результата\n- Число колонок одинаково во всех строках.\n- В именах колонок нет пробелов и заглавных букв.\n- Ни одна колонка не потеряла все значения после приведения типов.\n- Число строк не уменьшилось больше чем на 10% — если уменьшилось, объясни почему.\n\n## Типичные ошибки\n- Заголовок ищут строго в первой строке, хотя выше него две служебные.\n- Числа с запятой как десятичным разделителем превращают в текст.\n- Даты приводят к формату `ДД.ММ.ГГГГ` вместо `ГГГГ-ММ-ДД`.\n- Перезаписывают исходный файл.\n- Молча удаляют строки с ошибками вместо того, чтобы сообщить о них."
}
```

## Where this usually goes wrong

- Instructions under 200 words — at that length the skill isn't carrying any real value.
- A description that skips the words someone would actually search for.
- A skill written as a role («ты — помощник...») instead of a method.
- Every tool in the catalog dumped into `requiredToolIds`.
- Calling `skill_create` a second time after the first call already worked.
