import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function probar() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
    const res = await model.generateContent("Hola, di una sola palabra.");
    console.log("RESPUESTA EXITOSA:", res.response.text());
  } catch (error) {
    console.error("ERROR REAL:", error.message);
  }
}

probar();