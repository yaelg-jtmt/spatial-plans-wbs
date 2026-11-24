// "משויך לתוצר": כן/לא. אם כן - כל תוצר בשורה נפרדת, עם הוספה והסרה. label = שם נגיש לקוראי מסך (למשל "2.1").
export default function ProductAssignment({ values, onChange, label = "" }) {
  const linked = values.length > 0;
  const setLinked = (value) => {
    if (value === "לא") onChange([]);
    if (value === "כן" && !linked) onChange([""]);
  };
  const updateProduct = (index, value) => onChange(values.map((p, i) => (i === index ? value : p)));
  const addProduct = () => onChange([...values, ""]);
  const removeProduct = (index) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="min-w-[280px] space-y-2">
      <select
        aria-label={`משויך לתוצר ${label}`.trim()}
        value={linked ? "כן" : "לא"}
        onChange={(e) => setLinked(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2"
      >
        <option>לא</option>
        <option>כן</option>
      </select>
      {linked && (
        <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2">
          {values.map((product, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-slate-500">{index + 1}.</span>
              <input
                aria-label={`שם תוצר ${index + 1} ${label}`.trim()}
                value={product}
                onChange={(e) => updateProduct(index, e.target.value)}
                className="w-full rounded-lg border bg-white px-2 py-2"
                placeholder="שם התוצר"
              />
              <button type="button" aria-label={`הסרת תוצר ${index + 1} ${label}`.trim()} onClick={() => removeProduct(index)} className="rounded-lg border bg-white px-2 py-2 text-xs text-red-600">
                הסר
              </button>
            </div>
          ))}
          <button type="button" aria-label={`הוספת תוצר ${label}`.trim()} onClick={addProduct} className="w-full rounded-lg border border-dashed border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700">
            + הוסף תוצר נוסף
          </button>
        </div>
      )}
    </div>
  );
}
