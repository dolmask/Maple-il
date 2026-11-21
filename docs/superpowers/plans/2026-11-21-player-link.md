# התחברות עם שם הדמות: תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** שחקן מקליד את שם הדמות שלו, מאשר, ומאז האתר מציג את הדמות האמיתית, מתעדכן לבד ומברך על עליית רמה עם מה שנפתח.

**Architecture:** לוגיקה טהורה ב-`src/lib/player.js` (נבדקת ב-Node, מועתקת לדפדפן כ-`assets/lib/player.js` כמו שאר `src/lib`). מודול דפדפן `src/assets/player.js` שנטען בכל עמוד: חלון התחברות, רענון ברקע, ברכה. התקשורת עם "הדמות שלי" ועם הצ'יפ דרך localStorage ואירוע `player:change` על `window`.

**Tech Stack:** JavaScript ES modules בלי תלויות, `node --test`, אתר סטטי (`node build.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-21-player-link-design.md`

## Global Constraints

- בלי שרת, בלי סיסמה, בלי תלויות חדשות. שום מידע לא נשלח לשום מקום חוץ מ-ClassicRank (חיפוש ורענון).
- לא מופיעה המילה "מאומת" על דמות מחוברת.
- לא חוסמים שום חלק מהאתר למי שלא התחבר.
- רענון: לכל היותר בקשה אחת ל-30 דקות לגולש (`REFRESH_MS = 30 * 60 * 1000`).
- API חי: `https://classicrank.com/api/v1/characters/<name>?fields=all` (כמו `LIVE_API` ב-`src/assets/ranking.js`). נפילה ל-`ranking/data.json` דרך `findPlayer` הקיים.
- קישור גלוי ל-classicrank.com בחלון ההתחברות.
- localStorage: מפתח חדש `player`; ממשיכים לכתוב `me` ו-`meView` הקיימים. כל גישה בתוך try/catch.
- טקסטים בעברית בסגנון האתר; עיצוב בשכבת "מייפל" שבסוף `src/assets/style.css`, לפני כללי הניגודיות הגבוהה.

## Review Focus

1. **שם עם רווחים/אותיות גדולות/רווח בסוף** — החיפוש מוצא את הדמות (trim, השוואה בלי תלות ברישיות דרך `findPlayer`); השם שנשמר הוא השם הקנוני מה-API. בדיקה ב-Task 1 (`normalizePlayer`).
2. **ה-API מחזיר מבנה לא צפוי** (`{data:[]}`, `null`, HTML של שגיאה, 429) — "לא מצאנו", בלי קריסה; ברענון: שקט, הנתונים הקודמים נשארים. בדיקה ב-Task 1 + טיפול ב-Task 3.
3. **רמה ב-ClassicRank נמוכה מהרמה הידנית** (עדיין לא נסרק) — מוצגת הרמה הגבוהה, ואין ברכה כפולה כשהנתונים מדביקים. בדיקה ב-Task 1 (`effectiveLevel`, `levelGain`).
4. **מקצוע לא מוכר או מתחיל** — הדמות מחוברת, `cls` נשאר ידני / `beginner`. בדיקה ב-Task 1 (`toMe`).
5. **קפיצה של כמה רמות** (חזר אחרי שבוע) — ברכה אחת, "עלית N רמות", עד 3 שורות. בדיקה ב-Task 1 (`unlocks`).

---

### Task 1: לוגיקה טהורה (`src/lib/player.js`)

**Files:**
- Create: `src/lib/player.js`
- Modify: `src/lib/character-data.js` (להוסיף `journey` לפלט של `buildCharacterData`)
- Test: `test/player.test.mjs`

**Interfaces:**
- Consumes: `jobInfo` מ-`./ranking-data.js`; מבנה `character/data.json`: `{ classes: {key:{first, branches:[{slug}]}}, guides:[{slug,title,range,cls,cat}], tables:{slug:[{kind,heading,head,sep,rows:[{a,b,line}]}]}, journey:[{lv,label,slug}] }`.
- Produces:
  - `REFRESH_MS: number`
  - `normalizePlayer(body: any, now = Date.now()) -> Player | null` כש-`Player = { name, display, level:number, job, photo, checked:ISO string }`. מקבל `{data:{…}}` או אובייקט שטוח עם `name`; מערך/ריק/בלי `name`/`level` לא מספר → `null`. `photo` רק אם מתחיל ב-`https://`, אחרת `''`.
  - `toMe(player, classes) -> { cls, lv, branch }`: `cls` = משפחה מ-`jobInfo` אם קיימת ב-`classes`, אחרת `null`. `branch` = `jobInfo(job).guide` אם הוא אחד מ-`classes[cls].branches`, אחרת `''`.
  - `needsRefresh(player, now = Date.now()) -> boolean`: אין `checked` או עברו יותר מ-`REFRESH_MS`.
  - `effectiveLevel(manualLv, player) -> number`: המקסימום.
  - `levelGain(seenLevel, level) -> { from, to } | null`: רק אם `seenLevel` מספר ו-`level > seenLevel`.
  - `unlocks(D, me, from, to) -> Unlock[]` (לכל היותר 3), `Unlock = { type:'milestone'|'item'|'guide', label, slug?, head?, sep?, line? }`. סדר עדיפות: אבני דרך, אחר כך פריטים, אחר כך מדריכים. "נחצה" = `from < x <= to`.
    - milestone: מתחיל עם `classes[cls].first` (10, קוסם 8) → "הגיע הזמן לבחור מקצוע" (`choosing-a-class`), 30 → "הג'וב השני" (`second-job-advancement`), וכל שלב `journey` שה-`lv` המספרי הראשון שלו (`parseRange`) נחצה.
    - item: שורות מטבלאות `kind === 'weapons'` של מדריך המקור (ענף אם `to >= 30` ויש `branch`, אחרת מדריך המקצוע) עם `row.a` שנחצה; `label` = `heading`.
    - guide: מדריכים שמתאימים למקצוע (`!g.cls || g.cls === me.cls`) ו-`range[0]` נחצה.

- [ ] **Step 1: Write the failing tests** ב-`test/player.test.mjs`:
  - `normalizePlayer` מקבל `{data:{name:'Snail',level:47,job:'Assassin',photo:'https://x/p.png'}}` ומחזיר `level:47, display:'Snail'` ו-`checked` כ-ISO של `now`; גם אובייקט שטוח; `display_name` אם קיים נכנס ל-`display`.
  - `normalizePlayer` מחזיר `null` עבור `{data:[]}`, `null`, `'<html>'`, `{name:'x'}` בלי level; `photo:'http://x'` → `''`.
  - `toMe({job:'Assassin',level:47}, classes)` → `{cls:'thief', lv:47, branch:'assassin'}`; `job:'Thief'` → `branch:''`; `job:'Beginner'` → `cls:'beginner'`; `job:'Dark Knight'` → `cls:null`.
  - `needsRefresh`: `checked` לפני 29 דקות → `false`, לפני 31 → `true`, חסר → `true`.
  - `effectiveLevel(50, {level:48}) === 50`, `effectiveLevel(45, {level:48}) === 48`.
  - `levelGain(47, 50)` → `{from:47,to:50}`; `levelGain(50, 50)`, `levelGain(51, 50)`, `levelGain(undefined, 50)` → `null`.
  - `unlocks` עם fixture קטן: מ-29 ל-31 לגנב עם ענף `assassin` → האיבר הראשון milestone עם `slug:'second-job-advancement'`; מ-20 ל-60 → `length === 3`; מ-47 ל-47 → `[]`; שורת נשק ב-`a:35` מופיעה עבור 34→35 ולא עבור 35→36.
  - `buildCharacterData` מחזיר `journey` זהה ל-`config.journey`.

- [ ] **Step 2: Run** `node --test test/player.test.mjs` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** את `src/lib/player.js` לפי ה-Interfaces, ו-`journey: config.journey || []` ב-`buildCharacterData`.
- [ ] **Step 4: Run** `node --test test/*.test.mjs` — Expected: כל הבדיקות עוברות.
- [ ] **Step 5: Commit** `feat: לוגיקת התחברות עם שם הדמות`

### Task 2: מעטפת העמוד (`render.js`)

**Files:**
- Modify: `src/lib/render.js` (בכותרת וליד `levelUp`, לפני `</body>`)
- Test: `test/render-ranking.test.mjs` (או קובץ חדש `test/render-player.test.mjs` באותו סגנון)

**Interfaces:**
- Produces (מזהים ב-DOM שה-Tasks הבאים משתמשים בהם):
  - `#loginDialog` — `<div role="dialog" aria-modal="true" aria-labelledby="loginTitle" hidden>` בעיצוב `panel-bar` כמו `#a11yPanel`, עם `#loginForm` (input `name="name"`, `dir="auto"`, `autocomplete="off"`), `#loginResult` (`aria-live="polite"`), כפתור סגירה `[data-login-close]`, ושורה "בלי סיסמה. נשמר רק בדפדפן שלכם. הנתונים מ-<a href="https://classicrank.com">ClassicRank</a>".
  - `#playerToast` — `<div class="levelup player-toast" role="status" hidden>`, נפרד מ-`#levelUp` של המדריכים.
  - `<script type="module" src=".../assets/player.js">` בכל עמוד (עם `?v=` כמו האחרים). רק כש-`rankingOn(ctx)`; אחרת לא נטען וגם החלון לא נוצר.

- [ ] **Step 1: Write the failing test** — עמוד מדריך שנבנה עם הדירוג פעיל מכיל `id="loginDialog"`, `id="playerToast"`, `assets/player.js`, ו-`classicrank.com`; עם `ranking.enabled:false` — אף אחד מהם.
- [ ] **Step 2: Run** `node --test test/render-player.test.mjs` — Expected: FAIL.
- [ ] **Step 3: Implement** את הסימון ב-`layout`.
- [ ] **Step 4: Run** `node --test test/*.test.mjs` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: חלון התחברות וברכה במעטפת העמוד`

### Task 3: התחברות, רענון וצ'יפ (`src/assets/player.js`, `site.js`)

**Files:**
- Create: `src/assets/player.js`
- Modify: `src/assets/site.js` (`updateMeChip`)

**Interfaces:**
- Consumes: Task 1 (`./lib/player.js`), `findPlayer`/`unpackRows`/`jobInfo` מ-`./lib/ranking-data.js`, DOM מ-Task 2.
- Produces:
  - `window.playerApi = { get(): Player|null, logout(): void, open(): void }` — לשימוש "הדמות שלי".
  - אירוע `window.dispatchEvent(new CustomEvent('player:change'))` אחרי התחברות, התנתקות או רענון שמשנה רמה/מקצוע.
  - localStorage `player` = `Player & { seenLevel:number }`.

התנהגות:
- `lookup(name)`: קודם API חי (timeout 8 שניות עם `AbortController`), תשובה לא `ok` או `normalizePlayer` → `null` → נפילה ל-`ranking/data.json` + `findPlayer`. מחזיר `Player|null`.
- שליחת הטופס: "מחפשים…" ב-`#loginResult`, אחר כך כרטיס אישור (תמונה עם `referrerpolicy="no-referrer"`, שם, `jobInfo(job).he`, "Lv N", "זו הדמות שלך?") עם "כן, זה אני" / "חיפוש אחר"; לא נמצא: ההודעה מהספק + "להמשיך בלי חיבור" שמקשר ל-`character/`.
- אישור: שומר `player` עם `seenLevel = level`, כותב `me` (מ-`toMe`; אם `cls` הוא `null` שומר את `me.cls` הקיים) ו-`meView` (`{name: display, lv, img: photo || meView.img}`), קורא `updateMeChip`, סוגר, משגר `player:change`.
- נגישות החלון: פתיחה מפקסת את השדה; Tab מוחזק בתוך החלון; Escape ולחיצה על הרקע סוגרים; הפוקוס חוזר ל-`#meChip`.
- `updateMeChip` ב-`site.js`: אין `player` וגם אין `meView` → הכיתוב "התחברות" ולחיצה (בלי Ctrl/Meta) קוראת `playerApi.open()` במקום ניווט; אחרת כמו היום. (`playerApi` עשוי עוד לא להיטען: אז לא מונעים את הניווט.)
- רענון בטעינה: אם יש `player` ו-`needsRefresh` → `lookup(player.name)`; הצלחה מעדכנת `player` (שומר `seenLevel`), `me.lv = effectiveLevel(me.lv, fresh)`, `meView`, ומעבירה ל-Task 4 את `levelGain(seenLevel, fresh.level)`; כישלון (רשת, 429, `null`): לא משנה כלום, כולל `checked`, כדי לנסות שוב בטעינה הבאה.

- [ ] **Step 1: Implement** את המודול ואת השינוי ב-`site.js`.
- [ ] **Step 2: Verify** `node build.mjs` מצליח ו-`node --test test/*.test.mjs` עובר.
- [ ] **Step 3: Verify בדפדפן** (Task 6 מפרט את ההרצה): התחברות עם תשובה מזויפת, שם לא קיים, Escape מחזיר פוקוס לצ'יפ.
- [ ] **Step 4: Commit** `feat: התחברות עם שם הדמות ורענון ברקע`

### Task 4: ברכת עליית רמה

**Files:**
- Modify: `src/assets/player.js`

**Interfaces:**
- Consumes: `levelGain`, `unlocks` (Task 1), `#playerToast` (Task 2), `addItemIcons` מ-`./lib/items.js`, `renderMarkdown` מ-`./lib/markdown.js`.
- Produces: `showLevelUp({from, to})`.

התנהגות:
- טוען `character/data.json` רק כשיש עלייה. כותרת: "LEVEL UP!" ואז "עלית לרמה {to}!" או "עלית {to-from} רמות, לרמה {to}!".
- עד 3 שורות מ-`unlocks`: milestone/guide → קישור ל-`guides/{slug}/`; item → טבלה קטנה מ-`renderMarkdown([head, sep, line].join('\n'))` עם `addItemIcons`.
- כפתורים: "לדמות שלי" (`character/`) וסגירה `[data-close-lu]`. לא מזיז פוקוס.
- `seenLevel = to` נשמר ברגע ההצגה (לא בסגירה), כדי שרענון בעמוד הבא לא יציג שוב.
- בעמוד מדריך, אם `#levelUp` של המדריך כבר גלוי, הברכה של השחקן מחכה לסגירתו.

- [ ] **Step 1: Implement**.
- [ ] **Step 2: Verify בדפדפן**: `player` עם `seenLevel:29`, תשובה מזויפת `level:31` → ברכה עם "הג'וב השני"; טעינה חוזרת → אין ברכה.
- [ ] **Step 3: Commit** `feat: ברכת עליית רמה עם מה שנפתח`

### Task 5: "הדמות שלי" כשמחוברים (`character.js`)

**Files:**
- Modify: `src/assets/character.js`, `src/lib/render.js` (סימון לשורת "מחובר כ-" בעמוד הדמות: `<p id="charLink" hidden>`)

**Interfaces:**
- Consumes: `window.playerApi`, אירוע `player:change`, localStorage `player`, `effectiveLevel`.

התנהגות:
- כשיש `player`: כותרת `"{display}, רמה {lv}"`, התמונה מ-`photo` (נפילה לאיור המקצוע ב-`onerror`), `meView` עם השם האמיתי (במקום שם המקצוע).
- `#charLink`: "מחוברים כ-<bdi>{display}</bdi> · נבדק {ago(checked)} · <a>לעמוד השחקן</a> · <button>התנתקות</button>". התנתקות: `playerApi.logout()` (מוחק `player`, משאיר `me`, מעדכן `meView` לשם המקצוע) ואז `render()`.
- כשאין `player`: כרטיס קטן בראש `body`: "חברו את הדמות שלכם והרמה תתעדכן לבד" עם כפתור שקורא `playerApi.open()`.
- "עליתי רמה" ידני: אם יש `player`, מעדכן גם `player.seenLevel = max(seenLevel, me.lv)`.
- מאזין ל-`player:change` → `me = readMe(); render()`.

- [ ] **Step 1: Implement**.
- [ ] **Step 2: Verify בדפדפן**: מחובר / מנותק / "עליתי רמה" ואז רענון עם אותה רמה → אין ברכה.
- [ ] **Step 3: Commit** `feat: הדמות שלי מתעדכנת מהדמות המחוברת`

### Task 6: עיצוב, פרטיות ובדיקה מלאה

**Files:**
- Modify: `src/assets/style.css` (שכבת "מייפל", לפני כללי הניגודיות), `content/pages/privacy.md` (סעיף "אחסון מקומי")

- [ ] **Step 1: CSS** לחלון (`.login-*`), לכרטיס האישור, ל-`.player-toast` (על בסיס `.levelup` הקיים), ל-`#charLink`. מצב כהה, `.a11y-contrast`, `.a11y-motion` ו-`prefers-reduced-motion` (בלי אנימציה), נייד 375px.
- [ ] **Step 2: פרטיות** — להחליף "העדפה אחת בלבד" בניסוח: נשמרים בדפדפן מצב התצוגה, הגדרות הנגישות, הדמות שבחרתם ושם הדמות המחוברת; לא נשלח אלינו; חיפוש ורענון הדמות פונים ישירות ל-ClassicRank; התנתקות מוחקת.
- [ ] **Step 3: Verify** `node --test test/*.test.mjs` — PASS; `node build.mjs` — מצליח.
- [ ] **Step 4: Verify בדפדפן** — להגיש את `dist/` מקומית, ליירט את `classicrank.com/api/v1/characters/*` עם תשובה מזויפת (Playwright `page.route`), ולעבור על: התחברות, לא נמצא, Escape, ברכה 29→31, אין ברכה כפולה, התנתקות, מצב כהה, ניגודיות גבוהה, 375px. צילומי מסך.
- [ ] **Step 5: Commit** `feat: עיצוב ההתחברות ועדכון מדיניות הפרטיות`
