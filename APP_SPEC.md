# המשימות שלי (Smart To-Do): מפרט מלא לבנייה מחדש

מסמך זה מתאר את כל מה שנבנה עד עכשיו: הארכיטקטורה, מודל הנתונים, הלוגיקה, ה-API, המסכים והעיצוב. אפשר להעביר אותו כמו שהוא לכלי בנייה אחר או למפתח, כדי לבנות את אותה אפליקציה מחדש.

---

## 1. מה האפליקציה עושה

אפליקציית משימות אישית שבנויה סביב לוח שנה. ממשק בעברית (RTL), למשתמש אחד, ורצה מקומית על המחשב.

יכולות עיקריות:
- משימות עם תאריך התחלה וסיום, אפשרות "כל היום", עדיפות (נמוכה/בינונית/גבוהה/דחופה), סטטוס, קטגוריה צבעונית, תגיות, מיקום או קישור, תיאור וצ'קליסט.
- **משימות חוזרות** (יומי, שבועי לפי ימים, חודשי לפי תאריך או "יום שלישי השני בחודש", שנתי), עם סיום "אף פעם", בתאריך או אחרי מספר פעמים.
  - עריכה ומחיקה של חזרה עם בחירה: **רק המופע הזה / המופע הזה וכל הבאים / כל המופעים** (כמו ביומן גוגל).
- **לוח שנה** עם תצוגת חודש, שבוע, יום ורשימה. אפשר לגרור משימה כדי להזיז אותה, למתוח קצה כדי לשנות את משך הזמן, ולבחור טווח ריק כדי ליצור משימה חדשה בו.
- **מסך "היום"**: משימות באיחור, משימות של היום עם טבעת התקדמות, ומשימות השבוע הקרוב.
- **רשימת כל המשימות** עם חיפוש, סינון לפי סטטוס, עדיפות וקטגוריה, מיון, וטעינה בעמודים.
- **תזכורות** (כמה לכל משימה, בדקות לפני). כשלא בוחרים תזכורות, המשימה מקבלת ברירת מחדל לפי העדיפות.
- **אזהרת חפיפה**: כשבוחרים זמן למשימה, מוצגות משימות אחרות שחופפות לאותו זמן.
- **כללים חכמים** שרצים ברקע:
  - "העבר להיום אם לא בוצעה" מזיז משימה שלא בוצעה מהימים הקודמים להיום.
  - העלאת עדיפות אוטומטית בדרגה אחת למשימה שמועד היעד שלה בתוך 24 שעות.
- **קבצים מצורפים**: העלאה, תצוגה מקדימה, הורדה, שינוי שם, הערה, שיוך למשימה ומחיקה. כרגע קיים רק בצד השרת.
- **ייצוא ל-Apple Numbers**: קובץ עם גיליון משימות, גיליון קטגוריות וגיליון קבצים, בעברית.
- **נקודת הרחבה לאינטגרציות** (למשל Gmail) שמייצרות משימות ממקורות חיצוניים.

---

## 2. טכנולוגיות

### צד שרת (backend/)
- Python 3.12, מנוהל עם `uv`
- FastAPI עם uvicorn
- SQLAlchemy 2 (ORM) ו-Alembic (מיגרציות)
- SQLite כברירת מחדל, במצב `foreign_keys=ON` ו-`journal_mode=WAL`. אפשר לעבור ל-Postgres דרך משתנה סביבה (צריך להוסיף גם דרייבר, למשל `psycopg`, שלא מותקן כרגע).
- APScheduler (AsyncIOScheduler) למשימות רקע
- `python-dateutil` לפענוח והרחבה של RRULE
- `numbers-parser` לייצוא קובץ Numbers
- `pydantic-settings` להגדרות, `python-multipart` להעלאת קבצים
- בדיקות: `pytest` ו-`httpx` (‏23 בדיקות)

### צד לקוח (frontend/)
- React 19, TypeScript ו-Vite
- Tailwind CSS v4 (דרך `@tailwindcss/vite`)
- TanStack Query v5 (מטמון נתונים, עדכונים אופטימיים, טעינה בעמודים)
- React Router v7
- FullCalendar v6 (daygrid, timegrid, list, interaction) עם locale עברי ו-`direction="rtl"`
- react-hook-form, zod ו-`@hookform/resolvers`
- Framer Motion לאנימציות, lucide-react לאייקונים, sonner להודעות toast, clsx
- Vitest, Testing Library ו-jsdom לבדיקות; oxlint ל-lint
- פונט Rubik מ-Google Fonts

