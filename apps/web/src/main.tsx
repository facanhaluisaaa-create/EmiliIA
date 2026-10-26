import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installDemo, isDemo } from "./demo/install";
import "./styles/index.css";

if (isDemo) installDemo();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
