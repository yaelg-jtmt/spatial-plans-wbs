export default function PlanPicker({ plans, plan, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      תכנית
      <select
        value={plan}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border bg-white px-4 py-2 text-slate-900"
      >
        {plans.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
