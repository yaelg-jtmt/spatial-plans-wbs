# WBS וגאנט לתכניות מרחביות

אב-טיפוס React/Vite עצמאי לניהול פורטפוליו של 12 תכניות מרחביות.

## הרצה מקומית
```bash
npm install
npm run dev
```

## build
```bash
npm run build
npm run preview
```

## GitHub Pages
1. צרו repository והעלו אליו את תכולת הפרויקט.
2. הריצו `npm install`.
3. אפשר לפרסם עם `npm run deploy` לאחר הגדרת remote ל-GitHub.

`vite.config.js` משתמש ב-`base: './'` כדי לאפשר פרסום גם תחת sub-path.

## מה כלול
- תצוגת פורטפוליו ל-12 תכניות
- מפת שלבים 0–6 ומקרא צבעים
- פילטר לפי תכנית, סטטוס, שלב ואחראי
- WBS וגאנט מפורט לצור באהר–אום טובא
- Blocker ו-Next Action
- QA נפרד מסטטוס ביצוע

## המשך מתוכנן
- מקור נתונים SharePoint Lists: PLANS, WBS_TASKS, PROJECTS, DOCUMENTS
- חיבור לדאשבורד המרחבי
- הרחבת WBS מפורט לכל 12 התכניות
