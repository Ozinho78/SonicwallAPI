process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Selbstsignierte Zertifikate erlauben

// Wir nutzen Express für den Webserver
const express = require("express");

// Zertifkikats-Handling
// const fs = require("fs");
// const https = require("https");

// // Zertifikat einlesen
// const ca = fs.readFileSync("sonicwall.crt");

// // Agent, der das Zertifikat akzeptiert
// const agent = new https.Agent({
//   ca: ca,
//   rejectUnauthorized: true // d.h. nur das richtige Cert ist erlaubt
// });

// Ab Node 18 ist fetch nativ eingebaut, kein node-fetch mehr nötig
const app = express();
const PORT = 3000; // Port, auf dem unser Proxy läuft

// Ziel: deine SonicWall-API (IP und Pfad der Appliance)
const baseUrl = "https://192.168.5.49/api/sonicos";
const username = "admin";    // dein SonicWall-Username
const password = "Start123"; // dein SonicWall-Passwort

let cookieJar = ""; // hier speichern wir das Session-Cookie von SonicWall

// -----------------------------
// Middleware: Browser darf mit uns reden (CORS)
// -----------------------------
app.use((req, res, next) => {
  // nur dein Frontend darf zugreifen
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5500"); 
  // erlaubte Header
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // erlaubte Methoden
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // Cookies dürfen übergeben werden
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Bei "OPTIONS"-Anfragen sofort 200 zurück (Preflight-Check vom Browser)
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// -----------------------------
// Login-Funktion: meldet uns an der SonicWall an (per Basic Auth)
// -----------------------------
async function login() {
  // Basic Auth Header bauen
  const authHeader = "Basic " + Buffer.from(username + ":" + password).toString("base64");

  const response = await fetch(`${baseUrl}/auth`, {
    method: "POST",
    headers: { 
      "Authorization": authHeader,
      "Accept": "application/json"
    }
  });

  if (!response.ok) throw new Error("Login failed: " + response.status);

  // Cookie vom Header extrahieren → "Set-Cookie" kommt von SonicWall zurück
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    cookieJar = setCookie.split(";")[0]; // nur den ersten Teil (Session-ID)
    console.log("Logged in, cookie:", cookieJar);
  } else {
    throw new Error("No cookie returned from SonicWall");
  }
}

// -----------------------------
// Proxy-Handler: fängt alle Requests auf /api/... ab
// -----------------------------
app.use("/api", async (req, res) => {
  try {
    // Wenn wir noch keinen Cookie haben → einloggen
    if (!cookieJar) {
      await login();
    }

    // Original-URL (z. B. /api/firmware/base) → /firmware/base extrahieren
    const subPath = req.originalUrl.replace("/api", "");
    // vollständige URL für die SonicWall bauen
    const targetUrl = `${baseUrl}${subPath}`;
    console.log("Proxy →", targetUrl);

    // Fetch mit Zertifikats-Agent (wenn nötig)
    // const response = await fetch(`${baseUrl}/auth`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json", "Accept": "application/json" },
    //   body: JSON.stringify({ username, password }),
    //   agent: agent
    // });


    // Anfrage an SonicWall weiterleiten
    const response = await fetch(targetUrl, {
      method: req.method, // gleiche HTTP-Methode wie Client
      headers: {
        "Accept": "application/json",
        "Cookie": cookieJar, // Session-Cookie mitsenden
      },
    });

    // Wenn Session abgelaufen (401) → neu einloggen und wiederholen
    if (response.status === 401) {
      console.log("Session expired, re-login...");
      await login();
      const retry = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "Accept": "application/json",
          "Cookie": cookieJar,
        },
      });
      const retryData = await retry.text();
      return res.status(retry.status).send(retryData);
    }

    // Antworttext von SonicWall an den Browser zurückgeben
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    // Fehlerbehandlung → 500 mit Fehlermeldung
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Proxy starten
// -----------------------------
app.listen(PORT, () => {
  console.log(`Proxy läuft auf http://127.0.0.1:${PORT}`);
});
