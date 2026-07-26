import { useId, useState } from "react";
import type { ExpressionParams } from "thinking-head/dev";
import {
  BROW_EXPRESSION_FIELDS,
  CAMERA_FIELDS,
  DEFAULT_EXPRESSION,
  DEFAULT_TUNING,
  EYE_EXPRESSION_FIELDS,
  FEATURE_FIELDS,
  type Field,
  HEAD_FIELDS,
  JAW_EXPRESSION_FIELDS,
  MIDFACE_EXPRESSION_FIELDS,
  MOUTH_EXPRESSION_FIELDS,
  SAMPLING_FIELDS,
  STYLE_FIELDS,
  type TuningConfig,
} from "./tuning.js";

interface SliderGroupProps<T extends object> {
  title: string;
  fields: Field<T>[];
  values: T;
  onChange: (next: T) => void;
}

function SliderGroup<T extends object>({ title, fields, values, onChange }: SliderGroupProps<T>) {
  const id = useId();
  // `NumericKey<T>` already guarantees this is a number-valued key; TypeScript cannot narrow a
  // generic indexed access that far, so the assertion is confined to this one reader.
  const read = (field: Field<T>): number => values[field.key] as number;

  return (
    <fieldset className="tune-group">
      <legend className="tune-group-title">{title}</legend>
      {fields.map((field) => (
        <label className="tune-row" key={field.key} htmlFor={`${id}-${field.key}`}>
          <span className="tune-name">{field.label}</span>
          <input
            id={`${id}-${field.key}`}
            className="slider slider--thin"
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={read(field)}
            onChange={(e) => onChange({ ...values, [field.key]: Number(e.target.value) })}
          />
          <output className="tune-value">
            {field.step >= 1 ? read(field) : read(field).toFixed(field.step < 0.01 ? 3 : 2)}
          </output>
        </label>
      ))}
    </fieldset>
  );
}

interface TuningPanelProps {
  config: TuningConfig;
  onChange: (next: TuningConfig) => void;
  /** Milliseconds the last geometry generation took. Watched against a 30ms live-feel target. */
  generateMs: number;
  particleCount: number;
  expression: ExpressionParams;
  onExpressionChange: (next: ExpressionParams) => void;
}

export function TuningPanel({
  config,
  onChange,
  generateMs,
  particleCount,
  expression,
  onExpressionChange,
}: TuningPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className={`tune glass${open ? " tune--open" : ""}`}
      aria-label="Head and expression tuning"
    >
      <header className="tune-head">
        <button
          type="button"
          className="tune-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="tune-caret" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          Tuning
        </button>
        <div className="tune-stats">
          <span>
            <b>{particleCount}</b> particles
          </span>
          <span className={generateMs > 30 ? "tune-slow" : undefined}>
            <b>{generateMs.toFixed(1)}</b> ms
          </span>
          <button
            type="button"
            className="tune-reset"
            onClick={() => {
              onChange(structuredClone(DEFAULT_TUNING));
              onExpressionChange({ ...DEFAULT_EXPRESSION });
            }}
          >
            reset
          </button>
        </div>
      </header>

      {open && (
        <div className="tune-body">
          <SliderGroup
            title="Skull"
            fields={HEAD_FIELDS}
            values={config.head}
            onChange={(head) => onChange({ ...config, head })}
          />
          <SliderGroup
            title="Features"
            fields={FEATURE_FIELDS}
            values={config.features}
            onChange={(features) => onChange({ ...config, features })}
          />
          <SliderGroup
            title="Sampling"
            fields={SAMPLING_FIELDS}
            values={config.sampling}
            onChange={(sampling) => onChange({ ...config, sampling })}
          />
          <SliderGroup
            title="Camera"
            fields={CAMERA_FIELDS}
            values={config.camera}
            onChange={(camera) => onChange({ ...config, camera })}
          />
          <SliderGroup
            title="Particles"
            fields={STYLE_FIELDS}
            values={config.style}
            onChange={(style) => onChange({ ...config, style })}
          />
          <SliderGroup
            title="Expression · brows"
            fields={BROW_EXPRESSION_FIELDS}
            values={expression}
            onChange={onExpressionChange}
          />
          <SliderGroup
            title="Expression · eyes"
            fields={EYE_EXPRESSION_FIELDS}
            values={expression}
            onChange={onExpressionChange}
          />
          <SliderGroup
            title="Expression · mid-face"
            fields={MIDFACE_EXPRESSION_FIELDS}
            values={expression}
            onChange={onExpressionChange}
          />
          <SliderGroup
            title="Expression · mouth"
            fields={MOUTH_EXPRESSION_FIELDS}
            values={expression}
            onChange={onExpressionChange}
          />
          <SliderGroup
            title="Expression · jaw"
            fields={JAW_EXPRESSION_FIELDS}
            values={expression}
            onChange={onExpressionChange}
          />
        </div>
      )}
    </section>
  );
}
