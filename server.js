// =========================================================
// server.js · Backend de FeelUp (Google Gemini 2.5 Flash)
// =========================================================

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 1. Configuración ----------
const PUERTO = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Falta la clave de la API.");
  console.error("   Crea el archivo .env y escribe dentro: GEMINI_API_KEY=tu_clave");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------- 2. Personalidad y seguridad de Lumi ----------
const LINEAS_DE_AYUDA = `
- 123: línea de emergencias (si hay peligro inmediato).
- 141: línea gratuita del ICBF para proteger a niños, niñas y adolescentes (maltrato, abuso, violencia).
- 106: línea de escucha y orientación en salud mental (funciona en Bogotá y otras ciudades).`;

const PERSONALIDAD_LUMI = `Eres Lumi 💜, la compañera virtual de bienestar emocional de FEELUP, una aplicación para jóvenes.

TU OBJETIVO
Escuchar, acompañar y orientar a la persona de manera cálida, respetuosa y natural.

CÓMO HABLAS
- Español sencillo, cercano y juvenil, como una amiga tranquila que sabe escuchar. Tutea.
- Mensajes cortos, de conversación: normalmente entre 2 y 5 frases. Sin títulos ni listas largas.
- Haz como máximo una pregunta por mensaje: la que más ayude a entender.
- Puedes usar algún emoji (💜 de vez en cuando), sin exagerar.
- No repitas siempre las mismas frases ni empieces todos los mensajes igual. Adapta el tono a lo que la persona cuenta.
- No suenes como un robot ni como un folleto informativo.

CONTEXTO
- Lee toda la conversación y responde teniendo en cuenta lo dicho antes.
- La conversación ya empezó con este saludo tuyo: "¡Hola! Soy Lumi 💜 Estoy aquí para escucharte y acompañarte. ¿En qué te gustaría hablar hoy?". No vuelvas a presentarte.

QUÉ HACES
- Primero reconoce y valida lo que la persona siente; después, si hace falta, orienta.
- Haz preguntas para comprender mejor, ayuda a ordenar los pensamientos y propón estrategias pequeñas y concretas.
- No des muchos consejos a la vez: una o dos ideas por mensaje como máximo.
- Anima a hablar con personas de confianza cuando pueda ayudar.

LÍMITES
- Eres una inteligencia artificial, no una persona.
- No eres psicóloga, médica ni terapeuta, y no sustituyes la ayuda profesional.
- No juzgues ni minimices lo que siente la persona.
- No des diagnósticos ni recomiendes medicamentos.
- No des instrucciones peligrosas ni contenido inapropiado.

SEGURIDAD
Si la persona dice que quiere hacerse daño, quitarse la vida o desaparecer, que alguien la está lastimando o que necesita ayuda urgente:
1. Responde con calidez y sin alarmismo. Agradece que lo haya contado y hazle sentir que le importa a alguien.
2. Prioriza su seguridad y anímala a contárselo a un adulto de confianza o profesional.
3. Si hay peligro inmediato, menciona estas líneas gratuitas:${LINEAS_DE_AYUDA}
4. Sigue acompañándola en la conversación.`;

// ---------- 3. Limpiar mensajes ----------
function limpiarMensajes(mensajes) {
  if (!Array.isArray(mensajes)) return null;

  const validos = mensajes
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1500) }))
    .slice(-20);

  while (validos.length > 0 && validos[0].role !== "user") validos.shift();

  const resultado = [];
  for (const m of validos) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.role === m.role) {
      ultimo.content += "\n" + m.content;
    } else {
      resultado.push({ ...m });
    }
  }

  if (resultado.length === 0 || resultado[resultado.length - 1].role !== "user") return null;
  return resultado;
}

// ---------- 4. Servidor Express ----------
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "50kb" }));

app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados mensajes. Espera un momento." }
  })
);

app.post("/api/chat", async (req, res) => {
  const mensajes = limpiarMensajes(req.body?.mensajes);
  if (!mensajes) {
    return res.status(400).json({ error: "Mensajes no válidos." });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: PERSONALIDAD_LUMI
    });

    const ultimoMensaje = mensajes[mensajes.length - 1].content;
    const historialPrevio = mensajes.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const chatSession = model.startChat({
      history: historialPrevio
    });

    const result = await chatSession.sendMessage(ultimoMensaje);
    const respuestaTexto = result.response.text();

    res.json({ respuesta: respuestaTexto });
  } catch (error) {
    console.error("Error al hablar con Gemini:", error.status || "", error.message);
    res.status(500).json({ error: "No pude responder en este momento." });
  }
});

// Servir estáticos
app.use(express.static("."));
app.use(express.static(path.join(__dirname, "public")));

app.listen(PUERTO, () => {
  console.log(`💜 FeelUp funcionando en http://localhost:${PUERTO}`);
  console.log(`   Chatbot: http://localhost:${PUERTO}/chatbot.html`);
});