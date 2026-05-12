import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getInitialTheme, applyTheme } from "./theme";
import { App } from "./App";

console.log("[kmd:boot] main.tsx module loading");

applyTheme(getInitialTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

console.log("[kmd:boot] React root created and render called");
