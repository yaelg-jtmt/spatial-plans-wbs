# שכבות ומצגות באתר

הדאשבורד טוען שכבות GIS ומצגות מקבצי האתר, בלי חלון טעינה. הרשימה ב-`public/data/layers/manifest.json`.

## להוסיף או לעדכן שכבות של תכנית
1. ייצוא מ-ArcGIS Pro ב-ITM (EPSG:2039) כ-JSON, והעלאה ל-`local-data/`.
2. המרה ישירות לתיקיית האתר:
   `node scripts/convert-layers.mjs local-data/<קובץ>.json --state proposed --out public/data/layers`
3. שורה ב-`manifest.json` תחת `layers`:
   `{ "id": "...", "name": "...", "plan": "שם התכנית", "state": "proposed", "file": "<קובץ>.geojson", "count": <מספר ישויות> }`
   `"replace": true` מחליף שכבה מוטמעת קיימת של אותה תכנית ואותו מצב. בלעדיו השכבה נוספת לצד הקיימות.
4. `npm run test:sync` בודק שהקובץ קיים, ב-ITM, והספירה תואמת. ואז commit ו-push.

עדכון שכבה קיימת: מריצים שוב את ההמרה על הקובץ החדש (אותו שם) ומעדכנים `count`.

## להוסיף מצגת
1. PowerPoint: קובץ, שמירה בשם, PDF.
2. הקובץ ל-`public/data/decks/`, ושורה ב-`manifest.json` תחת `decks`:
   `{ "id": "gilo-a", "name": "גילה א", "plan": "גילה", "file": "gilo-a.pdf" }`
3. כל שקופית מקושרת לפרויקט לפי המספר שמופיע בה (למשל "מס' פרויקט 12").

שם התכנית (`plan`) קובע את ההתאמה בין שכבה, מצגת ותכנית באתר. גודל קובץ: עד 100MB ב-GitHub, מומלץ עד כ-20MB.