### הרצה
- `./dev.sh` מריץ `npm install` אם `frontend/node_modules` חסרה (את תלויות השרת `uv run` מסנכרן לבד), מריץ את השרת על `http://127.0.0.1:8000` ואת הלקוח על `http://localhost:5173`, ופותח דפדפן.
- Vite מעביר (proxy) כל בקשה ל-`/api` אל השרת.
- תיקיית `data/` (מחוץ ל-git) מכילה את `smart_todo.db` ואת `uploads/`.

---

## 3. מבנה תיקיות

```
backend/
  app/
    main.py            – יצירת FastAPI, CORS, GZip, הרצת מיגרציות ו-scheduler בעלייה
    config.py          – הגדרות (prefix: SMARTTODO_)
    db.py              – engine, Session, pragmas של SQLite
    errors.py          – NotFound → 404, BadRequest → 400
    scheduler.py       – משימות רקע
    models/models.py   – טבלאות
    schemas/__init__.py– סכמות Pydantic (קלט/פלט)
    routers/           – tasks, categories, attachments, system
    services/          – tasks, recurrence, reminders, rules, settings, storage, export_numbers
    integrations/base.py – ממשק לאינטגרציות חיצוניות
  alembic/             – מיגרציה ראשונית
  tests/
frontend/src/
  main.tsx, App.tsx, index.css
  api/        client.ts, hooks.ts, types.ts
  components/ Layout, ScopeDialog, TaskRow, ui/(Badges, Button, CheckButton, EmptyState, Modal)
  features/   today/, calendar/, tasks/, editor/(TaskEditor, TaskForm, formModel), placeholder/
  i18n/he.ts  – כל הטקסטים והתוויות בעברית
  lib/        dates.ts, recurrence.ts, useDebounced.ts, useMediaQuery.ts
dev.sh
```

---

## 4. מודל הנתונים

**חשוב:** כל התאריכים נשמרים כ**זמן מקומי בלי אזור זמן** (naive), כי זו אפליקציה למשתמש אחד באזור זמן אחד. הלקוח שולח תמיד `YYYY-MM-DDTHH:mm:ss`.

### categories
| שדה | סוג | הערות |
|---|---|---|
| id | int PK | |
| name | str(80) | ייחודי |
| color | str(16) | ברירת מחדל `#6366f1`, בפורמט `#RRGGBB` |
| icon | str(40)? | |

### tags
`id`, `name` (str(60), ייחודי). טבלת הקשר `task_tags` (task_id, tag_id) מוגדרת עם CASCADE בשני הצדדים.

### tasks
| שדה | סוג | הערות |
|---|---|---|
| id | int PK | |
| title | str(200) | חובה |
| description | text? | |
| start_at | datetime? | |
| due_at | datetime? | סיום או יעד. חייב להיות ≥ start_at |
| all_day | bool | |
| priority | enum | low / medium / high / urgent (ברירת מחדל medium) |
| status | enum | todo / in_progress / done / cancelled (ברירת מחדל todo) |
| category_id | FK? | ON DELETE SET NULL |
| rrule | str(500)? | גוף RRULE לפי iCalendar, למשל `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10`. ה-DTSTART הוא ה-anchor |
| rollover | bool | "להעביר להיום אם לא בוצעה" |
| auto_bumped | bool | האם העדיפות כבר הועלתה אוטומטית (מתאפס כשמשנים תאריכים) |
| location | str(300)? | |
| source | str(40) | ברירת מחדל `manual`; לאינטגרציות למשל `gmail` |
| external_ref | str(300)? | מזהה חיצוני, למשל מזהה מייל, כדי לא ליצור כפילויות |
| created_at / updated_at | datetime | |

**anchor**: הזמן שבו המשימה "קורית" הוא `start_at`, ואם אין, `due_at`.
**משך**: אם יש גם start וגם due, המשך הוא `due_at - start_at`.
אינדקסים: start_at, due_at, status, category_id.

### task_occurrences: שינוי חד-פעמי במופע אחד של משימה חוזרת
`id`, `task_id` (CASCADE), `original_start` (מועד המופע המקורי; ייחודי יחד עם task_id), `status?`, `new_start?`, `new_due?`, `deleted` (bool).

### checklist_items
`id`, `task_id` (CASCADE), `text` (str(300)), `done`, `position`.

### reminders
`id`, `task_id` (CASCADE), `offset_minutes` (כמה דקות לפני ה-anchor), `last_fired_for` (ה-anchor של המופע שעבורו התזכורת כבר נשלחה, כדי שלא תישלח פעמיים).

