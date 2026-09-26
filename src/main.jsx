import React from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (window.location.pathname.startsWith("/admin")) {
  Promise.all([import("vue"), import("./admin/main.js")]).then(
    ([{ createApp }, { default: AdminApp }]) => createApp(AdminApp).mount(root),
  );
} else {
  import("./styles.css")
    .then(() => import("./App.jsx"))
    .then(({ App }) => {
      createRoot(root).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      );
    });
}
