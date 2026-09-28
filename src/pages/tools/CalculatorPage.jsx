import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getCalculatorBySlug } from "../../data/calculators";
import { usePageMeta } from "../../hooks/usePageMeta";
import "../../styles/pages.css";
import "./ToolPage.css";

export default function CalculatorPage({ slug }) {
  const calc = getCalculatorBySlug(slug);
  const [values, setValues] = useState(() =>
    calc ? Object.fromEntries(calc.fields.map((f) => [f.id, f.default])) : {}
  );

  usePageMeta(calc?.title, calc?.description);

  if (!calc) return <Navigate to="/tools" replace />;

  const results = calc.compute(values);

  return (
    <div className="page">
      <p className="page__crumb"><Link to="/tools">Tools</Link> / {calc.category} / {calc.title}</p>
      <div className="page__head">
        <p className="page__eyebrow">{calc.category}</p>
        <h1>{calc.title}</h1>
        <p>{calc.description}</p>
      </div>

      <div className="tool-layout">
        <form className="tool-form" onSubmit={(e) => e.preventDefault()}>
          {calc.fields.map((f) => (
            <label className="tool-field" key={f.id}>
              <span>{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                value={values[f.id]}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
              />
            </label>
          ))}
        </form>

        <div className="tool-results">
          {results.map((r) => (
            <div className="tool-result" key={r.label}>
              <span className="tool-result__label">{r.label}</span>
              <span className="num tool-result__value">
                {r.value}
                {r.suffix ? ` ${r.suffix}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
