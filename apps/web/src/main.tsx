import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installDemo, isDemo } from "./demo/install";
import "./styles/index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const render = () =>
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
if (isDemo) {
  root.render(<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#65776C", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14 }}>Carregando o emilIA…</div>);
  void installDemo().then(render);
} else render();
