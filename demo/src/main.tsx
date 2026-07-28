import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import { TransitionLab } from "./TransitionLab.js";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

const Root = new URLSearchParams(window.location.search).has("transition-lab")
  ? TransitionLab
  : App;

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
