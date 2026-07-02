import { useState, useEffect, FormEvent } from "react";
import { 
  Flame, 
  ChefHat, 
  Users, 
  Clock, 
  ChevronRight, 
  Check, 
  RotateCcw, 
  Sparkles, 
  CheckSquare, 
  HelpCircle,
  AlertCircle,
  ArrowLeft,
  Search,
  BookOpen,
  CheckCircle2
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface RecipeOption {
  id: number;
  name: string;
  imageSuggestion: string;
  timeEstimate: string;
  shortDescription: string;
}

interface FullRecipe {
  name: string;
  timeEstimate: string;
  ingredientsUsed: string[];
  preparationSteps: string[];
}

export default function App() {
  // Input State
  const [ingredientsText, setIngredientsText] = useState("");
  const [peopleCount, setPeopleCount] = useState<number | null>(null);
  const [mealType, setMealType] = useState<string | null>(null);
  
  // App States: 
  // 'input' -> 'people' -> 'meal_type' -> 'sensitive_check' -> 'extra_check' -> 'loading_options' -> 'options' -> 'loading_recipe' -> 'recipe'
  const [currentStep, setCurrentStep] = useState<
    "input" | "people" | "meal_type" | "sensitive_check" | "extra_check" | "loading_options" | "options" | "loading_recipe" | "recipe"
  >("input");

  // Sensitive ingredients state
  const [hasLegumbres, setHasLegumbres] = useState(false);
  const [legumbresCocidas, setLegumbresCocidas] = useState<string | null>(null); // 'si', 'no', 'no_segura'
  
  const [hasProteina, setHasProteina] = useState(false);
  const [proteinaLista, setProteinaLista] = useState<string | null>(null); // 'si', 'congelado_descongelar', 'congelado_no_usar'

  // Extra ingredients state (if simple ingredients are detected)
  const [isVerySimple, setIsVerySimple] = useState(false);
  const [extraIngredientsChoice, setExtraIngredientsChoice] = useState<string | null>(null);

  // Loaded Options & Recipe
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<RecipeOption | null>(null);
  const [fullRecipe, setFullRecipe] = useState<FullRecipe | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]); // for tracking choices or custom inputs

  // Mini chat / manual commands bar state
  const [chatCommand, setChatCommand] = useState("");

  // Helper to reset app
  const resetApp = () => {
    setIngredientsText("");
    setPeopleCount(null);
    setMealType(null);
    setHasLegumbres(false);
    setLegumbresCocidas(null);
    setHasProteina(false);
    setProteinaLista(null);
    setIsVerySimple(false);
    setExtraIngredientsChoice(null);
    setRecipeOptions([]);
    setSelectedOption(null);
    setFullRecipe(null);
    setLoadingError(null);
    setCurrentStep("input");
  };

  // Run checks on ingredients text to identify sensitive ones
  const handleIngredientsSubmit = () => {
    if (!ingredientsText.trim()) return;

    const lowerText = ingredientsText.toLowerCase();

    // Check legumbres
    const legumbresKeywords = ["frijol", "garbanzo", "lenteja", "habas", "poroto", "alubia", "alubias"];
    const containsLegumbre = legumbresKeywords.some(keyword => lowerText.includes(keyword));
    const specifiesCocido = lowerText.includes("cocido") || lowerText.includes("cocida") || lowerText.includes("cocidos") || lowerText.includes("cocidas") || lowerText.includes("bote") || lowerText.includes("lata");
    
    const needsLegumbreCheck = containsLegumbre && !specifiesCocido;
    setHasLegumbres(needsLegumbreCheck);
    if (!needsLegumbreCheck && containsLegumbre) {
      setLegumbresCocidas("si"); // marked as already cooked
    }

    // Check proteina
    const proteinaKeywords = ["carne", "pollo", "pescado", "camarón", "camaron", "bistec", "filete", "milanesa", "cerdo", "puerco", "res", "pechuga", "pavo"];
    const containsProteina = proteinaKeywords.some(keyword => lowerText.includes(keyword));
    const specifiesState = lowerText.includes("fresco") || lowerText.includes("descongelado") || lowerText.includes("descongelada") || lowerText.includes("congelado") || lowerText.includes("congelada") || lowerText.includes("listo");
    
    const needsProteinaCheck = containsProteina && !specifiesState;
    setHasProteina(needsProteinaCheck);
    if (!needsProteinaCheck && containsProteina) {
      if (lowerText.includes("congelado") || lowerText.includes("congelada")) {
        setProteinaLista("congelado_descongelar");
      } else {
        setProteinaLista("si"); // marked as fresh or thawed
      }
    }

    // Check if ingredients are extremely simple (e.g., fewer than 3 words or simple items)
    // Simple regex or count of ingredients
    const cleanList = lowerText.split(/[,y\n]+/).map(i => i.trim()).filter(i => i.length > 1);
    const veryFew = cleanList.length <= 3;
    const basicOnly = cleanList.every(item => 
      item.includes("arroz") || 
      item.includes("tomate") || 
      item.includes("papa") || 
      item.includes("zanahoria") || 
      item.includes("fideo") || 
      item.includes("pasta") ||
      item.includes("agua") ||
      item.includes("sal") ||
      item.includes("aceite")
    );
    setIsVerySimple(veryFew || basicOnly);

    // If people count is already in text (e.g. "para 2 personas" or "para 3"), extract it!
    const matchesPeople = lowerText.match(/(?:para\s+)?(\d+)\s*(?:personas?|porci|comensal)/);
    if (matchesPeople && matchesPeople[1]) {
      const parsed = parseInt(matchesPeople[1], 10);
      if (parsed >= 1 && parsed <= 10) {
        setPeopleCount(parsed);
        setCurrentStep("meal_type");
        return;
      }
    }

    setCurrentStep("people");
  };

  const handlePeopleSelect = (count: number) => {
    setPeopleCount(count);
    setCurrentStep("meal_type");
  };

  const handleMealTypeSelect = (type: string) => {
    setMealType(type);
    if (hasLegumbres || hasProteina) {
      setCurrentStep("sensitive_check");
    } else if (isVerySimple) {
      setCurrentStep("extra_check");
    } else {
      fetchRecipeOptions(peopleCount || 2, type, legumbresCocidas, proteinaLista, null);
    }
  };

  // Submit sensitive confirmations
  const handleSensitiveAnswersSubmit = () => {
    if (isVerySimple) {
      setCurrentStep("extra_check");
    } else {
      fetchRecipeOptions(peopleCount || 2, mealType, legumbresCocidas, proteinaLista, null);
    }
  };

  const handleExtraSubmit = (choice: string) => {
    setExtraIngredientsChoice(choice);
    fetchRecipeOptions(peopleCount || 2, mealType, legumbresCocidas, proteinaLista, choice);
  };

  // Fetch 3 options from backend
  const fetchRecipeOptions = async (
    people: number, 
    meal: string | null,
    legCocido: string | null, 
    protListo: string | null, 
    extraChoice: string | null
  ) => {
    setCurrentStep("loading_options");
    setLoadingError(null);

    const sensitiveAnswers = {
      legumbres: legCocido === "si" ? "Ya cocidos" : legCocido === "no" ? "Secos" : "No estoy segura",
      proteina: protListo === "si" ? "Fresco/Descongelado" : protListo === "congelado_descongelar" ? "Congelado (descongelar)" : "Congelado y prefiere no usar"
    };

    try {
      const response = await fetch("/api/generate-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ingredientsText,
          people: people,
          mealType: meal,
          sensitiveAnswers,
          extraIngredientsChoice: extraChoice
        })
      });

      if (!response.ok) {
        throw new Error("No pudimos generar opciones rápidas en este momento.");
      }

      const data = await response.json();
      if (data && data.options && data.options.length > 0) {
        setRecipeOptions(data.options);
        setCurrentStep("options");
      } else {
        throw new Error("No se encontraron opciones válidas.");
      }
    } catch (err: any) {
      setLoadingError(err.message || "Error al conectar con la cocina.");
      setCurrentStep("input");
    }
  };

  // Fetch full recipe for selected option
  const fetchFullRecipe = async (option: RecipeOption) => {
    setSelectedOption(option);
    setCurrentStep("loading_recipe");
    setLoadingError(null);

    const sensitiveAnswers = {
      legumbres: legumbresCocidas === "si" ? "Ya cocidos" : legumbresCocidas === "no" ? "Secos" : "No estoy segura",
      proteina: proteinaLista === "si" ? "Fresco/Descongelado" : proteinaLista === "congelado_descongelar" ? "Congelado (descongelar)" : "Congelado y prefiere no usar"
    };

    try {
      const response = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionName: option.name,
          ingredients: ingredientsText,
          people: peopleCount || 2,
          mealType,
          sensitiveAnswers,
          extraIngredientsChoice,
          timeEstimate: option.timeEstimate
        })
      });

      if (!response.ok) {
        throw new Error("No pudimos cargar los detalles de esta receta.");
      }

      const data = await response.json();
      setFullRecipe(data);
      setCurrentStep("recipe");
    } catch (err: any) {
      setLoadingError(err.message || "Error al preparar la receta.");
      setCurrentStep("options");
    }
  };

  // Handle direct manual commands or typed selections in bottom bar
  const handleChatCommandSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const command = chatCommand.trim().toLowerCase();
    if (!command) return;

    setChatCommand("");

    // Reset command
    if (command.includes("nuevo") || command.includes("reiniciar") || command.includes("cambiar")) {
      resetApp();
      return;
    }

    // Other options command
    if (command.includes("otras opciones") || command.includes("mas ideas") || command.includes("más ideas") || command.includes("otra opcion") || command.includes("otras")) {
      fetchRecipeOptions(peopleCount || 2, mealType, legumbresCocidas, proteinaLista, extraIngredientsChoice);
      return;
    }

    // Option selections
    if (command.includes("opción 1") || command.includes("opcion 1") || command === "1") {
      const opt = recipeOptions.find(o => o.id === 1);
      if (opt) fetchFullRecipe(opt);
      return;
    }
    if (command.includes("opción 2") || command.includes("opcion 2") || command === "2") {
      const opt = recipeOptions.find(o => o.id === 2);
      if (opt) fetchFullRecipe(opt);
      return;
    }
    if (command.includes("opción 3") || command.includes("opcion 3") || command === "3") {
      const opt = recipeOptions.find(o => o.id === 3);
      if (opt) fetchFullRecipe(opt);
      return;
    }

    // If the user typed some ingredients when starting
    if (currentStep === "input") {
      setIngredientsText(chatCommand);
      handleIngredientsSubmit();
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-brand-200">
      {/* Header */}
      <header className="border-b border-stone-200/80 bg-white/75 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetApp}>
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
              <Flame className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-stone-900 leading-none">
                Cocina con lo que tienes
              </h1>
              <span className="text-xs text-stone-500 font-medium tracking-tight">
                Ayuda rápida & práctica para comer rico hoy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={resetApp}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-grow flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: Ingredient Input Form */}
          {currentStep === "input" && (
            <motion.div 
              key="input-step"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 w-full max-w-2xl mx-auto"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex p-2 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-500">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-extrabold text-stone-900 tracking-tight">
                  ¿Qué tienes en tu despensa o refrigerador?
                </h2>
                <p className="text-sm text-stone-600 max-w-md mx-auto">
                  Dime los ingredientes principales que quieres usar y preparemos algo delicioso en minutos.
                </p>
              </div>

              {loadingError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Algo salió mal:</span> {loadingError}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-stone-200/95 shadow-sm p-6 space-y-4">
                <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-600 leading-relaxed border border-stone-100">
                  <p className="font-semibold text-stone-800 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-brand-500" /> Cómo escribirlo:
                  </p>
                  <p className="font-medium text-stone-700">“Escribe aquí lo que tienes y sus cantidades aproximadas.</p>
                  <p className="mt-1 text-stone-500">Ejemplo:<br/>3 huevos, 1 libra de carne, 2 tomates, arroz, 4 tortillas y un poco de queso.</p>
                  <p className="mt-1 text-stone-500">También puedes aclarar si algo ya está listo o congelado:<br/>frijoles cocidos, arroz cocido, pollo congelado, carne descongelada.</p>
                  <p className="mt-2 text-stone-700 font-medium">Asumo que tienes agua, sal y un poco de aceite. Si no tienes alguno, escríbelo también.”</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Tus ingredientes
                  </label>
                  <textarea
                    rows={4}
                    value={ingredientsText}
                    onChange={(e) => setIngredientsText(e.target.value)}
                    placeholder="Escribe tus ingredientes aquí..."
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-medium leading-relaxed resize-none shadow-inner"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleIngredientsSubmit}
                  disabled={!ingredientsText.trim()}
                  className="w-full bg-brand-500 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-600 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-brand-500/15 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Ask for People Count */}
          {currentStep === "people" && (
            <motion.div 
              key="people-step"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 w-full max-w-md mx-auto text-center"
            >
              <div className="space-y-2">
                <div className="inline-flex p-2 bg-stone-100 rounded-full text-stone-600">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-extrabold text-stone-900 tracking-tight">
                  ¿Para cuántas personas vas a cocinar?
                </h3>
                <p className="text-sm text-stone-500">
                  Esto nos ayuda a ajustar las proporciones de los ingredientes.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePeopleSelect(num)}
                    className="h-16 rounded-xl border-2 border-stone-200/90 bg-white font-display font-bold text-lg text-stone-800 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm"
                  >
                    <span>{num}</span>
                    <span className="text-[10px] font-sans font-medium text-stone-500">
                      {num === 1 ? "persona" : "personas"}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentStep("input")}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1.5 mx-auto mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver a los ingredientes
              </button>
            </motion.div>
          )}

          {/* STEP 2.5: Ask for Meal Type (Desayuno, Almuerzo, Cena, Merienda) */}
          {currentStep === "meal_type" && (
            <motion.div 
              key="meal-type-step"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 w-full max-w-md mx-auto text-center"
            >
              <div className="space-y-2">
                <div className="inline-flex p-2 bg-brand-50 rounded-full text-brand-500 border border-brand-100">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-xl font-display font-extrabold text-stone-900 tracking-tight">
                  ¿Qué comida vas a preparar?
                </h3>
                <p className="text-sm text-stone-500">
                  Personalizaremos las 3 ideas rápidas para este momento del día.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: "Desayuno", emoji: "🍳", desc: "Inicio del día" },
                  { type: "Almuerzo", emoji: "🍲", desc: "Comida fuerte" },
                  { type: "Cena", emoji: "🥗", desc: "Ligero y rápido" },
                  { type: "Merienda", emoji: "🥪", desc: "Entre comidas" }
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleMealTypeSelect(item.type)}
                    className="p-4 rounded-xl border-2 border-stone-200/90 bg-white hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-1 shadow-sm text-center"
                  >
                    <span className="text-3xl mb-1">{item.emoji}</span>
                    <span className="font-display font-bold text-stone-800 block text-sm leading-tight">
                      {item.type}
                    </span>
                    <span className="text-[10px] font-sans font-medium text-stone-500">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentStep("people")}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1.5 mx-auto mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al número de personas
              </button>
            </motion.div>
          )}

          {/* STEP 3: Sensitive Checks */}
          {currentStep === "sensitive_check" && (
            <motion.div 
              key="sensitive-step"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 w-full max-w-md mx-auto"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex p-2 bg-amber-50 rounded-full border border-amber-100 text-amber-500">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-extrabold text-stone-900 tracking-tight">
                  Preguntas rápidas antes de empezar
                </h3>
                <p className="text-xs text-stone-500">
                  Solo queremos asegurarnos de sugerirte recetas que puedas cocinar de inmediato.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/95 shadow-sm p-6 space-y-6">
                {/* Legumbres check */}
                {hasLegumbres && (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-stone-800">
                      Pregunta rápida: ¿tus legumbres (frijoles/garbanzos/lentejas) ya están cocidos?
                    </p>
                    <div className="flex flex-col gap-2">
                      {[
                        { val: "si", label: "Sí, ya están cocidos o son de lata" },
                        { val: "no", label: "No, están secos" },
                        { val: "no_segura", label: "No estoy segura" }
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setLegumbresCocidas(opt.val)}
                          className={`w-full py-3 px-4 text-left text-sm rounded-xl border font-medium transition-all flex items-center justify-between ${
                            legumbresCocidas === opt.val 
                              ? "border-brand-500 bg-brand-50/55 text-brand-700 font-bold" 
                              : "border-stone-200 text-stone-700 hover:bg-stone-50"
                          }`}
                        >
                          {opt.label}
                          {legumbresCocidas === opt.val && <Check className="w-4 h-4 text-brand-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Protein check */}
                {hasProteina && (
                  <div className="space-y-3 pt-2 border-t border-stone-100">
                    <p className="text-sm font-bold text-stone-800">
                      Pregunta rápida: ¿tu proteína (carne/pollo/pescado/camarón) está lista para cocinar?
                    </p>
                    <div className="flex flex-col gap-2">
                      {[
                        { val: "si", label: "Sí, está fresca o descongelada" },
                        { val: "congelado_descongelar", label: "Está congelada, pero puedo descongelarla ahora" },
                        { val: "congelado_no_usar", label: "Está congelada y prefiero usar otros ingredientes" }
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setProteinaLista(opt.val)}
                          className={`w-full py-3 px-4 text-left text-sm rounded-xl border font-medium transition-all flex items-center justify-between ${
                            proteinaLista === opt.val 
                              ? "border-brand-500 bg-brand-50/55 text-brand-700 font-bold" 
                              : "border-stone-200 text-stone-700 hover:bg-stone-50"
                          }`}
                        >
                          {opt.label}
                          {proteinaLista === opt.val && <Check className="w-4 h-4 text-brand-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSensitiveAnswersSubmit}
                  disabled={(hasLegumbres && !legumbresCocidas) || (hasProteina && !proteinaLista)}
                  className="w-full bg-brand-500 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-600 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-brand-500/15 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setCurrentStep("meal_type")}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver atrás
              </button>
            </motion.div>
          )}

          {/* STEP 4: Extra Simple Option Checklist */}
          {currentStep === "extra_check" && (
            <motion.div 
              key="extra-step"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 w-full max-w-md mx-auto"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex p-2 bg-brand-50 rounded-full border border-brand-100 text-brand-500">
                  <Sparkles className="w-6 h-6 animate-spin-slow" />
                </div>
                <h3 className="text-xl font-display font-extrabold text-stone-900 tracking-tight">
                  ¿Tienes algún ingrediente extra?
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed">
                  “Para darte mejores opciones, ¿también tienes alguno de estos?”
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/95 shadow-sm p-6 space-y-3">
                {[
                  { id: "huevo", label: "🥚 Huevo" },
                  { id: "queso", label: "🧀 Queso" },
                  { id: "atun", label: "🐟 Atún" },
                  { id: "tortillas", label: "🫓 Tortillas" },
                  { id: "ninguno", label: "Ninguno, usar solo lo que escribí" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleExtraSubmit(item.label)}
                    className="w-full py-3.5 px-4 text-left text-sm font-semibold rounded-xl border border-stone-200 hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-700 active:scale-[0.99] transition-all flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentStep("meal_type")}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver atrás
              </button>
            </motion.div>
          )}

          {/* LOADING OPTIONS */}
          {currentStep === "loading_options" && (
            <motion.div 
              key="loading-options"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4 max-w-sm mx-auto"
            >
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-brand-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-brand-500 rounded-full animate-spin"></div>
                <Flame className="w-6 h-6 text-brand-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-stone-900">
                  Pensando rápido...
                </h4>
                <p className="text-xs text-stone-500">
                  Analizando tus ingredientes para ofrecerte 3 ideas prácticas y deliciosas.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Three Recipe Options (Initial Presentation) */}
          {currentStep === "options" && (
            <motion.div 
              key="options-step"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 w-full"
            >
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-display font-extrabold text-stone-900 tracking-tight">
                  Estas son 3 ideas rápidas con lo que tienes
                </h2>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Elige la opción que más te guste para ver su preparación completa paso a paso.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                {recipeOptions.map((opt) => (
                  <motion.div
                    key={opt.id}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md hover:border-brand-200 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Generative Visual Header */}
                      <div className="h-32 bg-gradient-to-br from-brand-100 to-brand-50/40 relative flex items-center justify-center p-4 border-b border-stone-100">
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Clock className="w-3 h-3 text-brand-500" />
                          <span className="text-[10px] font-bold text-stone-700">{opt.timeEstimate}</span>
                        </div>
                        
                        <div className="text-center space-y-1">
                          <span className="text-2xl">
                            {opt.id === 1 ? "🍲" : opt.id === 2 ? "🍳" : "🥗"}
                          </span>
                          <span className="block text-[10px] uppercase font-bold tracking-wider text-brand-600">
                            Opción {opt.id}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2">
                        <h3 className="font-display font-extrabold text-stone-900 leading-snug">
                          {opt.name}
                        </h3>
                        <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                          {opt.shortDescription}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        onClick={() => fetchFullRecipe(opt)}
                        className="w-full py-2 bg-brand-50 hover:bg-brand-500 hover:text-white border border-brand-100 text-brand-600 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
                      >
                        Ver receta completa
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      
                      <div className="text-[9px] text-center text-stone-400 font-medium mt-1.5">
                        Para ver la receta, responde: <strong>Opción {opt.id}</strong>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-100">
                <button
                  onClick={() => setCurrentStep("input")}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Cambiar ingredientes
                </button>

                <button
                  onClick={() => fetchRecipeOptions(peopleCount || 2, mealType, legumbresCocidas, proteinaLista, extraIngredientsChoice)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Dificultades o quieres otras ideas? Generar otras 3 opciones
                </button>
              </div>
            </motion.div>
          )}

          {/* LOADING RECIPE */}
          {currentStep === "loading_recipe" && (
            <motion.div 
              key="loading-recipe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4 max-w-sm mx-auto"
            >
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-brand-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-brand-500 rounded-full animate-spin"></div>
                <ChefHat className="w-6 h-6 text-brand-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-stone-900">
                  Cocinando las instrucciones...
                </h4>
                <p className="text-xs text-stone-500">
                  Estructurando los pasos de manera rápida y práctica para ti.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 6: Full Recipe View */}
          {currentStep === "recipe" && fullRecipe && (
            <motion.div 
              key="recipe-step"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 w-full max-w-2xl mx-auto"
            >
              <div className="space-y-2">
                <button
                  onClick={() => setCurrentStep("options")}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 active:translate-x-[-2px] transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a las 3 opciones
                </button>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
                    {fullRecipe.name}
                  </h1>

                  <div className="inline-flex flex-wrap items-center gap-3 bg-stone-100 px-3.5 py-1.5 rounded-full border border-stone-200/40 text-stone-700 shrink-0 self-start">
                    {mealType && (
                      <>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600">
                          <span>{mealType === "Desayuno" ? "🍳" : mealType === "Almuerzo" ? "🍲" : mealType === "Cena" ? "🥗" : "🥪"}</span>
                          <span>{mealType}</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-stone-300 hidden sm:block"></div>
                      </>
                    )}
                    <div className="flex items-center gap-1 text-xs font-bold">
                      <Clock className="w-4 h-4 text-brand-500" />
                      {fullRecipe.timeEstimate}
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div>
                    <div className="flex items-center gap-1 text-xs font-bold">
                      <Users className="w-4 h-4 text-brand-500" />
                      {peopleCount || 2} { (peopleCount || 2) === 1 ? "persona" : "personas" }
                    </div>
                  </div>
                </div>
              </div>

              {/* Ingredients card */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-stone-800">
                    Ingredientes que usarás
                  </h3>
                </div>

                <ul className="grid sm:grid-cols-2 gap-3">
                  {fullRecipe.ingredientsUsed.map((ingredient, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm font-medium text-stone-700">
                      <div className="w-5 h-5 rounded bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span>{ingredient}</span>
                    </li>
                  ))}
                  {/* Default basic ingredients reminder */}
                  <li className="flex items-start gap-2.5 text-sm font-medium text-stone-400 italic sm:col-span-2 mt-1 pt-2 border-t border-dashed border-stone-100">
                    <CheckCircle2 className="w-4 h-4 text-stone-300 shrink-0 mt-0.5" />
                    <span>Se asume agua, sal y un toque de aceite (básicos de cocina).</span>
                  </li>
                </ul>
              </div>

              {/* Preparation Card */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
                  <div className="w-8 h-8 rounded-lg bg-stone-50 text-stone-700 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-stone-800">
                    Preparación paso a paso
                  </h3>
                </div>

                <div className="space-y-4">
                  {fullRecipe.preparationSteps.map((step, idx) => (
                    <div 
                      key={idx}
                      className="flex gap-4 group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-700 border border-stone-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-brand-50 group-hover:text-brand-600 group-hover:border-brand-200 transition-colors">
                        {idx + 1}
                      </div>
                      <p className="text-sm font-medium text-stone-700 leading-relaxed pt-0.5 group-hover:text-stone-950 transition-colors">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <button
                  onClick={() => setCurrentStep("options")}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver a las opciones
                </button>

                <button
                  onClick={resetApp}
                  className="px-5 py-3 rounded-xl bg-brand-500 text-white font-bold text-xs hover:bg-brand-600 transition-all flex items-center gap-2 shadow-md shadow-brand-500/10"
                >
                  <RotateCcw className="w-4 h-4" />
                  Hacer otra consulta rápida
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Manual / Text Chat Interactivity Bar */}
      <footer className="bg-stone-900 text-white py-4 border-t border-stone-800 sticky bottom-0 z-40 shadow-2xl">
        <div className="max-w-xl mx-auto px-4">
          <form onSubmit={handleChatCommandSubmit} className="flex gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={chatCommand}
                onChange={(e) => setChatCommand(e.target.value)}
                placeholder={
                  currentStep === "input"
                    ? "O escribe tus ingredientes directamente aquí..."
                    : currentStep === "options"
                    ? "Responde 'Opción 1', 'Opción 2', 'Opción 3' u 'otras opciones'..."
                    : "Escribe 'reiniciar' para empezar de nuevo..."
                }
                className="w-full bg-stone-800 text-stone-100 placeholder-stone-400 text-xs px-4 py-2.5 rounded-xl border border-stone-700 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 pr-10"
              />
              <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
            </div>
            <button
              type="submit"
              className="bg-brand-500 hover:bg-brand-600 active:scale-95 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-brand-500/15"
            >
              Enviar
            </button>
          </form>
          <p className="text-[10px] text-stone-400 text-center mt-1.5 font-medium">
            💡 Puedes responder por texto o hacer clic directamente en los botones.
          </p>
        </div>
      </footer>
    </div>
  );
}
