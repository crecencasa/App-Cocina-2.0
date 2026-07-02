import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API endpoint: Generate 3 recipe options
app.post("/api/generate-options", async (req, res) => {
  try {
    const { ingredients, people, sensitiveAnswers, extraIngredientsChoice, mealType } = req.body;

    if (!ingredients) {
      return res.status(400).json({ error: "Faltan los ingredientes" });
    }

    const ai = getGeminiClient();

    // Construct the context prompt for the options
    let prompt = `Eres "Cocina con lo que tienes", una mini app de ayuda rápida para cocinar. Tu función es ayudar a una mujer adulta ocupada a resolver qué cocinar con los ingredientes que tiene en casa, sin hacerle perder tiempo.
    
USUARIA TIENE:
- Ingredientes: ${ingredients}
- Cantidad de personas: ${people || "No especificado (asume una porción estándar)"}
- Tipo de comida del día: ${mealType || "No especificado (por ejemplo: Desayuno, Almuerzo, Cena, Merienda)"}
- Estado de legumbres (frijoles/garbanzos/lentejas): ${JSON.stringify(sensitiveAnswers?.legumbres || "No aplica")}
- Estado de proteína (carne/pollo/pescado/camarón): ${JSON.stringify(sensitiveAnswers?.proteina || "No aplica")}
- Extras disponibles: ${extraIngredientsChoice || "Ninguno, usar solo lo que la usuaria escribió"}

REGLAS DE NEGOCIO STRICTAS:
1. Genera exactamente 3 opciones de recetas rápidas y atractivas que se adapten idealmente al tipo de comida del día solicitado (${mealType || "el momento del día"}).
2. El tiempo aproximado de preparación debe ser realista, preciso y DIFERENTE para cada una de las 3 recetas, calculado según sus pasos (por ejemplo, "10 minutos", "18 minutos", "35 minutos"). No repitas el mismo tiempo por defecto (evita poner 25 minutos a todas).
3. Cada opción debe tener un nombre atractivo, y una descripción detallada de una imagen realista y apetitosa del resultado final para el campo "imageSuggestion" (en español).
4. NO uses ingredientes extra (cebolla, ajo, queso, huevo, atún, etc.) a menos que la usuaria los haya listado o los haya elegido en "Extras disponibles".
5. Asume que tiene agua, sal y un poco de aceite (a menos que la usuaria haya dicho explícitamente que no los tiene).
6. Tono: Adulto, práctico, claro, tranquilizador, directo. Sin explicaciones largas o análisis nutricionales. Sin decir "no alcanza" o "no se puede".
7. Estilo rápido y práctico. Tu misión es resolver con lo que hay.

Devuelve las 3 opciones de recetas en formato JSON estructurado.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un chef experto y práctico para 'Cocina con lo que tienes'. Tu único objetivo es resolver comidas rápidas con lo que hay en casa, de forma directa y sin rodeos.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["options"],
          properties: {
            options: {
              type: Type.ARRAY,
              description: "Lista de exactamente 3 opciones de recetas sugeridas",
              items: {
                type: Type.OBJECT,
                required: ["id", "name", "imageSuggestion", "timeEstimate", "shortDescription"],
                properties: {
                  id: { type: Type.INTEGER, description: "ID de la opción (1, 2, 3)" },
                  name: { type: Type.STRING, description: "Nombre atractivo de la receta" },
                  imageSuggestion: { type: Type.STRING, description: "Descripción detallada de una imagen realista y apetitosa del resultado final de este platillo" },
                  timeEstimate: { type: Type.STRING, description: "Tiempo estimado de preparación real, específico e individual de este plato (ej: '12 minutos', '20 minutos', '35 minutos'). Evita usar 25 minutos para todo; calcula el tiempo aproximado real." },
                  shortDescription: { type: Type.STRING, description: "Breve descripción de la idea y por qué funciona con lo que tiene" }
                }
              }
            }
          }
        }
      }
    });

    const jsonText = response.text?.trim() || "{}";
    const data = JSON.parse(jsonText);
    res.json(data);
  } catch (error: any) {
    console.error("Error generating options:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
});

// API endpoint: Generate selected recipe steps
app.post("/api/generate-recipe", async (req, res) => {
  try {
    const { optionName, ingredients, people, sensitiveAnswers, extraIngredientsChoice, mealType, timeEstimate } = req.body;

    if (!optionName) {
      return res.status(400).json({ error: "Falta el nombre de la opción elegida" });
    }

    const ai = getGeminiClient();

    let prompt = `Desarrolla la receta completa para la opción elegida: "${optionName}".

INFORMACIÓN DE ENTRADA:
- Ingredientes de la usuaria: ${ingredients}
- Personas: ${people || "No especificado"}
- Tipo de comida del día: ${mealType || "No especificado (por ejemplo: Desayuno, Almuerzo, Cena, Merienda)"}
- Respuestas de ingredientes sensibles: ${JSON.stringify(sensitiveAnswers || {})}
- Ingrediente extra elegido (si aplica): ${extraIngredientsChoice || "Ninguno"}
- Tiempo estimado previamente para esta opción: ${timeEstimate || "No especificado"}

REGLAS DE PREPARACIÓN DE LA RECETA:
1. Usa entre 4 y 7 pasos como máximo en la preparación. Agrupa instrucciones similares de forma clara.
2. Explica la receta completa desde cero de manera clara y práctica para un adulto ocupado.
3. Si el arroz, pasta, papa, yuca o camote están crudos (no se especificó que estén cocidos), explica cómo cocinarlos desde cero.
4. Si la proteína (carne, pollo, pescado, camarón) estaba congelada y la usuaria aceptó descongelarla, debes incluir este paso seguro en la preparación: "Descongela en microondas usando la función descongelar, o coloca la proteína en una bolsa bien cerrada dentro de agua fría. Cocínala apenas esté descongelada."
5. Asume agua, sal y un poco de aceite básicos, pero NO asumas otros ingredientes que la usuaria no mencionó.
6. Tono: Adulto, claro, práctico, directo, sin frases infantiles (como "pídele ayuda a un adulto" o "con tus manitas").
7. Enumera los ingredientes con cantidades aproximadas ajustadas para ${people || 2} personas.
8. En el campo "timeEstimate", debes usar exactamente el tiempo estimado previamente: "${timeEstimate || "20 minutos"}".

Devuelve la receta completa estructurada en formato JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un chef experto y práctico para 'Cocina con lo que tienes'. Creas recetas impecables, rápidas y realistas ajustadas exactamente a lo que el usuario tiene.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "timeEstimate", "ingredientsUsed", "preparationSteps"],
          properties: {
            name: { type: Type.STRING, description: "Nombre atractivo de la receta" },
            timeEstimate: { type: Type.STRING, description: "El tiempo aproximado exacto enviado en las instrucciones (ej: '" + (timeEstimate || "20 minutos") + "')" },
            ingredientsUsed: {
              type: Type.ARRAY,
              description: "Lista de ingredientes que se usarán con sus cantidades correspondientes",
              items: { type: Type.STRING }
            },
            preparationSteps: {
              type: Type.ARRAY,
              description: "Pasos claros y numerados para la preparación (entre 4 y 7 pasos)",
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const jsonText = response.text?.trim() || "{}";
    const data = JSON.parse(jsonText);
    res.json(data);
  } catch (error: any) {
    console.error("Error generating recipe:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
});

// Setup Vite or static serving
const isProduction = process.env.NODE_ENV === "production";

async function start() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
