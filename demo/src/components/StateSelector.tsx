import { MECH_STATES, type MechState, STATE_FRAME_PLANS } from "thinking-head";

export interface StateSelectorProps {
  value: MechState;
  onChange: (state: MechState) => void;
}

/**
 * Native radios inside a segmented track. Using real inputs keeps arrow-key
 * roving, the required-single-selection semantics, and form labelling correct
 * without re-implementing any of it.
 */
export function StateSelector({ value, onChange }: StateSelectorProps) {
  return (
    <fieldset className="selector">
      <legend className="visually-hidden">Agent state</legend>
      <div className="selector__track">
        {MECH_STATES.map((state) => (
          <label className="selector__option" key={state}>
            <input
              checked={value === state}
              className="selector__input"
              name="agent-state"
              onChange={() => onChange(state)}
              type="radio"
              value={state}
            />
            <span className="selector__label">{STATE_FRAME_PLANS[state].label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
