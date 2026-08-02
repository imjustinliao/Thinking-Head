const states = ["Thinking", "Executing", "Listening", "Searching", "Reading"] as const;

export function App() {
  return (
    <main id="top">
      <header>
        <nav aria-label="Primary navigation">
          <a href="https://github.com/">GitHub</a>
          <a href="#top">Thinking TF</a>
          <a href="https://x.com/">X</a>
        </nav>
      </header>

      <section aria-labelledby="thinking-tf-title">
        <p>Logo placeholder</p>
        <h1 id="thinking-tf-title">Thinking TF</h1>
        <p>Every model lies beyond the transformer.</p>
        <p>An open-sourced UI component for each state of your AI agent.</p>
      </section>

      <section aria-labelledby="states-title">
        <h2 id="states-title">States</h2>
        <ul>
          {states.map((state) => (
            <li key={state}>
              <h3>{state}</h3>
              <p aria-label={`${state} appearance placeholder`} role="img">
                [Temporary {state.toLowerCase()} appearance placeholder]
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="guide-title">
        <h2 id="guide-title">Guide</h2>
        <h3>Install</h3>
        <pre>
          <code>npm install /path/to/Thinking-Head</code>
        </pre>
        <h3>React</h3>
        <pre>
          <code>
            {
              'import { MechIndicator } from "thinking-head/react";\n\n<MechIndicator state="thinking" />'
            }
          </code>
        </pre>
      </section>

      <footer>@ Justin Liao</footer>
    </main>
  );
}
