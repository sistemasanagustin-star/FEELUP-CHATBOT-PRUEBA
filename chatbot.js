// =========================================================
// chatbot.js  ·  Lógica de la pantalla de Lumi (FeelUp)
// Este archivo NO tiene la clave de la API: solo habla con
// nuestro servidor (server.js), y el servidor habla con la IA.
// =========================================================

// ---------- 1. Configuración ----------
const URL_API = "/api/chat";
const MAX_MENSAJES_ENVIADOS = 20; // cuántos mensajes recientes le mandamos a la IA
const TIEMPO_MAXIMO_MS = 30000;   // si tarda más de 30 segundos, damos error

const MENSAJE_BIENVENIDA =
  "¡Hola! Soy Lumi 💜\nEstoy aquí para escucharte y acompañarte.\n¿En qué te gustaría hablar hoy?";
const MENSAJE_ERROR =
  "Parece que tuve un pequeño problema para responder 💜. Inténtalo nuevamente.";
const MENSAJE_MUCHOS_MENSAJES =
  "Vamos un poquito rápido 💜. Espera un momento y vuelve a intentarlo.";

// ---------- 2. Elementos de la página ----------
const chat = document.getElementById("chat");
const formulario = document.getElementById("form-chat");
const campo = document.getElementById("mensaje");
const botonEnviar = document.getElementById("btn-enviar");

// ---------- 3. Memoria de la conversación ----------
// Aquí guardamos todo lo que se ha dicho. Se envía a la IA en cada mensaje
// para que Lumi recuerde el contexto. Se borra al cerrar o recargar la página.
// Formato: { role: "user" | "assistant", content: "texto" }
const historial = [];
let esperandoRespuesta = false;

// ---------- 4. Funciones para dibujar en pantalla ----------
function bajarScroll() {
  chat.scrollTop = chat.scrollHeight;
}

// Crea una burbuja. "quien" es "lumi" o "usuario".
function crearMensaje(texto, quien) {
  const fila = document.createElement("div");
  fila.className = "mensaje " + quien;

  if (quien === "lumi") {
    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = "lumi.svg";
    avatar.alt = "";
    fila.appendChild(avatar);
  }

  const burbuja = document.createElement("div");
  burbuja.className = "burbuja";
  burbuja.textContent = texto; // textContent es seguro: no interpreta HTML
  fila.appendChild(burbuja);

  chat.appendChild(fila);
  bajarScroll();
  return fila;
}

function mostrarEscribiendo() {
  const fila = document.createElement("div");
  fila.className = "mensaje lumi";
  fila.id = "escribiendo";
  fila.innerHTML =
    '<img class="avatar" src="lumi.svg" alt="">' +
    '<div class="burbuja escribiendo">' +
    '<span class="puntos"><i></i><i></i><i></i></span>' +
    '<span class="texto-escribiendo">Lumi está escribiendo...</span>' +
    "</div>";
  chat.appendChild(fila);
  bajarScroll();
}

function ocultarEscribiendo() {
  const fila = document.getElementById("escribiendo");
  if (fila) fila.remove();
}

// ---------- 5. Enviar un mensaje ----------
async function enviarMensaje(texto) {
  esperandoRespuesta = true;
  botonEnviar.disabled = true;

  const filaUsuario = crearMensaje(texto, "usuario");
  historial.push({ role: "user", content: texto });
  campo.value = "";
  mostrarEscribiendo();

  try {
    const respuesta = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes: historial.slice(-MAX_MENSAJES_ENVIADOS) }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });

    if (!respuesta.ok) {
      const error = new Error("Error del servidor: " + respuesta.status);
      error.status = respuesta.status;
      throw error;
    }

    const datos = await respuesta.json();
    if (!datos.respuesta) throw new Error("La respuesta llegó vacía");

    ocultarEscribiendo();
    crearMensaje(datos.respuesta, "lumi");
    historial.push({ role: "assistant", content: datos.respuesta });
  } catch (error) {
    console.error("Error con Lumi:", error);
    ocultarEscribiendo();

    // Si falló, sacamos el mensaje del historial y lo devolvemos al campo
    // para que la persona pueda reintentar sin volver a escribirlo.
    historial.pop();
    filaUsuario.remove();
    campo.value = texto;

    crearMensaje(error.status === 429 ? MENSAJE_MUCHOS_MENSAJES : MENSAJE_ERROR, "lumi");
  } finally {
    esperandoRespuesta = false;
    botonEnviar.disabled = false;
    campo.focus();
  }
}

// ---------- 6. Botón de enviar y tecla ENTER ----------
// Al estar dentro de un <form>, tanto el botón como ENTER activan "submit".
formulario.addEventListener("submit", (evento) => {
  evento.preventDefault(); // evita que la página se recargue
  const texto = campo.value.trim();
  if (!texto || esperandoRespuesta) return;
  enviarMensaje(texto);
});

// ---------- 7. Al abrir la pantalla ----------
crearMensaje(MENSAJE_BIENVENIDA, "lumi");

// Ayuda para desarrollo: si abren el archivo con doble clic, Lumi no puede funcionar.
if (location.protocol === "file:") {
  crearMensaje(
    "⚠️ Abriste este archivo directamente. Para hablar con la IA, enciende el servidor y entra a http://localhost:3000/chatbot.html",
    "lumi"
  );
}
