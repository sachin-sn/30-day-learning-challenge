import { render } from "preact";
import { useState } from "preact/hooks";
import { signal, useSignal } from "@preact/signals";

// Every component function increments its own counter each time it runs ("renders").
// The counters are plain numbers outside the components, shown in the table at the bottom.
const renders = { StateParent: 0, StateChild: 0, SignalParent: 0, SignalChild: 0 };
const log = signal(JSON.stringify(renders)); // only used to show the table

function bump(name) {
  renders[name]++;
  queueMicrotask(() => (log.value = JSON.stringify(renders)));
}

// --- Version 1: useState. The parent owns the count and passes it to the child. ---
function StateChild({ count }) {
  bump("StateChild");
  return <p>child shows: {count}</p>;
}

function StateParent() {
  bump("StateParent");
  const [count, setCount] = useState(0);
  return (
    <section>
      <h2>useState</h2>
      <button onClick={() => setCount(count + 1)}>+1 (useState)</button>
      <StateChild count={count} />
    </section>
  );
}

// --- Version 2: signals. The parent passes the signal itself; the child puts it in the JSX. ---
function SignalChild({ count }) {
  bump("SignalChild");
  return <p>child shows: {count}</p>; // a signal in JSX updates this text node directly
}

function SignalParent() {
  bump("SignalParent");
  const count = useSignal(0);
  return (
    <section>
      <h2>signals</h2>
      <button onClick={() => count.value++}>+1 (signal)</button>
      <SignalChild count={count} />
    </section>
  );
}

function Table() {
  // Reads the log signal, so only this component updates when the numbers change.
  const r = JSON.parse(log.value);
  return (
    <table border="1" cellPadding="6">
      <thead>
        <tr><th>component</th><th>times its function ran</th></tr>
      </thead>
      <tbody>
        {Object.entries(r).map(([k, v]) => (
          <tr key={k}><td>{k}</td><td>{v}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function App() {
  return (
    <main>
      <StateParent />
      <SignalParent />
      <h2>render counts</h2>
      <Table />
    </main>
  );
}

render(<App />, document.getElementById("app"));
