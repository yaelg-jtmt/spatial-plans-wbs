# תכניות מרחביות – דאשבורד, WBS וגאנט

אתר אחד עם ארבעה מסכים: **פורטפוליו · דאשבורד · WBS · גאנט**.
התכנית שנבחרה משותפת לכל המסכים (נשמרת ב-URL: `#/wbs?plan=GI`).

## מבנה

```
public/
  data/plans.json            12 התכניות (שם, סטטוס, התקדמות)
  data/wbs-template.json     שורות ה-WBS (כרגע שלבים 5–6 בלבד)
  dashboard/index.html       נוצר מהדאשבורד המקורי ע"י scripts/prepare-dashboard.mjs
  dashboard/bridge.js        סנכרון בורר התכנית בין הדאשבורד לאתר
src/
  pages/                     Portfolio, Dashboard, Wbs, Gantt
  components/                Select, ProductAssignment, PlanPicker
  lib/                       ניתוב, שמות, שמירת בחירות WBS
scripts/check-secrets.mjs    חוסם בנייה אם יש מפתחות בקוד
.github/workflows/deploy.yml פרסום אוטומטי ל-GitHub Pages
```

## הרצה מקומית

```bash
npm install
npm run dev
```

## חיבור הדאשבורד (פקודה אחת)

```bash
node scripts/prepare-dashboard.mjs "C:\\path\\דאשבורד_תכניות_מרחביות_G5.html"
```

הסקריפט:
1. יוצר `public/dashboard/index.html` מהקובץ המקורי.
2. מוציא את `CARTO_KEY`, ‏`GOOGLE_API_KEY` ו-`DRIVE_FOLDER_ID` אל `public/dashboard/config.js` (מוחרג מ-Git).
3. מסיר את בלוק המטא-דאטה של SharePoint (כתובת פנימית).
4. מוסיף `config.js` לפני הסקריפטים ו-`bridge.js` לפני `</body>`.

אחרי ההרצה: `npm run dev` ובדיקה ידנית שבחירת תכנית בדאשבורד מחליפה גם את הבורר באתר, ולהפך.

**מפתחות ב-GitHub:** ב-Settings → Secrets and variables → Actions מוסיפים
`CARTO_KEY`, ‏`GOOGLE_API_KEY`, ‏`DRIVE_FOLDER_ID`. ה-workflow יוצר מהם את `config.js` בזמן הבנייה.
שימו לב: באתר סטטי המפתחות עדיין גלויים למי שפותח את האתר. ההגנה האמיתית היא הגבלת כל מפתח
לדומיין של האתר (HTTP referrer) ול-API הדרוש בלבד.

לא להעלות לריפו שכבות GIS (shp/dbf) או נתונים פנימיים. הם מוחרגים ב-`.gitignore`.

## בדיקת הסנכרון

1. **בדיקות יחידה (Node, ללא תלויות):** `npm run test:sync` — התאמת שמות ל-12 התכניות בכל וריאציית כתיבה,
   פרוטוקול ההודעות, זיהוי מרחב שאינו ב-12 התכניות, ועקביות הנרמול בין `bridge.js` לאתר.
2. **בדיקה בדפדפן מול הדאשבורד האמיתי:** `npm run dev` ואז `http://localhost:5173/tools/sync-test.html`.
   מריצה ~25 בדיקות (PASS/FAIL/SKIP): בחירה ראשונית מה-URL, אתר→דאשבורד לכל 12 התכניות (כולל אימות שכותרת המפה
   השתנתה), דאשבורד→אתר, היעדר הד, "כל התכניות", שם לא מוכר, בנייה מחדש של הרשימה, ומרחב שאינו ב-12 התכניות.
   `SKIP` על תכנית = היא לא מופיעה ברשימת הדאשבורד, ובפירוט מוצגות האפשרויות הדומות.
3. **בדיקת תקינות של הבדיקה:** `...?dashboard=/tests/fixtures/dashboard-fixture.html` (דאשבורד דמה שנגזר מהקוד האמיתי).

התנהגויות שנקבעו לפי הקוד של הדאשבורד:
- הדאשבורד מאזין ל-`change` על `#planSel` (מאומת), ולכן ה-bridge מפעיל אותו ב-`dispatchEvent`.
- `fillPlanSelect` מאפס ל"כל התכניות" אם התכנית חסרה ברשימה. ה-bridge מחזיר את הבחירה כשהיא חוזרת,
  אלא אם המשתמש בחר "כל התכניות" בעצמו.
- הדאשבורד כולל את כל 29 מרחבי Xplan. בחירה במרחב שאינו ב-12 התכניות לא משנה את ה-WBS/גאנט, והאתר מציג הודעה.

## העלאה ל-GitHub

```bash
git init
git add .
git commit -m "Initial commit: spatial plans hub"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

בריפו: Settings → Pages → Source: **GitHub Actions**.

> אתר GitHub Pages ציבורי כברירת מחדל. אם התוכן פנימי, יש לבדוק מדיניות ארגונית
> לפני פרסום (Pages לריפו פרטי דורש תוכנית בתשלום).

## מגבלות ידועות

- בחירות ה-WBS נשמרות ב-`localStorage` של הדפדפן, לכל תכנית בנפרד, ואינן משותפות בין משתמשים.
- `wbs-template.json` כולל כרגע רק שלבים 5–6. שלבים 0–4 יש להוסיף לפי מאגר ה-WBS המלא.
- `bridge.js` מניח שהדאשבורד מגיב לאירוע `change` על `#planSel`. הסקריפט `prepare-dashboard` בודק שהאלמנט קיים, אבל הסנכרון עצמו יש לאמת ידנית.
