export default function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2"
    >
      {options.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
}