### attachments
`id`, `task_id?` (ON DELETE SET NULL, כך שקבצים נשארים בספרייה גם כשמוחקים משימה), `original_name`, `stored_name` (שם ייחודי בפורמט uuid hex עם סיומת), `mime`, `size`, `sha256`, `note?`, `uploaded_at`.

### settings
`key` (PK), `value` (JSON). יש מפתח יחיד `"app"` שמכיל:
```json
{
  "auto_priority_bump": true,
  "default_reminders": { "low": [], "medium": [60], "high": [1440, 60], "urgent": [1440, 60, 15] }
}
```

---

## 5. לוגיקה עסקית

### 5.1 הרחבת משימות חוזרות (`services/recurrence.py`)
- המופעים לא נשמרים במסד. הם מחושבים לפי בקשה, רק עבור טווח התאריכים המבוקש, בעזרת `rrulestr(rrule, dtstart=anchor)`.
- `expand(task, from, to)` מחזירה את כל המופעים שחופפים ל-`[from, to)`:
  - משימה רגילה מחזירה מופע אחד (`original=None`).
  - משימה חוזרת: מחשבים את המופעים בין `from - משך` ל-`to`, ומוסיפים מופעים שהוזזו (`new_start`) אל תוך הטווח. מדלגים על `deleted`, ומחילים `new_start`, `new_due` ו-`status` מתוך הטבלה `task_occurrences`.
- `is_occurrence(task, when)` בודקת ש-`when` הוא באמת מופע של הסדרה.
- `truncate_before(task, when)` מחזירה כלל שמסתיים במופע הקודם: מסירה את COUNT ומוסיפה `UNTIL=<מופע קודם>`. אם לא נשאר אף מופע, מחזירה `None`.
- `remainder_from(task, when)` מחזירה כלל לסדרה חדשה שממשיכה מאותה נקודה. אם היה COUNT, מפחיתה ממנו את מספר המופעים שכבר עברו.

### 5.2 עריכת משימה חוזרת (`PATCH /api/tasks/{id}?scope=&occurrence=`)
- משימה לא חוזרת, או `scope=all`: מעדכנים את המשימה עצמה. אם השתנו `rrule`, `start_at` או `due_at` של סדרה, מוחקים את כל השינויים החד-פעמיים, כי הם כבר לא תואמים ללוח הזמנים החדש.
- `scope=this`:
  - אם השתנו רק `start_at`, `due_at` או `status`, נשמר override בטבלת `task_occurrences`. בסדרה שיש לה רק `due_at`, שינוי של `due_at` נשמר כ-`new_start`, כי זה מועד המופע.
  - בכל שינוי אחר, המופע **מתנתק** והופך למשימה חד-פעמית חדשה: מעתיקים את כל השדות, מאפסים rrule, מגדירים status=todo, מחילים את השינוי ומזיזים את הזמנים למועד המופע. המופע המקורי מסומן `deleted`.
- `scope=following`: אם זה המופע הראשון, מתנהגים כמו `all`. אחרת יוצרים משימה חדשה עם `remainder_from` והזמנים המוזזים, הסדרה הישנה מקבלת `truncate_before`, ו-overrides מהמופע הזה והלאה נמחקים.
- התשובה היא המשימה שמחזיקה עכשיו את השינוי. היא יכולה להיות משימה חדשה.
- כל עדכון הוא **חלקי**: רק שדות שנשלחו משתנים (`exclude_unset`).

### 5.3 מחיקה (`DELETE /api/tasks/{id}?scope=&occurrence=`)
- `this`: מסמנים את המופע כ-`deleted`.
- `following`: מקצרים את הסדרה עם `truncate_before`. אם לא נשאר אף מופע, מוחקים את כל המשימה.
- `all`: מוחקים את המשימה. הקבצים המצורפים נשארים, רק השיוך שלהם למשימה מתנתק.

### 5.4 סימון ביצוע (`POST /api/tasks/{id}/status` עם `{status, occurrence}`)
במשימה חוזרת חובה לשלוח `occurrence`, והסטטוס נשמר כ-override של אותו מופע. במשימה רגילה הסטטוס משתנה ישירות במשימה.

### 5.5 יצירה
- שמות התגיות מנורמלים (trim והסרת כפילויות). תגית שלא קיימת נוצרת אוטומטית.
- `reminders: null` פירושו ברירת המחדל לפי העדיפות, מתוך ההגדרות.
- הצ'קליסט נשמר עם `position` לפי הסדר שנשלח.
- ולידציות:
  - הסיום לא יכול להיות לפני ההתחלה.
  - משימה חוזרת חייבת תאריך.
  - ה-RRULE חייב להיות תקין. קידומת `RRULE:` מוסרת אם נשלחה.
  - הקטגוריה חייבת להתקיים.

