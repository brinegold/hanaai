import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import favicon from "./favicon.ico";

// Set document title
document.title = "Nebrix - Quantitative Trading Platform";

// Set favicon if needed
const link = document.createElement('link');
link.rel = 'icon';
link.href = favicon;
document.head.appendChild(link);

createRoot(document.getElementById("root")!).render(<App />);
