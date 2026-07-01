import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Grocery List Manager</h1>
      <p>Frontend placeholder — Phase 0</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
