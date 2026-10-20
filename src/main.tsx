import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { StoreProvider } from "./store/store";

// StrictMode kapalı: durum güncelleyicilerinin iki kez çalışıp bildirimleri çoğaltmasını önler.
createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
