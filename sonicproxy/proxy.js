// TLS-Überprüfung deaktivieren (nur für Testumgebungen!)
// Bei self-signed Cert sonst Fehler DEPTH_ZERO_SELF_SIGNED_CERT
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const express = require("express");
const app = express();
const PORT = 3000;

// Ziel: deine SonicWall-API
const baseUrl = "https://192.168.5.50/api";
const username = "admin";
const password = "Start123%";

// Basic Auth Header vorbereiten
const authHeader = "Basic " + Buffer.from(username + ":" + password).toString("base64");

// Middleware: CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Proxy-Handler: alle /api/... Anfragen
app.use("/api/sonicos", async (req, res) => {
  try {
    const subPath = req.originalUrl.replace("/api", "");
    const targetUrl = `${baseUrl}${subPath}`;
    console.log(`${req.method} → ${targetUrl}`);

    // Body puffern (für POST/PUT)
    let body;
    if (req.method !== "GET" && req.method !== "DELETE") {
      body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => (data += chunk));
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Accept": "application/json",
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: body || undefined
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy läuft auf http://127.0.0.1:${PORT}`);
});