### 5.6 לוח שנה, אג'נדה וחפיפות
- `calendar(from, to)` מחזירה רשימה של `CalendarEvent` ממוינת לפי התחלה. מזהה כל אירוע הוא `"{task_id}:{original_iso | single}"`.
  - כל אירוע כולל: task_id, occurrence, title, start, end, all_day, status, priority, color (צבע הקטגוריה), category_id, recurring, has_attachments.
- `agenda(days=7)` מחזירה שלוש קבוצות:
  - `overdue`: משימות חד-פעמיות פתוחות שה-anchor שלהן לפני היום, ומופעים פתוחים של משימות חוזרות מ-14 הימים האחרונים.
  - `today`: המשימות של היום.
  - `upcoming`: המשימות מחר ועד 7 ימים קדימה.
- `conflicts(start, end, exclude_task_id)` מחזירה משימות פתוחות עם שעה (לא "כל היום") שחופפות לטווח. משימה בלי סיום נחשבת כאורכת דקה אחת.
- "פתוחה" פירושו סטטוס `todo` או `in_progress`.

### 5.7 תזכורות (`services/reminders.py` ו-`scheduler.py`)
- בדיקה כל 30 שניות: לכל משימה עם תזכורות מרחיבים את המופעים, ולכל מופע פתוח מחשבים `fire_at = start - offset`.
- אם `fire_at` נמצא בטווח `(הבדיקה הקודמת, עכשיו]` וגם `last_fired_for != start`, התזכורת נשלחת ו-`last_fired_for` מתעדכן.
- הבדיקה הראשונה אחרי עליית השרת מסתכלת רק על 2 הדקות האחרונות, כך שתזכורות שהיו אמורות לצאת בזמן שהשרת היה כבוי לא נשלחות.
- התזכורות נשלחות לכל לשונית דפדפן פתוחה דרך **Server-Sent Events** בכתובת `GET /api/events`. ה-payload:
  `{type:"reminder", task_id, title, start, occurrence, offset_minutes, priority}`.
- בנוסף נשלחת הודעת keep-alive כל 20 שניות ו-`retry: 5000`.
- ⚠️ **עדיין לא מחובר בצד הלקוח**: הלקוח לא מאזין ל-`/api/events` ולא מציג התראות.

### 5.8 כללים חכמים (`services/rules.py`)
הכללים רצים בעליית השרת, ואחר כך בכל שעה בדקה 1:
- **rollover**: משימה חד-פעמית ופתוחה עם `rollover=true` שה-anchor שלה לפני היום מוזזת להיום, באותה שעה ביום. גם start וגם due זזים באותו מספר ימים.
- **bump**: אם `auto_priority_bump` פעיל, משימה חד-פעמית ופתוחה שעוד לא הועלתה ושמועד היעד שלה (`due` או `start`) בתוך 24 השעות הקרובות עולה בדרגת עדיפות אחת, ומסומנת `auto_bumped=true`. משימה דחופה לא עולה יותר.
- אם משהו השתנה, נשלח `{type:"refresh", moved, bumped}` ב-SSE.

### 5.9 קבצים (`services/storage.py`)
- סיומות מותרות: pdf, txt, md, rtf, csv, json, eml, doc(x), xls(x), ppt(x), odt, ods, pages, numbers, key, png, jpg, jpeg, gif, webp, heic, mp3, m4a, wav, mp4, mov, zip.
- גודל מקסימלי 50MB (ניתן להגדרה). הקובץ נכתב בחלקים של 1MB, ובמקביל מחושב sha256. אם מתרחשת שגיאה, הקובץ החלקי נמחק.
- הקובץ נשמר בשם uuid בתיקיית `data/uploads`. סוג ה-MIME נקבע לפי סיומת הקובץ.
- תצוגה בתוך הדפדפן (`?inline=true`) מותרת רק ל-image, pdf, text/plain, audio ו-video. כל סוג אחר יורד כקובץ. התשובה כוללת `X-Content-Type-Options: nosniff`.

### 5.10 ייצוא Numbers
`GET /api/export/numbers` מחזיר קובץ בשם `smart-todo-YYYY-MM-DD.numbers` עם שלושה גיליונות:
- **משימות**: מזהה, כותרת, תיאור, התחלה, סיום, כל היום, עדיפות, סטטוס, קטגוריה, תגיות, חזרה, מיקום, תזכורות, צ'קליסט (✓ או ☐), נוצר.
- **קטגוריות**
- **קבצים**

העדיפויות והסטטוסים מתורגמים לעברית.

