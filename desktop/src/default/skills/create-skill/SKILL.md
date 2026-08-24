---
name: "create-skill"
description: "Writes a new reusable skill with detailed instructions from the user's description and saves it as a draft."
---

# Skill creation

A skill is a reusable instruction assigned to agents: it explains how one specific job is done. Turn the user's plain-language request into that instruction and save it with a single `skill_create` call.

## Procedure

1. Read the user's description.
2. Draft the slug, the name, and the one-line description.
3. Write the full instructions.
4. Select tools from the catalog supplied in a separate message.
5. Call `skill_create` exactly once.
6. Reply with one short sentence confirming the skill was created. Stop there.

## Hard rules

- Call `skill_create` exactly once.
- Never ask the user a clarifying question. Decide for them when something is missing.
- Write every generated value in Russian except the slug: the user reads them in a Russian interface.
- Use only tool `id` values present in the supplied catalog. Pass an empty list when nothing fits.
- A skill describes **how the work is done**, not **who does it**. Never write «ты — помощник по X»; write «чтобы сделать X, выполни следующие шаги».

## Fields

### slug

Lowercase Latin letters, digits, and hyphens. Two to five words.

Good: `email-triage`, `weekly-report-docx`, `csv-cleanup`
Bad: `Навык1`, `email_triage`, `my-super-mega-skill-for-everything`

### name

A Russian title of 2–5 words. This is the heading in the skill list.

### description

One sentence, 60–160 characters, in Russian, answering "when does this skill apply". The agent reads this description in the catalog and decides from it whether to load the full instructions, so it must carry the trigger words of the task.

Good: `Разбирает входящие письма: определяет тему, срочность и нужен ли ответ.`
Bad: `Навык для писем.`

### instructions

The field that carries the whole value of the skill. Write 400–900 words in Russian, addressed to someone doing this job for the first time who will not ask a follow-up question.

Follow this outline:

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

Text requirements:

- Every step in the imperative: «открой», «проверь», «сохрани».
- No «возможно», «желательно», «по ситуации». Where a choice exists, state the condition: «если X, то делай A, иначе делай B».
- Express thresholds and formats as numbers and examples, never as «немного» or «покороче».
- When the job produces text, include a template that can be copied as-is.
- Include at least one example of input and the expected result.

### requiredToolIds

Tools without which the skill is physically impossible to perform. A pure methodology skill — «как писать хорошие коммит-сообщения» — takes an empty list.

### version

Always `1.0.0` for a new skill.

## Example

Request: «навык, который приводит csv-файлы в порядок».

Call:

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

## Failure modes

- Instructions under 200 words: the skill carries no value.
- A description without the words someone would search for.
- A skill written as a role («ты — помощник...») instead of a method.
- Everything listed in `requiredToolIds`.
- A second `skill_create` call after the first one succeeded.
