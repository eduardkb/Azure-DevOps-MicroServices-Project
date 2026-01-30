import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./main.css";
import { BrowserRouter } from "react-router-dom";
import { initAuthConfig, getMsalConfig } from "./authConfig";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { MessageProvider } from "./components/MessageProvider";

await initAuthConfig();
const msalInstance = new PublicClientApplication(getMsalConfig());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MsalProvider instance={msalInstance}>
        <MessageProvider>
          <App />
        </MessageProvider>
      </MsalProvider>
    </BrowserRouter>
  </React.StrictMode>
);