### 5.11 אינטגרציות
מחלקה אבסטרקטית `Integration` עם `source` ופונקציה `fetch()` שמחזירה רשימה של `ExternalItem(external_ref, title, description, due_at, tags)`. השדות `source` ו-`external_ref` נועדו לכך שבסנכרון, משימה שכבר קיימת תתעדכן במקום להיווצר שוב. **עדיין לא קיים קוד סנכרון ואין אף מימוש של הממשק**: יש רק המחלקה האבסטרקטית.

---

## 6. API (כל הנתיבים מתחת ל-`/api`)

| Method | Path | תיאור |
|---|---|---|
| GET | `/tasks` | פרמטרים: `q, status[], priority[], category_id, tag, has_attachments, sort(anchor/priority/created/title), limit≤500, offset`. מחזיר `{items, total}` |
| POST | `/tasks` | יצירת משימה (`TaskCreate`), תשובה 201 |
| GET | `/tasks/{id}` | משימה מלאה (`TaskOut`) |
| PATCH | `/tasks/{id}?scope=this/following/all&occurrence=ISO` | עדכון חלקי |
| DELETE | `/tasks/{id}?scope=&occurrence=` | תשובה 204 |
| POST | `/tasks/{id}/status` | `{status, occurrence}` |
| GET | `/calendar?start=&end=` | רשימת `CalendarEvent` |
| GET | `/calendar/conflicts?start=&end=&exclude_task_id=` | משימות חופפות |
| GET | `/agenda?days=7` (‏1–60) | `{overdue, today, upcoming}` |
| GET/POST | `/categories` | |
| PATCH/DELETE | `/categories/{id}` | שם כפול מחזיר 400 |
| GET/POST | `/tags`, PATCH/DELETE `/tags/{id}` | |
| GET | `/attachments?task_id=&unlinked=&q=` | `q` מחפש בשם הקובץ ובהערה. ממוין מהחדש לישן |
| POST | `/attachments` | multipart: `files[]`, `task_id?`, `note?` |
| GET | `/attachments/{id}/download?inline=` | |
| PATCH | `/attachments/{id}` | `{original_name?, note?, task_id?}` |
| DELETE | `/attachments/{id}` | |
| GET/PUT | `/settings` | `AppSettings` |
| GET | `/export/numbers` | |
| GET | `/events` | SSE |
| GET | `/health` | |

**TaskCreate / TaskUpdate** כוללים: `title, description, start_at, due_at, all_day, priority, status, category_id, tags: string[], rrule, rollover, location, checklist: [{text, done}], reminders: number[] | null`.
**TaskOut** כולל גם: `id, category{...}, tags[{id,name}], source, reminders: number[], checklist[{id,text,done}], attachments[{id,original_name,mime,size}], created_at, updated_at`.
שגיאות מוחזרות בפורמט `{detail: string}` או בפורמט ולידציה של FastAPI (רשימה עם `msg`).

---

## 7. צד לקוח

### 7.1 שכבת API
- `client.ts`: עטיפה ל-`fetch` שבונה query string (מערכים נשלחים כמפתח חוזר) ומתרגמת שגיאות להודעה קריאה. בתשובת שגיאה בלי JSON מוצגת ההודעה "שגיאה (קוד)". בתשובה מוצלחת שאינה JSON (למשל כשה-proxy מחזיר דף HTML) מוצגת השגיאה "השרת לא זמין".
- `hooks.ts` (TanStack Query):
  - `useAgenda`: רענון כל 60 שניות.
  - `useCalendar(start,end)`: עם `keepPreviousData`.
  - `useTaskList`: טעינה אינסופית בעמודים של 50.
  - `useCategories`, `useTags`: נשמרים במטמון 5 דקות.
  - `useTask`: משתמש בברירת המחדל (15 שניות).
  - `useConflicts`: נשמר במטמון 30 שניות.
  - `useSaveTask`, `useMoveTask`, `useDeleteTask`, `useCreateCategory`.
  - `useSetStatus`: **עדכון אופטימי** של סטטוס באג'נדה ובלוח השנה, עם חזרה למצב הקודם אם יש שגיאה.
  - אחרי כל שינוי מבוטל המטמון של calendar, agenda, tasks, task ו-tags.
  - שגיאות מוצגות כ-toast.
- הגדרות QueryClient: `staleTime 15s`, `retry 1`, `refetchOnWindowFocus`.

### 7.2 ניווט ומבנה מסך
- ניתובים:
  - `/` היום
  - `/calendar` לוח שנה
  - `/tasks` משימות
  - `/files` קבצים (מסך "בבנייה")
  - `/settings` הגדרות (מסך "בבנייה")
