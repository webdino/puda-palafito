import { createRoot } from "react-dom/client";
import "./style.css";
import { App } from "./App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container was not found.");
}

createRoot(container).render(<App />);