- כל מסך נטען רק כשנפתח לראשונה (`lazy`), עם skeleton בזמן הטעינה.
- **מחשב**: סרגל צד ברוחב 240px עם לוגו, "המשימות שלי", פריטי ניווט עם סימון פעיל מונפש (`layoutId`) וכפתור "משימה חדשה" בגרדיאנט indigo→purple בתחתית.
- **מובייל** (פחות מ-768px): סרגל ניווט תחתון קבוע עם safe-area, וכפתור + צף.
- מעבר בין מסכים בתנועת fade וגלישה קלה.
- `Toaster` של sonner ממוקם למעלה במרכז, ב-RTL. `MotionConfig reducedMotion="user"` מכבד את הגדרת המערכת להפחתת תנועה.

### 7.3 מסך "היום"
- ברכה לפי השעה: בוקר טוב (עד 12), צהריים טובים (עד 17), ערב טוב (עד 21), לילה טוב.
- תאריך מלא בעברית, וטבעת התקדמות SVG מונפשת שמציגה כמה מתוך משימות היום בוצעו. הטבעת מוצגת רק כשיש משימות היום.
- קבוצות: "באיחור" (מוצגת רק אם יש בה משימות), "היום" (עם מצב ריק "אין משימות להיום") ו-"בשבוע הקרוב" (עם הטקסט "אין משימות מתוכננות לשבוע הקרוב." כשהיא ריקה).
- כל שורה מציגה:
  - פס צבע בצד (צבע הקטגוריה, או צבע העדיפות אם אין קטגוריה).
  - כפתור סימון עגול עם אנימציית וי ו"פיצוץ" של 6 נקודות.
  - כותרת (עם קו חוצה אם בוצעה), זמן ("היום · 09:00", "מחר", "אתמול" או תאריך), ואייקונים של חזרה וקובץ מצורף.
  - תג עדיפות.
- לחיצה על שורה פותחת את העורך.
- במצב שגיאה מוצגים "לא הצלחנו לטעון את המשימות" וכפתור "נסו שוב".

### 7.4 מסך לוח שנה
- FullCalendar בעברית וב-RTL, השבוע מתחיל ביום ראשון, שעות בפורמט 24 שעות, וגלילה התחלתית לשעה 07:00.
  - קו מציין את השעה הנוכחית, ומוצגים עד 3 אירועים ביום בתצוגת חודש.
- **מחשב**: תצוגת חודש כברירת מחדל, עם כפתורי חודש, שבוע, יום ורשימה.
- **מובייל**: תצוגת רשימה שבועית כברירת מחדל, עם בורר תצוגות בתחתית.
- הנתונים נטענים רק לטווח שמוצג (`datesSet`).
- צבע אירוע הוא צבע הקטגוריה, או צבע העדיפות. אירוע שבוצע או בוטל מקבל class בשם `ev-done`.
- לסיום של אירוע "כל היום" מוסיפים יום אחד בתצוגה, כי ב-FullCalendar הסיום הוא exclusive ובמסד הוא היום האחרון עצמו.
- בחירת טווח פותחת את העורך עם הטווח מולא מראש. לחיצה על אירוע פותחת אותו לעריכה.
- **גרירה או שינוי אורך**:
  - במשימה חוזרת נפתח קודם דיאלוג בחירת היקף. ביטול מחזיר את האירוע למקומו.
  - בהיקף `all`, כל הסדרה זזה באותו הפרש זמן, ושינוי אורך חל על משך הסדרה.
  - משימה עם `due` בלבד מעדכנת את `due_at`. מופע בודד שהוזז נשמר כ-start חדש.
  - מעבר בין "כל היום" לשעה מעדכן את `all_day`.
  - אם יש שגיאה, האירוע חוזר למקומו.
- `longPressDelay` הוא 350ms, לנוחות במגע.

### 7.5 מסך "כל המשימות"
- חיפוש עם השהיה (debounce) של 300ms.
- צ'יפים לסינון סטטוס (ברירת המחדל: "לביצוע" ו"בתהליך") וצ'יפים לעדיפות עם נקודת צבע.
- בחירת קטגוריה ומיון: לפי תאריך, לפי עדיפות, החדשות ביותר, לפי שם.
- שורה מציגה זמן, תיאור החזרה ("כל 2 שבועות"), קטגוריה, התקדמות הצ'קליסט, מספר קבצים ותגיות (#).
- במשימה חוזרת מוצג אייקון חזרה במקום כפתור סימון, כי מסמנים מופע מסוים דרך מסך היום או לוח השנה.
- כפתור "טעינת עוד" לעמוד הבא, ומונה כולל בכותרת.
- לשורות יש `content-visibility: auto`, כדי שרשימות ארוכות יישארו מהירות.

### 7.6 עורך משימה (מגירה)
- נפתח מכל מקום דרך `useTaskEditor()`:
  - `openEditor()` למשימה חדשה.
  - `openEditor({taskId, occurrence})` לעריכה.
  - `openEditor({defaults:{start,end,allDay}})` למשימה חדשה עם ערכים מוכנים.
- **מחשב**: פאנל ברוחב 480px שנכנס מהצד השמאלי (בגלל ה-RTL). **מובייל**: bottom sheet בגובה עד 94dvh עם ידית. רקע מטושטש מאחור.
- שדות, לפי הסדר:
  1. **כותרת** גדולה ("מה צריך לעשות?")
  2. **תאריכים**:
     - מתג "כל היום". בהדלקתו השדות עוברים ל-`date`. בכיבויו הם עוברים ל-`datetime-local` עם 09:00 כברירת מחדל.
     - שדות התחלה וסיום/יעד (הסיום לא חובה).
     - אזהרת חפיפה בצבע ענבר, עם עד 3 משימות חופפות. הבדיקה מושהית 400ms, ובלי סיום נבדקות 30 הדקות הראשונות.
  3. **חזרה**:
     - צ'יפים: ללא, יומי, שבועי, חודשי, שנתי.
     - שדה "כל N ימים/שבועות/…".
     - בשבועי: כפתורי ימים א׳ עד ש׳.
     - בחודשי: "ב-X בכל חודש" או "ביום שלישי השני בחודש". שבוע אחרון בחודש מתורגם ל-`-1`.
     - סיום: אף פעם, בתאריך, או אחרי N פעמים.
  4. **עדיפות**: בורר מפולח עם "גלולה" צבעונית מונפשת. **סטטוס** מוצג רק בעריכה.
  5. **קטגוריה ותגיות**:
     - בחירת קטגוריה, וכפתור + ליצירת קטגוריה חדשה (שם ופלטת 7 צבעים).
     - תגיות כצ'יפים. Enter או פסיק מוסיפים תגית, Backspace מוחק את האחרונה, ומוצגות הצעות מתגיות קיימות.
  6. **תזכורות**: "לפי ברירת המחדל לעדיפות X" עם כפתור "התאמה אישית", או צ'יפים מתוך: בזמן, 5, 15, 30 דקות, שעה, שעתיים, יום, יומיים, שבוע.
  7. **צ'קליסט** עם פס התקדמות, סימון, עריכה במקום, מחיקה והוספה.
  8. **תיאור**, **מיקום/קישור**, ומתג "אם לא בוצעה בזמן – להעביר אוטומטית להיום".
- **ולידציה עם zod** (הודעות בעברית):
  - כותרת חובה.
  - הסיום חייב להיות אחרי ההתחלה.
  - אם יש סיום, חייבת להיות גם התחלה.
  - משימה חוזרת צריכה תאריך.
  - תאריך הסיום של החזרה חייב להיות אחרי ההתחלה.
- **שמירה**:
  - משימה חדשה נשלחת ב-POST.
  - בעריכה נשלחים **רק השדות שהשתנו** (diff).
  - במופע של סדרה נפתח קודם דיאלוג היקף. אם בוחרים "כל המופעים" אחרי ששונה התאריך של המופע הנוכחי, ההזזה מתורגמת להזזה של כל הסדרה (`shiftSeriesTimes`).
  - בעריכת מופע, הטופס מציג את התאריך והסטטוס של המופע עצמו.
  - משימה עם תאריך יעד בלבד מוצגת בשדה אחד בשם "יעד", ושינוי שלו משנה את `due_at`. אם מוסיפים סיום, המשימה הופכת למשימה עם התחלה וסיום.
- **מחיקה**: במשימה חוזרת נפתח דיאלוג היקף. במשימה רגילה נפתח אישור עם ההערה "קבצים שצורפו יישארו בספריית הקבצים".

### 7.7 דיאלוג היקף
ספק גלובלי בשם `useAskScope()`. הקריאה `await askScope('edit' | 'delete' | 'confirm-delete')` מחזירה `this`, `following`, `all` או `null`. הכפתורים: "רק המופע הזה", "המופע הזה וכל הבאים", "כל המופעים" ו"ביטול".

### 7.8 עיצוב
- `<html lang="he" dir="rtl">`, `theme-color #4f46e5`, פונט Rubik.
- שימוש עקבי ב-logical properties (`start`, `end`, `ms`, `ps`) כדי שהממשק יעבוד נכון ב-RTL.
- צבע המותג indigo: ‏50 `#eef2ff`, ‏100 `#e0e7ff`, ‏500 `#6366f1`, ‏600 `#4f46e5`, ‏700 `#4338ca`. הגרדיאנטים עוברים ל-purple-500.
- משתני צבע:

| משתנה | מצב בהיר | מצב כהה (לפי `prefers-color-scheme`) |
|---|---|---|
| bg | `#f6f7fb` | `#0f1120` |
| surface | `#ffffff` | `#171a2c` |
| surface-2 | `#f1f3f9` | `#1f2338` |
| border | `#e4e7ef` | `#2a2f48` |
| text | `#1c2033` | `#e8eaf4` |
| muted | `#6b7189` | `#9aa0bb` |

- צבעי עדיפות: נמוכה slate `#94a3b8`, בינונית sky `#0ea5e9`, גבוהה amber `#f59e0b`, דחופה rose `#f43f5e`.
- פלטת קטגוריות: `#6366f1 #0ea5e9 #10b981 #f59e0b #f43f5e #a855f7 #64748b`.
- כרטיסים מעוגלים (rounded-2xl או 3xl) עם צל עדין. שדות קלט (`.field`) מעוגלים, עם טבעת פוקוס בצבע המותג.
- אנימציות spring בכל מקום: צ'יפים, מתגים, רשימות עם `layout`, כניסה ויציאה של פריטים.

### 7.9 עזרים
- `lib/dates.ts`:
  - `toLocalISO` מחזירה זמן מקומי בלי אזור זמן.
  - `parseLocal` מפענחת מחרוזת כזמן מקומי.
  - `formatWhen` מחזירה "היום", "מחר", "אתמול" או תאריך, עם שעה.
  - פורמט `Intl` בשפה `he-IL`.
- `lib/recurrence.ts`: `buildRRule`, `parseRRule`, `describeRRule` ו-`nthWeekday`.
- `i18n/he.ts`: כל התוויות בעברית (עדיפויות, סטטוסים, היקפים, ימי השבוע ואפשרויות התזכורת).

---

## 8. בדיקות שקיימות
- **backend** (`uv run pytest`, ‏23 בדיקות):
  - יצירה, עדכון ומחיקה של משימות, חזרות עם this/following/all, ומופעים שהוזזו.
  - לוח שנה, אג'נדה וחפיפות.
  - קבצים (סיומות, גודל, תצוגה בדפדפן), rollover, העלאת עדיפות וייצוא Numbers.
  - בבדיקות משתמשים ב-DB זמני ומכבים את ה-scheduler.
- **frontend** (`npm test`, ‏15 בדיקות בקובץ `formModel.test.ts`):
  - ולידציה, המרות בין הטופס ל-API, diff והזזת סדרה.
  - `lib/recurrence.ts`: הלוך-חזור של RRULE, "יום שישי האחרון" מול "יום שלישי השני", ותאריך סיום כולל.

---

## 9. מה עוד לא נבנה (השלבים הבאים)
1. **מסך קבצים**: העלאה (גרירה), רשימה וחיפוש, תצוגה מקדימה, שינוי שם והערה, שיוך למשימה ומחיקה. ה-API כבר קיים.
2. **מסך הגדרות**:
   - ניהול קטגוריות (עריכה, צבע ומחיקה) ותגיות.
   - תזכורות ברירת מחדל לכל עדיפות, ומתג להעלאת עדיפות אוטומטית.
   - כפתור ייצוא ל-Numbers.
   - ה-API כבר קיים.
3. **קבצים בתוך עורך המשימה**: הצגה, העלאה וניתוק של קבצים.
4. **האזנה ל-SSE** (`/api/events`) בצד הלקוח: הצגת התראת דפדפן או toast לתזכורות, ורענון הנתונים באירוע `refresh`.
5. **אינטגרציית Gmail** על בסיס `integrations/base.py`.
6. אופציונלי: מעבר ל-Postgres, דרך `SMARTTODO_DATABASE_URL` (צריך להוסיף דרייבר).


---

## 10. הגדרות סביבה (prefix `SMARTTODO_`, או קובץ `backend/.env`)
| משתנה | ברירת מחדל |
|---|---|
| `DATA_DIR` | `<root>/data` |
| `DATABASE_URL` | ריק, ואז `sqlite:///data/smart_todo.db` |
| `MAX_UPLOAD_MB` | 50 |
| `CORS_ORIGINS` | `http://localhost:5173` ו-`http://127.0.0.1:5173` |
| `RUN_SCHEDULER` | true |
