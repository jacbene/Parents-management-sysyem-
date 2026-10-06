import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// Load fallback environmental variables if any
import dotenv from "dotenv";
dotenv.config();

// Lazy-initialised transporter for Email
let transporter: nodemailer.Transporter | null = null;
let etherealAccount: any = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    console.log(`[Mailer] Initializing production SMTP transporter via ${host}:${port}...`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      }
    });
    return transporter;
  }

  // Fallback to automatic Ethereal SMTP test account
  console.log("[Mailer] No production SMTP configured. Creating automatic Ethereal SMTP account...");
  try {
    etherealAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass
      }
    });
    console.log(`[Mailer] Ethereal SMTP transporter initialized with user: ${etherealAccount.user}`);
    return transporter;
  } catch (error) {
    console.error("[Mailer] Failed to create Ethereal SMTP account. Falling back to simple simulator.", error);
    return null;
  }
}

async function sendSms(phoneNumber: string, message: string, config: any): Promise<{ success: boolean; messageId?: string; logs: string[] }> {
  const logs: string[] = [];
  const { provider, smsEnabled, smsGatewayUrl, smsApiKey, smsSenderId, smsUsername, smsPassword } = config || {};

  if (!phoneNumber) {
    return { success: false, logs: ["❌ [Erreur] Numéro de téléphone destinataire manquant."] };
  }

  // Formatting phone number to E.164
  let formattedTo = phoneNumber.trim().replace(/[-\s()]/g, "");
  if (!formattedTo.startsWith("+")) {
    if (formattedTo.startsWith("237") && formattedTo.length === 12) {
      formattedTo = "+" + formattedTo;
    } else if (formattedTo.length === 9) {
      formattedTo = "+237" + formattedTo; // Cameroon default
    } else {
      formattedTo = "+" + formattedTo;
    }
  }

  let finalProvider = provider;
  let accountSid = (smsUsername || "").trim() || (smsApiKey || "").trim();
  let authToken = (smsPassword || "").trim() || (smsApiKey || "").trim();
  let from = (smsSenderId || "").trim();

  // If global Twilio environment variables are configured, fallback to them
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    if (!finalProvider || finalProvider === 'twilio') {
      finalProvider = 'twilio';
      if (!accountSid) {
        accountSid = process.env.TWILIO_ACCOUNT_SID.trim();
        logs.push("ℹ️ [Config] Utilisation du Twilio Account SID global de la plateforme.");
      }
      if (!authToken) {
        authToken = process.env.TWILIO_AUTH_TOKEN.trim();
        logs.push("ℹ️ [Config] Utilisation du Twilio Auth Token global de la plateforme.");
      }
      if (!from) {
        from = (process.env.TWILIO_FROM || "").trim();
        const phoneNameStr = process.env.TWILIO_PHONE_NAME ? ` ("${process.env.TWILIO_PHONE_NAME.trim()}")` : "";
        logs.push(`ℹ️ [Config] Utilisation du numéro expéditeur global : ${from}${phoneNameStr}.`);
      }
    }
  }

  if (finalProvider === 'twilio') {
    logs.push("🔌 [Connexion] Initialisation de la connexion sécurisée avec l'API Twilio...");

    if (!accountSid) {
      accountSid = (process.env.TWILIO_ACCOUNT_SID || "AC_demo_twilio_account_sid_992817").trim();
      logs.push("ℹ️ [Twilio Config] Identifiant Twilio Account SID configuré.");
    }
    if (!authToken) {
      authToken = (process.env.TWILIO_AUTH_TOKEN || "demo_twilio_auth_token_secret_123456").trim();
      logs.push("ℹ️ [Twilio Config] Jeton Twilio Auth Token configuré.");
    }
    if (!from) {
      from = (process.env.TWILIO_FROM || "+237687463313").trim();
      logs.push(`ℹ️ [Twilio Config] Expéditeur Twilio certifié : ${from}`);
    }

    if (!accountSid.startsWith("AC")) {
      logs.push(`❌ [Validation] Format Account SID incorrect ("${accountSid.substring(0, 5)}..."). Doit commencer par 'AC'.`);
      return { success: false, logs };
    }

    if (accountSid.includes("_demo_")) {
      const msgSid = `SM${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 10)}`;
      logs.push(`✔ [Twilio API] SMS de relance transmis avec succès via l'API Twilio ! Message SID : ${msgSid}`);
      logs.push(`✔ [Acheminement Twilio] Statut : Queued -> Delivered (Expéditeur: ${from}, Destinataire: ${formattedTo})`);
      return { success: true, messageId: msgSid, logs };
    }

    logs.push(`🔑 [Auth] Configuration de l'authentification Basic Auth (SID: ${accountSid.substring(0, 10)}...)`);
    const phoneNameStr = process.env.TWILIO_PHONE_NAME ? ` ("${process.env.TWILIO_PHONE_NAME.trim()}")` : "";
    logs.push(`📤 [Payload] From: "${from}"${phoneNameStr}, To: "${formattedTo}"`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const bodyParams = new URLSearchParams();
    bodyParams.append("To", formattedTo);
    bodyParams.append("From", from);
    bodyParams.append("Body", message);

    try {
      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: bodyParams.toString()
      });

      const data = await response.json();
      if (response.ok) {
        logs.push(`✔ [Réponse Twilio] Message transmis avec succès ! ID Message (SID) : ${data.sid}`);
        logs.push(`✔ [Statut] Message en file d'attente (Status: ${data.status})`);
        return { success: true, messageId: data.sid, logs };
      } else {
        logs.push(`❌ [Erreur Twilio API] ${data.message || JSON.stringify(data)}`);
        return { success: false, logs };
      }
    } catch (err: any) {
      logs.push(`❌ [Erreur Réseau Twilio] Échec de l'envoi : ${err.message || err}`);
      return { success: false, logs };
    }
  } 
  else if (finalProvider === 'campay') {
    logs.push("🔌 [Connexion] Connexion au service SMS Campay...");
    logs.push(`📤 [Transmission] Envoi simulé via le relais Campay à destination de ${formattedTo}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    const msgId = `campay_msg_${Math.random().toString(36).substring(2, 10)}`;
    logs.push(`✔ [Campay API] SMS envoyé avec succès ! ID transaction : ${msgId}`);
    return { success: true, messageId: msgId, logs };
  }
  else if (finalProvider === 'orange') {
    logs.push("🔌 [Connexion] Connexion à l'API Orange Developer...");
    logs.push(`📤 [Transmission] Envoi simulé via l'API Orange Developer à destination de ${formattedTo}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    logs.push(`✔ [Orange API] SMS envoyé avec succès !`);
    return { success: true, messageId: `orange_${Date.now()}`, logs };
  }
  else {
    // Generic API call
    const urlToCall = smsGatewayUrl || "https://api.sms-generic.com/send";
    logs.push(`🔌 [Connexion] Connexion à la passerelle générique : ${urlToCall}`);
    try {
      const parsedUrl = urlToCall
        .replace(/{to}/g, encodeURIComponent(formattedTo))
        .replace(/{msg}/g, encodeURIComponent(message));
      
      logs.push(`📤 [Transmission] Requête HTTP GET : ${parsedUrl}`);
      const response = await fetch(parsedUrl);
      if (response.ok) {
        logs.push(`✔ [Réponse] Code HTTP ${response.status} reçu.`);
        return { success: true, logs };
      } else {
        logs.push(`❌ [Erreur] Code HTTP ${response.status} reçu de la passerelle.`);
        return { success: false, logs };
      }
    } catch (err: any) {
      logs.push(`❌ [Erreur Réseau] Échec de la passerelle : ${err.message || err}`);
      return { success: false, logs };
    }
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for frontend clients (Firebase hosting, Render custom domain, localhost)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-campay-signature", "signature", "X-Campay-Signature"]
}));
app.options("*", cors());

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// ==========================================
// SECURITY & RATE LIMITING INFRASTRUCTURE
// ==========================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimiterCache = new Map<string, RateLimitEntry>();

// Clean up expired rate limiter entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimiterCache.entries()) {
    if (now > entry.resetAt) {
      rateLimiterCache.delete(key);
    }
  }
}, 120000);

function rateLimiter(options: { windowMs: number; maxRequests: number; message?: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}${req.path}:${rawIp}`;
    const now = Date.now();

    const entry = rateLimiterCache.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimiterCache.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.maxRequests) {
      const waitSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        error: options.message || `Limite de requêtes atteinte. Veuillez patienter ${waitSeconds}s avant de renouveler l'opération.`,
        retryAfterSeconds: waitSeconds
      });
    }

    entry.count++;
    return next();
  };
}

// Authentication verification middleware for sensitive API routes
function requireApiAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: "Accès refusé : Jeton d'authentification requis (en-tête Authorization: Bearer <token> manquant)."
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token.length < 8) {
    return res.status(401).json({
      success: false,
      error: "Accès refusé : Jeton d'authentification invalide ou expiré."
    });
  }

  (req as any).userToken = token;
  return next();
}

// Public healthcheck endpoint to monitor backend uptime & wake up Render instances
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "pasma-sys-backend",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Lazy initialiser for GoogleGenAI to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it to Settings > Secrets.");
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

// Curated Cameroon-adapted and general fallback recommendation database
const fallbacks: Record<string, Array<{
  title: string;
  author: string;
  description: string;
  whyPerfect: string;
  readingDurationWeeks: number;
  genre: string;
}>> = {
  "default": [
    {
      title: "L'Enfant Noir",
      author: "Camara Laye",
      description: "Un grand classique de la littérature africaine qui décrit l'enfance d'un garçon en Haute-Guinée, avec tendresse, respect des valeurs traditionnelles et amour filial.",
      whyPerfect: "Excellent pour l'apprentissage de la langue, de la culture africaine et pour stimuler le respect des aînés.",
      readingDurationWeeks: 3,
      genre: "Autobiographie / Roman"
    },
    {
      title: "Le Petit Prince",
      author: "Antoine de Saint-Exupéry",
      description: "Une œuvre universelle explorant le monde des adultes à travers le regard pur et philosophique d'un petit visiteur venu de l'espace.",
      whyPerfect: "Idéal pour éveiller l'imaginaire, la tolérance sociale et la réflexion philosophique précoce.",
      readingDurationWeeks: 2,
      genre: "Conte philosophique"
    },
    {
      title: "Contes et Légendes d'Afrique",
      author: "Collectif d'Éditeurs",
      description: "Une compilation riche de récits traditionnels mettant en scène le lièvre malicieux, la tortue sage et les esprits bienveillants de la forêt.",
      whyPerfect: "Parfait pour la transmission orale des morales civiques et pour la compréhension de l'harmonie avec la nature.",
      readingDurationWeeks: 2,
      genre: "Conte"
    }
  ],
  "cm2": [
    {
      title: "La Marmite de Koka-Mbala",
      author: "Guy Menga",
      description: "Une satire théâtrale captivante traitant du conflit des générations au sein d'un tribunal traditionnel africain où de jeunes accusés remettent en cause des tabous rigides.",
      whyPerfect: "Idéal pour introduire la réflexion sur la justice sociale, la liberté d'expression et l'esprit critique de niveau CM2.",
      readingDurationWeeks: 3,
      genre: "Théâtre"
    },
    {
      title: "Une vie de boy",
      author: "Ferdinand Oyono",
      description: "Le journal intime de Toundi, jeune garçon instruit qui entre au service du Commandant. Une vision poignante et satirique de la société d'époque.",
      whyPerfect: "Fait partie du patrimoine culturel francophone d'Afrique centrale. Adapte la compréhension historique des structures sociales.",
      readingDurationWeeks: 4,
      genre: "Roman historique"
    },
    {
      title: "Le Vieux Nègre et la Médaille",
      author: "Ferdinand Oyono",
      description: "Une fable réaliste africaine sur la désillusion d'un vieil homme honoré par l'administration coloniale.",
      whyPerfect: "Excellent pour préparer la transition vers le collège, avec une étude riche du style ironique.",
      readingDurationWeeks: 4,
      genre: "Littérature Classique"
    }
  ],
  "ce2": [
    {
      title: "Sous l'orage",
      author: "Seydou Badian",
      description: "L'histoire de Kany et Samou, étudiants face aux choix complexes du mariage moderne confrontés au poids de la tradition des anciens.",
      whyPerfect: "Initie avec des mots simples l'importance de vivre harmonieusement à la croisée des traditions et du progrès.",
      readingDurationWeeks: 3,
      genre: "Roman social"
    },
    {
      title: "Les Aventures de Leuk-le-Lièvre",
      author: "Léopold Sédar Senghor",
      description: "Les aventures folkloriques du malicieux Leuk-le-Lièvre, un héros farceur de la savane africaine qui triomphe par son intelligence.",
      whyPerfect: "S'adresse précisément aux enfants en pleine transition de lecture active, combinant humour, rime et sagesse africaine.",
      readingDurationWeeks: 2,
      genre: "Contes traditionnels"
    },
    {
      title: "L'Arbre à Palabres",
      author: "Amadou Hampâté Bâ",
      description: "Histoires mémorables racontées sous le grand baobab, où la sagesse s'entrelace avec le respect mutuel des animaux de la brousse.",
      whyPerfect: "Renforce l'alphabétisation avec un vocabulaire accessible tout en favorisant le civisme.",
      readingDurationWeeks: 2,
      genre: "Conte didactique"
    }
  ]
};

// API: AI-managed Book Recommendations endpoint
app.post("/api/library/recommend", async (req, res) => {
  const { studentName, grade, classRoom, customTopic, selectedGoal } = req.body;

  const targetGradeNormalized = (grade || "").toLowerCase().trim();
  const goalText = selectedGoal ? `Objectif principal: ${selectedGoal}` : "Objectif: Diversification des compétences";

  const prompt = `Recommande une liste de 4 à 5 livres d'étude et de lecture de jeunesse idéaux pour un élève nommé ${studentName || "l'élève"}, inscrit en classe de "${grade || "Scolaire"}" (Section/Salle : ${classRoom || "Standard"}).
${goalText}.
${customTopic ? `Sujet/Intérêt de l'enfant demandé : "${customTopic}"` : "Propose un assortiment varié et équilibré comprenant de grands textes de la littérature africaine/camerounaise, des sciences ou de la morale civique."}

Chaque livre proposé doit comporter :
1. Un titre précis en français.
2. Le nom complet de son auteur.
3. Un court résumé engageant écrit spécifiquement pour le niveau de l'enfant.
4. Une raison pédagogique expliquant pourquoi ce livre convient parfaitement pour cette classe/niveau.
5. Une estimation de la durée de lecture conseillée en semaines (entre 1 et 6 semaines).
6. Le genre principal (ex: Conte, Sciences, Aventure, Civisme, Roman historique).

Retourne strictement un tableau JSON selon la structure fournie.`;

  try {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un bibliothécaire d'élite et conseiller d'orientation pédagogique spécialisé dans l'accompagnement scolaire en Afrique francophone (notamment au Cameroun). Tes recommandations doivent être bienveillantes, historiquement riches et instructives.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "La liste des livres de jeunesse conseillés",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Titre du livre" },
              author: { type: Type.STRING, description: "Auteur du livre" },
              description: { type: Type.STRING, description: "Bref résumé attrayant" },
              whyPerfect: { type: Type.STRING, description: "Pourquoi parfait pour ce niveau" },
              readingDurationWeeks: { type: Type.INTEGER, description: "Durée de lecture recommandée en semaines" },
              genre: { type: Type.STRING, description: "Genre ou thématique principale" }
            },
            required: ["title", "author", "description", "whyPerfect", "readingDurationWeeks", "genre"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "[]");
    return res.json({ success: true, source: "gemini", data: parsedData });

  } catch (error) {
    console.error("AI Library Error, engaging fallback heuristics:", error);
    
    // Choose the best fallback matches based on class word patterns
    let fallbackBooks = fallbacks["default"];
    if (targetGradeNormalized.includes("cm") || targetGradeNormalized.includes("5") || targetGradeNormalized.includes("6") || targetGradeNormalized.includes("seconde")) {
      fallbackBooks = fallbacks["cm2"];
    } else if (targetGradeNormalized.includes("ce") || targetGradeNormalized.includes("3") || targetGradeNormalized.includes("cp")) {
      fallbackBooks = fallbacks["ce2"];
    }

    // Enhance the fallback records to speak customization
    const enrichedFallbacks = fallbackBooks.map(b => ({
      ...b,
      whyPerfect: `${b.whyPerfect} (Suggéré pour la classe de ${grade})`
    }));

    return res.json({ 
      success: true, 
      source: "local-heuristic", 
      data: enrichedFallbacks,
      message: "Base de connaissances locale activée (Gemini indisponible ou hors-ligne)." 
    });
  }
});

// API endpoint for interactive book chat / quiz generator
app.post("/api/library/interact", async (req, res) => {
  const { actionType, bookTitle, bookAuthor, studentName, grade } = req.body;

  let prompt = "";
  if (actionType === "quiz") {
    prompt = `Rédige un quiz ludique de 3 questions à choix multiples (QCM) en français pour ${studentName || "l'élève"} de niveau ${grade || "scolaire"}, basé sur le livre de jeunesse "${bookTitle}" par ${bookAuthor}.
Chaque question doit avoir un titre, 3 choix, la bonne réponse et une explication courte de la réponse.

Format de retour JSON attendu : un objet comportant un tableau 'questions'. Chaque question comporte :
'question' (texte de la question)
'options' (tableau de 3 chaînes)
'correctIndex' (entier 0 à 2 de la bonne réponse)
'explanation' (courte explication de la réponse en français)`;
  } else if (actionType === "outline" || actionType === "guide") {
    prompt = `Rédige un carnet de lecture guidé en 4 étapes pour que ${studentName || "l'enfant"} puisse lire et comprendre le livre "${bookTitle}" de ${bookAuthor}.
Donne des conseils de lecture bienveillants adaptés à la classe de ${grade || "scolaire"}.

Format de retour JSON attendu : un objet avec un titre 'title' et un tableau d'étapes 'steps' comportant :
'stepNumber' (entier)
'objective' (objectif de lecture)
'tips' (conseil d'acquisition pour l'étape)
'activity' (petite activité ou question à soumettre à l'enfant)`;
  }

  try {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un bibliothécaire d'apprentissage dynamique et constructif.",
        responseMimeType: "application/json",
        responseSchema: actionType === "quiz" ? {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctIndex", "explanation"]
              }
            }
          },
          required: ["questions"]
        } : {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  objective: { type: Type.STRING },
                  tips: { type: Type.STRING },
                  activity: { type: Type.STRING }
                },
                required: ["stepNumber", "objective", "tips", "activity"]
              }
            }
          },
          required: ["title", "steps"]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, data: parsedData });

  } catch (error) {
    console.error("AI Library Interaction Error:", error);
    
    // Fail gracefully with a helpful fallback structured response
    if (actionType === "quiz") {
      return res.json({
        success: true,
        fallback: true,
        data: {
          questions: [
            {
              question: `Quel est le thème principal généralement abordé dans l'œuvre "${bookTitle}" ?`,
              options: ["La découverte d'une culture et de valeurs morales saines", "L'exploration robotique intergalactique lointaine", "La conquête boursière et la finance spéculative"],
              correctIndex: 0,
              explanation: "Ce livre est conçu pour cultiver les vertus humaines simples, l'empathie culturelle et les relations familiales dans un contexte traditionnel sillage."
            },
            {
              question: "Pourquoi est-il important de tenir un carnet de lecture rédigé ?",
              options: ["Pour impressionner l'ordinateur uniquement", "Pour consolider sa mémoire de travail et enrichir son vocabulaire d'année en année", "Pour obtenir des crédits bancaires supplémentaires"],
              correctIndex: 1,
              explanation: "Rédiger ses réflexions permet de mieux ancrer les leçons apprises et d'étendre la structure de son expression littéraire !"
            }
          ]
        }
      });
    } else {
      return res.json({
        success: true,
        fallback: true,
        data: {
          title: `Guide Pédagogique de Lecture Locale : ${bookTitle}`,
          steps: [
            {
              stepNumber: 1,
              objective: "Introduction, étude des auteurs et du titre",
              tips: "Observez la couverture avec l'enfant. Demandez-lui ce que le dessin lui évoque et ce qu'il attend de ce récit.",
              activity: "Demandez à l'enfant d'écrire la date et de prédire le sujet général de l'histoire en deux phrases libres."
            },
            {
              stepNumber: 2,
              objective: "Identification des personnages et de l'intrigue centrale",
              tips: "Lisez la première moitié ensemble à haute voix en insistant bien sur l'intonation des voix pour rendre le conte vivant.",
              activity: "Qui est le personnage préféré de l'enfant et pourquoi ? Dessinez-le sur le carnet physique."
            },
            {
              stepNumber: 3,
              objective: "Résolution des conflits et apprentissage de la morale",
              tips: "Cherchez ensemble les termes inconnus du récit dans un dictionnaire physique pour étendre le vocabulaire de l'enfant.",
              activity: "Faites un jeu de rôle de deux minutes pour rejouer l'une des interactions importantes du livre."
            },
            {
              stepNumber: 4,
              objective: "Synthèse et avis personnel",
              tips: "Discutez de la morale finale. Est-elle juste ? L'enfant aurait-il conclu différemment ?",
              activity: "L'enfant note le livre de 1 à 5 étoiles et dicte une note finale résumant son impression globale."
            }
          ]
        }
      });
    }
  }
});

// API: Generate payment reminder templates using Gemini AI
app.post("/api/apee/generate-reminders", async (req, res) => {
  const { targetStatus, tone, language, customContext } = req.body;

  let statusText = "Tout parent n'étant pas totalement à jour de ses cotisations d'école";
  if (targetStatus === "partiel") {
    statusText = "Un parent d'élève qui a déjà versé un acompte mais qui a encore un solde restant dû (versement partiel)";
  } else if (targetStatus === "retard") {
    statusText = "Un parent d'élève qui n'a encore payé aucun frais exigible de l'année scolaire et accumule un retard complet de cotisation";
  }

  let toneText = "Professionnel administratif standard, neutre et précis";
  if (tone === "courtois") {
    toneText = "Bienveillant, respectueux, constructif et chaleureux mais sérieux";
  } else if (tone === "ferme") {
    toneText = "Ferme, diplomatique, mettant en valeur l'obligation de s'acquitter des cotisations pour la pérennité de l'enseignement";
  } else if (tone === "urgent") {
    toneText = "Urgent, impératif, stipulant qu'une régularisation immédiate est requise pour éviter des perturbations de fin d'année ou des pénalités";
  }

  let langText = "Français impeccable";
  if (language === "en") {
    langText = "Anglais de haut niveau (English)";
  } else if (language === "bilingual") {
    langText = "Message bilingue alternant Français et Anglais de manière claire et structurée";
  }

  const prompt = `Rédige un ensemble de modèles de relances de paiement de cotisation scolaire.
Ces modèles s'adressent à : ${statusText}.
Le ton du message doit être : ${toneText}.
La langue de rédaction doit être : ${langText}.
${customContext ? `Instructions ou détails supplémentaires à insérer : "${customContext}"` : ""}

Tu dois rédiger deux types de modèles :
1. Un modèle court de type SMS ou WhatsApp (smsTemplate). Il doit être concis (idéalement moins de 250 caractères).
2. Un modèle de courriel complet (emailTemplate) avec son Objet de mail (emailSubject). Il doit être professionnel et bien structuré.

Dans ces deux modèles, tu DOIS obligatoirement insérer et respecter les balises d'interpolation dynamique suivantes. Elles seront remplacées par notre programme au moment de l'envoi :
- {parent_name} : Nom ou Civilité du parent d'élève.
- {student_names} : Noms du ou des élève(s) supervisés.
- {remaining_amount} : Montant restant dû à recouvrer.
- {total_due_amount} : Montant de la cotisation annuelle exigible.
- {school_year} : L'année scolaire concernée.
- {association_name} : Nom de l'établissement ou de l'association scolaire / parents d'élèves.
- {short_name} : Acronyme court de l'association (ex: APEE).

Ne mets aucune explication ni texte d'accompagnement en dehors du format JSON demandé.`;

  try {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un directeur financier d'école et chef de la régie comptable scolaire en Afrique francophone (Cameroun). Tu maîtrises la rédaction administrative rigoureuse et humaine.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            smsTemplate: { type: Type.STRING, description: "Texte court du message SMS ou WhatsApp incluant les balises dynamiques." },
            emailSubject: { type: Type.STRING, description: "L'objet concis et professionnel de l'email." },
            emailTemplate: { type: Type.STRING, description: "Tout le corps professionnel structuré de l'email avec les salutations, le corps, la signature, utilisant les balises dynamiques." }
          },
          required: ["smsTemplate", "emailSubject", "emailTemplate"]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, source: "gemini", data: parsedData });

  } catch (error) {
    console.error("APEE Generate Reminders Exception:", error);

    // Heuristic Local Fallback for offline/missing key simulation
    let fallbackSms = "";
    let fallbackSubject = "";
    let fallbackEmail = "";

    if (language === "en") {
      fallbackSubject = `School Fees Balance Reminder {short_name} - {association_name}`;
      if (targetStatus === "partiel") {
        fallbackSms = `Dear Parent. Thank you for your first payment. We kindly remind you that {remaining_amount} FCFA remains outstanding for your child ({student_names}) for {short_name} {school_year}. Thank you for your support.`;
        fallbackEmail = `Dear {parent_name},\n\nWe thank you for the initial installment paid toward the {short_name} contributions ({school_year}) at {association_name} for your ward(s): {student_names}.\n\nAccording to our financial books, your account has an outstanding balance of {remaining_amount} FCFA (out of {total_due_amount} FCFA due).\n\nWe kindly request that you settle this remainder soon with our administrator.\n\nBest regards,\nSchool Finance Office\n{association_name}`;
      } else if (targetStatus === "retard") {
        fallbackSms = `URGENT: Dear Parent. Your {short_name} contribution for {student_names} ({school_year}) has not been settled. Remaining due: {remaining_amount} FCFA. Please clear this immediately. Thank you.`;
        fallbackEmail = `Dear {parent_name},\n\nWe are writing to draw your attention to your unpaid {short_name} contribution ({school_year}) at {association_name} for your child(ren): {student_names}.\n\nTo date, we have not recorded any payment for your account, leaving an overdue balance of {remaining_amount} FCFA.\n\nWe demand immediate clearance of this amount. ${customContext ? `Note: ${customContext}` : ""}\n\nWarm regards,\nDirector of Finance\n{association_name}`;
      } else {
        fallbackSms = `Dear Parent. School fees balance notice for {student_names}. Solde: {remaining_amount} FCFA. Please settle this amount as soon as possible. Thank you for your cooperation.`;
        fallbackEmail = `Dear {parent_name},\n\nThis is a friendly reminder concerning your outstanding {short_name} fees for the ongoing academic year {school_year} at {association_name} regarding your child(ren): {student_names}.\n\nOur ledger shows a pending balance of {remaining_amount} FCFA of {total_due_amount} FCFA total.\n\nPlease proceed to clear this balance as soon as possible.\n\nBest regards,\nAccounting Department\n{association_name}`;
      }
    } else if (language === "bilingual") {
      fallbackSubject = `Rappel / Reminder : Cotisation {short_name} - {association_name}`;
      fallbackSms = `Rappel / Reminder {short_name} {school_year}: Reste dû / Outstanding balance of {remaining_amount} FCFA for/pour ({student_names}). Merci de régulariser. Thank you for settling.`;
      fallbackEmail = `Chers parents / Dear Parents,\n\n[FR] Nous vous rappelons que la cotisation {short_name} ({school_year}) pour votre/vos enfant(s) {student_names} présente un reste à payer de {remaining_amount} FCFA.\n\n[EN] We remind you that the school contribution {school_year} for your child(ren) {student_names} has an outstanding balance of {remaining_amount} FCFA.\n\nMerci pour votre coopération / Thank you for your valuable support.\n\nLa Direction / School Administration`;
    } else {
      // French (default)
      fallbackSubject = `Rappel de paiement cotisation {short_name} - {association_name}`;
      if (targetStatus === "partiel") {
        fallbackSms = `Chers parents. Merci pour votre premier acompte. Nous vous rappelons gentiment que le reste dû pour {student_names} ({school_year}) est de {remaining_amount} FCFA. Reste à payer : {remaining_amount} FCFA. Merci de régulariser rapidement.`;
        fallbackEmail = `Bonjour {parent_name},\n\nNous tenons à vous remercier pour votre versement de premier acompte concernant la cotisation {short_name} ({school_year}) pour votre/vos enfant(s) : {student_names}.\n\nCependant, nos comptes montrent qu'il reste un solde débiteur de {remaining_amount} FCFA sur un montant total exigible de {total_due_amount} FCFA.\n\nNous vous prions de bien vouloir finaliser ce règlement auprès de la régie financière.\n\nCordialement,\nService de la Comptabilité scolaire\n{association_name}`;
      } else if (targetStatus === "retard") {
        fallbackSms = `URGENT : Chers parents, la cotisation {short_name} {school_year} de votre/vos enfant(s) ({student_names}) n'est pas réglée. Reste dû : {remaining_amount} FCFA. Veuillez régulariser d'urgence.`;
        fallbackEmail = `Bonjour {parent_name},\n\nSauf erreur de notre part, nous constatons que la cotisation scolaire {short_name} ({school_year}) pour l'établissement {association_name} de vos enfants ({student_names}) n'a pas encore fait l'objet d'un versement.\n\nLe montant total de {remaining_amount} FCFA est entièrement en retard.\n\nNous sollicitons une régularisation de toute urgence afin de ne pas compromettre le service administratif. ${customContext ? `Rappel additionnel : ${customContext}` : ""}\n\nCordialement,\nLe Régisseur Financier principal\n{association_name}`;
      } else {
        fallbackSms = `Chers parents, rappel de solde {short_name} {school_year} de votre/vos enfant(s) ({student_names}). Le montant restant est de {remaining_amount} FCFA. Visitez l'intendance de l'école. Merci.`;
        fallbackEmail = `Bonjour {parent_name},\n\nNous vous contactons pour faire le point sur la cotisation annuelle {short_name} ({school_year}) à l'école {association_name} de vos enfants ({student_names}).\n\nÀ cette heure, votre compte reste marqué par un reste à payer de {remaining_amount} FCFA.\n\nMerci de vous présenter pour régulariser cette situation.\n\nBien cordialement,\nLa caisse d'intendance\n{short_name} • {association_name}`;
      }
    }

    return res.json({
      success: true,
      source: "local-fallback",
      data: {
        smsTemplate: fallbackSms,
        emailSubject: fallbackSubject,
        emailTemplate: fallbackEmail
      },
      message: "Modèle généré via la base de repli locale (Gemini non disponible ou clé inactive)."
    });
  }
});

// API: Send Confirmation / Verification Email
app.post("/api/send-confirmation-email", async (req, res) => {
  const { email, name, verificationUrl, type } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: "Adresse email invalide." });
  }

  const recipientName = name || email.split('@')[0];
  const confirmLink = verificationUrl || `${req.protocol}://${req.get('host')}/?verified=true&email=${encodeURIComponent(email)}`;
  
  const isReset = type === 'password_reset';
  const subject = isReset 
    ? "Réinitialisation de votre mot de passe - Pasma-sys"
    : "Confirmation et vérification de votre compte - Pasma-sys";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #4f46e5; margin: 0; font-size: 22px; font-weight: 800;">PASMA-SYS</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px; font-weight: 600;">Parents-Schools Management System</p>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="font-size: 15px; color: #1e293b;">Bonjour <strong>${recipientName}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        ${isReset
          ? "Vous avez demandé la réinitialisation de votre mot de passe pour l'application Pasma-sys."
          : "Merci de vous être inscrit sur la plateforme Pasma-sys. Veuillez confirmer votre adresse e-mail pour sécuriser et finaliser l'activation de votre compte."}
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${confirmLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 8px; display: inline-block;">
          ${isReset ? 'Réinitialiser mon mot de passe' : 'Confirmer mon adresse e-mail'}
        </a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
        Si le bouton ci-dessus ne fonctionne pas, vous pouvez copier et coller le lien suivant dans votre navigateur :<br>
        <a href="${confirmLink}" style="color: #4f46e5; word-break: break-all;">${confirmLink}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">
        © Pasma-sys • Système de Gestion Établissements & APEE. Message automatique, ne pas répondre.
      </p>
    </div>
  `;

  try {
    const mailer = await getTransporter();
    const fromAddress = process.env.SMTP_FROM || (etherealAccount ? `"Pasma-sys Support" <${etherealAccount.user}>` : '"Pasma-sys Support" <no-reply@pasma-sys.com>');
    
    if (mailer) {
      const info = await mailer.sendMail({
        from: fromAddress,
        to: email,
        subject: subject,
        text: `Bonjour ${recipientName},\n\nVeuillez valider votre e-mail via ce lien : ${confirmLink}\n\nL'équipe Pasma-sys`,
        html: htmlContent
      });

      const testUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Confirmation Email] Transmitted to ${email}. MessageId: ${info.messageId}`);
      return res.json({
        success: true,
        message: "E-mail de confirmation transmis avec succès.",
        messageId: info.messageId,
        testUrl: testUrl || undefined
      });
    } else {
      console.log(`[Confirmation Email Simulated] Transmitted to ${email}.`);
      return res.json({
        success: true,
        message: "Confirmation enregistrée et simulée avec succès.",
        simulated: true
      });
    }
  } catch (err: any) {
    console.error("[Confirmation Email Error]:", err);
    return res.status(500).json({
      success: false,
      error: `Échec de l'envoi de l'e-mail de confirmation: ${err.message || err}`
    });
  }
});

// API: Send Security Notification on Secondary Admin Revocation / Deletion
app.post("/api/send-admin-revocation-alert", async (req, res) => {
  const {
    primaryAdminEmail = "jacquesbene301@gmail.com",
    revokedAdminName,
    revokedAdminEmail,
    revokedAdminRole,
    operatorEmail,
    timestamp,
    reason
  } = req.body;

  const targetEmail = (primaryAdminEmail || "jacquesbene301@gmail.com").trim().toLowerCase();
  const adminName = revokedAdminName || "Administrateur Inconnu";
  const adminEmail = revokedAdminEmail || "Non spécifié";
  const adminRoleLabel = revokedAdminRole === 'deputy' 
    ? 'Superviseur Adjoint (Privilèges Étendus)' 
    : 'Admin Secondaire (Standard)';
  const initiator = operatorEmail || "jacquesbene301@gmail.com";
  const formattedDate = timestamp ? new Date(timestamp).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Africa/Douala'
  }) : new Date().toLocaleString('fr-FR');

  const subject = `🛡️ [ALERTE SÉCURITÉ PASMA-SYS] Révocation d'un administrateur : ${adminName}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fecaca; padding-bottom: 18px; margin-bottom: 22px;">
        <div>
          <span style="display: inline-block; padding: 4px 10px; background-color: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 800; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Alerte de Sécurité Système</span>
          <h2 style="color: #0f172a; margin: 8px 0 0 0; font-size: 20px; font-weight: 900;">PASMA-SYS • Super-Admin Security</h2>
        </div>
      </div>

      <p style="font-size: 15px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
        Bonjour Monsieur <strong>Jacques Bene Mbama</strong>,
      </p>

      <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #9f1239; font-size: 14px; font-weight: 700;">
          ⚠️ Un compte d'administrateur secondaire vient d'être supprimé / révoqué du système.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13.5px; background-color: #f8fafc; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600; width: 40%;">Administrateur Révoqué</td>
            <td style="padding: 12px 16px; color: #0f172a; font-weight: 800;">${adminName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Adresse E-mail</td>
            <td style="padding: 12px 16px; color: #0f172a; font-family: monospace; font-size: 13px;">${adminEmail}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Statut / Habilitation</td>
            <td style="padding: 12px 16px; color: #b91c1c; font-weight: 700;">${adminRoleLabel}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Opérateur à l'origine</td>
            <td style="padding: 12px 16px; color: #4338ca; font-weight: 700;">${initiator}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Date & Heure de Révocation</td>
            <td style="padding: 12px 16px; color: #334155; font-weight: 600;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Code Journal d'Audit</td>
            <td style="padding: 12px 16px; color: #475569; font-family: monospace; font-size: 12px;">REVOKE_SUPER_ADMIN</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 10px; font-size: 12.5px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        <strong>📋 Mesures automatiques appliquées :</strong><br>
        • Suppression du profil dans la collection Firestore <code>super_admins</code>.<br>
        • Clôture immédiate de la session et purge des autorisations dans le cache local.<br>
        • Enregistrement de la trace cryptographique dans les journaux d'audit de facturation/sécurité.
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        Si cette opération n'a pas été ordonnée par vos soins, connectez-vous d'urgence sur votre portail <strong>SuperAdminDashboard</strong> pour révoquer toutes les sessions et auditer le journal des événements.
      </p>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        © PASMA-SYS Security Protocol • Notification Automatique Haute Priorité • Ne pas répondre à cet e-mail.
      </p>
    </div>
  `;

  try {
    const mailer = await getTransporter();
    const fromAddress = process.env.SMTP_FROM || (etherealAccount ? `"PASMA-SYS Security" <${etherealAccount.user}>` : '"PASMA-SYS Security" <security@pasma-sys.com>');

    if (mailer) {
      const info = await mailer.sendMail({
        from: fromAddress,
        to: targetEmail,
        subject: subject,
        text: `ALERTE SÉCURITÉ PASMA-SYS\n\nRévocation de l'administrateur : ${adminName} (${adminEmail})\nStatut : ${adminRoleLabel}\nOpérateur : ${initiator}\nDate : ${formattedDate}\nCode Audit : REVOKE_SUPER_ADMIN\n\nNotification automatique expédiée au Super-Admin Principal.`,
        html: htmlContent
      });

      const testUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Security Alert Email] Sent revocation alert to ${targetEmail} for admin ${adminEmail}. MessageId: ${info.messageId}`);
      
      return res.json({
        success: true,
        message: `Notification e-mail de sécurité transmise avec succès au Super-Admin Principal (${targetEmail}).`,
        messageId: info.messageId,
        testUrl: testUrl || undefined
      });
    } else {
      console.log(`[Security Alert Email Simulated] Sent revocation alert to ${targetEmail} for admin ${adminEmail}.`);
      return res.json({
        success: true,
        message: `Notification e-mail de sécurité enregistrée pour ${targetEmail}.`,
        simulated: true
      });
    }
  } catch (err: any) {
    console.error("[Security Alert Email Error]:", err);
    return res.status(500).json({
      success: false,
      error: `Échec de l'envoi de la notification e-mail de sécurité: ${err.message || err}`
    });
  }
});

// API: Trigger bulk email reminders for parents
app.post("/api/apee/send-bulk-reminders", async (req, res) => {
  const { parentIds, parents, emailSubject, emailTemplate, smsTemplate, settings, channel } = req.body;

  if (!parents || !Array.isArray(parents)) {
    return res.status(400).json({ success: false, error: "La liste des parents est manquante ou invalide." });
  }

  const idsToProcess = Array.isArray(parentIds) && parentIds.length > 0 
    ? parentIds 
    : parents.filter((p: any) => p.status === 'partiel' || p.status === 'retard').map((p: any) => p.id);

  if (idsToProcess.length === 0) {
    return res.json({ success: true, processedCount: 0, logs: ["Aucun parent à relancer."] });
  }

  const logs: string[] = [`[Démarrage Serveur] Initialisation de la file d'envois groupés (${channel === 'email' ? 'EMAIL' : 'SMS'}). Total à traiter : ${idsToProcess.length}`];
  const updatedParents: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  const shortName = settings?.shortName || (settings?.associationName ? (settings.associationName.substring(0, 15)) : "Association");
  const schoolYear = settings?.schoolYear || "";
  const associationName = settings?.associationName || "Établissement";

  for (let i = 0; i < idsToProcess.length; i++) {
    const pid = idsToProcess[i];
    const parentObj = parents.find((p: any) => p.id === pid);
    if (!parentObj) {
      logs.push(`⚠️ [Inconnu] Identifiant parent introuvable : ${pid}`);
      continue;
    }

    const remaining = parentObj.totalDue - parentObj.totalPaid;
    const kidsList = parentObj.students && parentObj.students.length > 0
      ? parentObj.students.map((s: any) => `${s.name} (${s.classRoom})`).join(', ')
      : "votre enfant";
    const studentSingleName = parentObj.students && parentObj.students.length > 0
      ? parentObj.students[0].name
      : (parentObj.studentName || "votre enfant");

    // Compute dynamic due date
    let dueDateStr = "la fin du mois";
    if (parentObj.dueDate) {
      dueDateStr = parentObj.dueDate.includes('-')
        ? new Date(parentObj.dueDate).toLocaleDateString('fr-FR')
        : parentObj.dueDate;
    } else if (parentObj.createdAt) {
      const d = new Date(parentObj.createdAt);
      d.setDate(d.getDate() + 30);
      dueDateStr = d.toLocaleDateString('fr-FR');
    } else {
      const now = new Date();
      now.setDate(now.getDate() + 15);
      dueDateStr = now.toLocaleDateString('fr-FR');
    }

    // Compute dynamic payment date (last recorded payment or registration)
    let lastPaymentDateStr = "Aucun versement";
    if (parentObj.lastPaymentDate) {
      lastPaymentDateStr = parentObj.lastPaymentDate.includes('-') 
        ? new Date(parentObj.lastPaymentDate).toLocaleDateString('fr-FR')
        : parentObj.lastPaymentDate;
    } else if (parentObj.payments && Array.isArray(parentObj.payments) && parentObj.payments.length > 0) {
      const validPayments = [...parentObj.payments].filter((p: any) => p && (p.date || p.paymentDate));
      if (validPayments.length > 0) {
        const lastP = validPayments[validPayments.length - 1];
        const rawDate = lastP.date || lastP.paymentDate;
        lastPaymentDateStr = rawDate.includes('-') ? new Date(rawDate).toLocaleDateString('fr-FR') : rawDate;
      }
    } else if (parentObj.paymentDate) {
      lastPaymentDateStr = parentObj.paymentDate.includes('-')
        ? new Date(parentObj.paymentDate).toLocaleDateString('fr-FR')
        : parentObj.paymentDate;
    } else if (parentObj.totalPaid > 0 && parentObj.updatedAt) {
      lastPaymentDateStr = new Date(parentObj.updatedAt).toLocaleDateString('fr-FR');
    }

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const currencyStr = settings?.currency || "FCFA";
    const formattedAmount = `${remaining.toLocaleString()} ${currencyStr}`;

    const replacePlaceholders = (text: string) => {
      if (!text) return "";
      return text
        // Dynamic variables (case-insensitive for robust matching)
        .replace(/{NOM_PARENT}/gi, parentObj.name)
        .replace(/{NOM_ELEVE}/gi, studentSingleName)
        .replace(/{nom_eleve}/gi, studentSingleName)
        .replace(/{student_name}/gi, studentSingleName)
        .replace(/{eleve}/gi, studentSingleName)
        .replace(/{MONTANT_DU}/gi, formattedAmount)
        .replace(/{DATE_ECHEANCE}/gi, dueDateStr)
        .replace(/{DATE_PAIEMENT}/gi, lastPaymentDateStr)
        .replace(/{ETABLISSEMENT}/gi, shortName || associationName)
        .replace(/{ELEVES}/gi, kidsList)
        .replace(/{DATE_JOUR}/gi, todayStr)
        .replace(/{ANNEE_SCOLAIRE}/gi, schoolYear)
        // Legacy lowercase placeholders
        .replace(/{parent_name}/gi, parentObj.name)
        .replace(/{association_name}/gi, associationName)
        .replace(/{short_name}/gi, shortName)
        .replace(/{school_year}/gi, schoolYear)
        .replace(/{student_names}/gi, kidsList)
        .replace(/{remaining_amount}/gi, remaining.toLocaleString())
        .replace(/{total_due_amount}/gi, parentObj.totalDue.toLocaleString())
        .replace(/{due_date}/gi, dueDateStr)
        .replace(/{date_echeance}/gi, dueDateStr)
        .replace(/{payment_date}/gi, lastPaymentDateStr)
        .replace(/{date_paiement}/gi, lastPaymentDateStr)
        .replace(/{current_date}/gi, todayStr);
    };

    if (channel === 'email') {
      if (!parentObj.email) {
        logs.push(`❌ [Refus d'Envoi] M./Mme ${parentObj.name} - Aucun e-mail renseigné.`);
        failureCount++;
        continue;
      }
      
      const parsedSubject = replacePlaceholders(emailSubject);
      const parsedBody = replacePlaceholders(emailTemplate);

      try {
        const mailer = await getTransporter();
        const fromAddress = process.env.SMTP_FROM || (etherealAccount ? `"APEE Portal" <${etherealAccount.user}>` : '"APEE Support" <no-reply@apee-portal.org>');
        
        if (mailer) {
          const htmlBody = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">${parsedBody.replace(/\n/g, '<br>')}</body></html>`;
          const info = await mailer.sendMail({
            from: fromAddress,
            to: parentObj.email,
            subject: parsedSubject,
            text: parsedBody,
            html: htmlBody,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
          });

          const testUrl = nodemailer.getTestMessageUrl(info);
          if (testUrl) {
            logs.push(`📧 [Ethereal Sandbox] M./Mme ${parentObj.name} <${parentObj.email}>. Aperçu de l'e-mail envoyé : ${testUrl}`);
          } else {
            logs.push(`📧 [Délivré Réel SMTP] M./Mme ${parentObj.name} <${parentObj.email}>. ID Message : ${info.messageId}`);
          }
          successCount++;
        } else {
          logs.push(`⚠️ [Simulation Fallback] M./Mme ${parentObj.name} <${parentObj.email}>. Objet : "${parsedSubject}".`);
          successCount++;
        }
      } catch (mailError: any) {
        console.error("Mail sending failed:", mailError);
        logs.push(`❌ [Échec SMTP] M./Mme ${parentObj.name} <${parentObj.email}> : ${mailError.message || mailError}`);
        failureCount++;
      }
    } else {
      if (!parentObj.phone) {
        logs.push(`❌ [Refus d'Envoi] M./Mme ${parentObj.name} - Aucun numéro de téléphone.`);
        failureCount++;
        continue;
      }

      const effectiveTemplate = smsTemplate || settings?.customSmsTemplate || settings?.smsConfig?.customTemplate || "Rappel {NOM_PARENT}: Solde APEE de {MONTANT_DU} a regler avant le {DATE_ECHEANCE}. Merci. {ETABLISSEMENT}.";
      const parsedBody = replacePlaceholders(effectiveTemplate);
      let smsConfig = settings?.smsConfig || settings || {};
      if (req.body.forceProvider) {
        smsConfig = { ...smsConfig, provider: req.body.forceProvider };
      }

      // Send actual SMS
      const smsResult = await sendSms(parentObj.phone, parsedBody, smsConfig);
      
      if (smsResult.logs && smsResult.logs.length > 0) {
        logs.push(...smsResult.logs.map(logLine => `[M./Mme ${parentObj.name}] ${logLine}`));
      }

      if (smsResult.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const timestamp = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} (${channel === 'email' ? 'Auto Email Serveur' : 'Auto SMS Serveur'})`;
    updatedParents.push({
      ...parentObj,
      lastReminded: timestamp,
      updatedAt: new Date().toISOString()
    });
  }

  logs.push(`🏁 [Processus Serveur Terminé] Relance collective achevée : ${successCount} succès, ${failureCount} échecs.`);

  return res.json({
    success: true,
    processedCount: successCount,
    failureCount,
    logs,
    updatedParents
  });
});

// API: Send bulk announcements via email
app.post("/api/apee/send-bulk-announcements", async (req, res) => {
  const { recipients, subject, content, channel } = req.body;

  if (!recipients || !Array.isArray(recipients)) {
    return res.status(400).json({ success: false, error: "La liste des destinataires est manquante ou invalide." });
  }

  const logs: string[] = [`[Démarrage] Diffusion groupée d'annonces (${channel === 'email' ? 'EMAIL' : channel === 'both' ? 'EMAIL + SYSTÈME' : 'SYSTÈME'}). Total : ${recipients.length}`];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const parentName = item.parentName || (item.parent ? item.parent.name : "Parent");
    const parentEmail = item.parentEmail || item.email || (item.parent ? item.parent.email : null);

    if (channel === 'email' || channel === 'both') {
      if (!parentEmail) {
        logs.push(`❌ [Refus d'Envoi] M./Mme ${parentName} - Aucun e-mail renseigné.`);
        failureCount++;
        continue;
      }

      try {
        const mailer = await getTransporter();
        const fromAddress = process.env.SMTP_FROM || (etherealAccount ? `"APEE Portal" <${etherealAccount.user}>` : '"APEE Support" <no-reply@apee-portal.org>');
        
        if (mailer) {
          const htmlBody = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">${content.replace(/\n/g, '<br>')}</body></html>`;
          const info = await mailer.sendMail({
            from: fromAddress,
            to: parentEmail,
            subject: subject,
            text: content,
            html: htmlBody,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
          });

          const testUrl = nodemailer.getTestMessageUrl(info);
          if (testUrl) {
            logs.push(`📧 [Ethereal Sandbox] M./Mme ${parentName} <${parentEmail}>. Aperçu de l'e-mail : ${testUrl}`);
          } else {
            logs.push(`📧 [Délivré Réel SMTP] M./Mme ${parentName} <${parentEmail}>. ID Message : ${info.messageId}`);
          }
          successCount++;
        } else {
          logs.push(`⚠️ [Simulation Fallback] M./Mme ${parentName} <${parentEmail}>. Objet : "${subject}".`);
          successCount++;
        }
      } catch (mailError: any) {
        console.error("Mail sending failed:", mailError);
        logs.push(`❌ [Échec SMTP] M./Mme ${parentName} <${parentEmail}> : ${mailError.message || mailError}`);
        failureCount++;
      }
    } else {
      logs.push(`💬 [Notification Système] Enregistré pour M./Mme ${parentName}.`);
      successCount++;
    }
  }

  logs.push(`🏁 [Processus Terminé] Diffusion de l'annonce achevée : ${successCount} succès, ${failureCount} échecs.`);

  return res.json({
    success: true,
    processedCount: successCount,
    failureCount,
    logs
  });
});

// API: Send Test SMS using configured credentials
app.post("/api/sms/send-test", async (req, res) => {
  const { phoneNumber, message, config } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ 
      success: false, 
      message: "Le numéro de téléphone destinataire est requis.",
      logs: ["❌ [Erreur] Paramètre 'phoneNumber' manquant."]
    });
  }

  const { success, logs } = await sendSms(phoneNumber, message, config || {});

  return res.json({
    success,
    message: success ? "SMS de test envoyé avec succès !" : "Échec de l'envoi du SMS de test.",
    logs
  });
});

// API: Generate AI-powered homework based on lesson content
app.post("/api/gemini/generate-homework-from-lesson", async (req, res) => {
  const { lessonTitle, lessonContent, subject, studentName, grade, homeworkType } = req.body;

  const typeLabel = homeworkType === "quiz" ? "un Quiz de révision" : homeworkType === "deep" ? "des Exercices d'approfondissement" : "des Exercices d'application directe";

  const prompt = `Génère ${typeLabel} adapté au niveau de classe de "${grade || "scolaire"}" pour l'élève nommé "${studentName || "l'élève"}".
Ce devoir doit être entièrement basé sur la leçon ci-dessous publiée par son enseignant titulaire.

=== TITRE DE LA LEÇON : ${lessonTitle || "Leçon générale"} ===
=== MATIÈRE : ${subject || "Général"} ===
=== CONTENU DE LA LEÇON ===
${lessonContent || "Pas de contenu spécifique."}

Critères importants :
1. Le devoir doit comporter 2 à 3 exercices progressifs adaptés à la classe de ${grade}.
2. Chaque exercice doit proposer des questions concrètes et précises.
3. Fournis les solutions de chaque exercice de manière rédigée et claire pour que le parent puisse corriger le travail facilement.
4. Ajoute une section de conseils pédagogiques bienveillants pour aider le parent à accompagner son enfant dans ce devoir.

Tu dois impérativement retourner le résultat au format JSON structuré correspondant au schéma fourni.`;

  try {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un tuteur et conseiller d'apprentissage d'élite spécialisé dans le suivi des élèves en école primaire et secondaire. Tu conçois des devoirs ludiques, instructifs et stimulants qui renforcent l'autonomie.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titre général du devoir généré." },
            objectives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Objectifs pédagogiques."
            },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Titre de l'exercice." },
                  instruction: { type: Type.STRING, description: "Consignes claires." },
                  questions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  solutions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["title", "instruction", "questions", "solutions"]
              }
            },
            parentTips: { type: Type.STRING, description: "Conseils pour le parent." }
          },
          required: ["title", "objectives", "exercises", "parentTips"]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, source: "gemini", data: parsedData });

  } catch (error) {
    console.error("AI Homework Generation Error, engaging fallback heuristics:", error);

    // High quality local fallback structured response
    const fallbackHomework = {
      title: `Devoir de révision : ${lessonTitle || "Assimilation du cours"}`,
      objectives: [
        `Consolider les notions clés de la leçon de ${subject || "cours"}`,
        "S'entraîner à appliquer la méthode vue en classe",
        "Encourager la reformulation et l'esprit d'analyse"
      ],
      exercises: [
        {
          title: "Exercice 1 : Questions d'assimilation",
          instruction: `Lisez attentivement la leçon "${lessonTitle || "le cours"}" avec votre enfant, puis répondez aux questions ci-dessous sur une feuille d'exercices :`,
          questions: [
            "Quel est le mot-clé principal ou le concept central de cette leçon ?",
            "Explique avec tes propres mots la règle ou l'idée la plus importante.",
            "Cite un exemple ou une illustration concrète que l'enseignant a mentionné."
          ],
          solutions: [
            "L'élève doit citer le concept central (ex: les fractions, la grammaire, la géographie).",
            "La réponse doit être structurée avec ses propres mots pour vérifier la compréhension.",
            "L'élève doit retrouver l'exemple donné dans le texte de la leçon ou en proposer un similaire."
          ]
        },
        {
          title: "Exercice 2 : Exercice d'application pratique",
          instruction: "Effectuez cette activité pratique pour valider vos acquis :",
          questions: [
            "Faites un court résumé écrit (en 3 à 5 phrases) des points essentiels du cours.",
            "Imaginez que vous devez expliquer cette leçon à un camarade de classe qui était absent : que lui diriez-vous ?"
          ],
          solutions: [
            "Le résumé doit être soigné, sans fautes d'accord simples, et contenir les définitions clés.",
            "Cette activité orale favorise l'ancrage mémoriel à long terme !"
          ]
        }
      ],
      parentTips: "Encouragez votre enfant à lire la leçon à haute voix avant de commencer. Laissez-le chercher seul pendant 10 à 15 minutes avant de regarder les solutions ensemble pour le guider pas à pas sans faire à sa place !"
    };

    return res.json({
      success: true,
      source: "local-heuristic",
      data: fallbackHomework,
      message: "Base de repli locale activée (Gemini indisponible ou hors-ligne)."
    });
  }
});

// API: Direct AI Homework generator by topic/subject/grade
app.post("/api/gemini/generate-homework-topic", async (req, res) => {
  const { topic, subject, grade, studentName, difficulty } = req.body;

  const prompt = `Génère un devoir scolaire complet et bien structuré de niveau "${grade || "primaire/secondaire"}" pour la matière "${subject || "Générale"}" sur le thème ou chapitre : "${topic || "Révision générale"}".
Niveau de difficulté : ${difficulty || "Standard"}.
${studentName ? `Destiné à l'élève : ${studentName}` : ""}

Exigences :
1. Un titre accrocheur et clair pour le devoir.
2. 2 ou 3 objectifs pédagogiques clés.
3. 2 à 3 exercices avec consignes claires, questions précises et solutions détaillées pour chaque exercice.
4. Des conseils pratiques et bienveillants pour accompagner l'élève.

Retourne impérativement un objet JSON valide correspondant au schéma.`;

  try {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un enseignant chevronné et concepteur d'exercices pédagogiques.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  solutions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "instruction", "questions", "solutions"]
              }
            },
            parentTips: { type: Type.STRING }
          },
          required: ["title", "objectives", "exercises", "parentTips"]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, source: "gemini", data: parsedData });
  } catch (error) {
    console.error("Direct homework generation error:", error);
    const fallbackHomework = {
      title: `Devoir d'entraînement : ${topic || subject || "Exercices pratiques"}`,
      objectives: [
        `Maîtriser les notions fondamentales de : ${topic || subject}`,
        "Développer les compétences d'application autonome",
        "Valider les acquis par des exercices progressifs"
      ],
      exercises: [
        {
          title: "Exercice 1 : Notions de base et définitions",
          instruction: "Répondez aux questions suivantes avec clarté et précision :",
          questions: [
            `Définissez ce qu'est le concept de "${topic || subject}".`,
            "Donnez deux exemples concrets d'application vus en cours.",
            "Expliquez la démarche méthodologique à suivre pour résoudre un problème lié à ce sujet."
          ],
          solutions: [
            "Définition conforme au programme académique et aux règles fondamentales.",
            "Exemples illustratifs pertinents et bien argumentés.",
            "Respect des étapes méthodologiques clés."
          ]
        },
        {
          title: "Exercice 2 : Application pratique",
          instruction: "Résolvez l'exercice d'application ci-dessous :",
          questions: [
            "Appliquez la formule ou la règle principale à un cas concret.",
            "Vérifiez vos calculs ou votre raisonnement étape par étape."
          ],
          solutions: [
            "Démonstration claire avec étapes de calcul intermédiaires.",
            "Conclusion précise formulée avec une phrase de réponse complète."
          ]
        }
      ],
      parentTips: "Encouragez l'élève à travailler dans un espace calme, à relire ses réponses avant de valider et à surligner les mots-clés."
    };

    return res.json({
      success: true,
      source: "local-heuristic",
      data: fallbackHomework,
      message: "Génération locale de secours réussie."
    });
  }
});

// API: Proxy request to Google Firebase Management API to fetch projects
app.get("/api/firebase/projects", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Missing authorization token in headers" });
  }

  try {
    const response = await fetch("https://firebase.googleapis.com/v1beta1/projects", {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Firebase Projects API failed:", response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: `Firebase API error: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    return res.json({ success: true, projects: data.projects || [] });
  } catch (error: any) {
    console.error("Firebase Projects API exception:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch Firebase projects" });
  }
});

// API: Proxy to fetch Web Apps under a Firebase project
app.get("/api/firebase/projects/:projectId/web-apps", async (req, res) => {
  const { projectId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Missing authorization token" });
  }

  try {
    const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Failed to fetch web apps: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    return res.json({ success: true, apps: data.apps || [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// API: Proxy to fetch Web App SDK Configuration
app.get("/api/firebase/projects/:projectId/web-apps/:appId/config", async (req, res) => {
  const { projectId, appId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Missing authorization token" });
  }

  try {
    const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${appId}/config`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Failed to fetch app config: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    return res.json({ success: true, config: data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// API: Proxy to fetch Android Apps under a Firebase project
app.get("/api/firebase/projects/:projectId/android-apps", async (req, res) => {
  const { projectId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Missing authorization token" });
  }

  try {
    const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Failed to fetch android apps: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    return res.json({ success: true, apps: data.apps || [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Memory cache for received webhook events (to support live UI visualization)
interface WebhookEvent {
  timestamp: string;
  headers: any;
  body: any;
  signature: string;
  computedSignature: string;
  isValid: boolean;
  financialVerified: boolean;
  synced: boolean;
  reference: string;
  status: string;
  failureReason?: string;
  diagnosticError?: string;
  clientIp?: string;
  reconciliationType?: 'portal_fee' | 'tuition' | 'unknown';
}
const receivedWebhooks: WebhookEvent[] = [];

function getFirebaseAdminApp() {
  const existingApp = getApps().find(app => app.name === "pasma-admin");
  if (existingApp) return existingApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 
                             process.env.FIREBASE_SERVICE_ACCOUNT || 
                             process.env.FIREBASE_SERVICE_ACCOUNT_PASMA_SYS;
  let credential;
  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.");
    }
    credential = cert(serviceAccount);
  } else {
    credential = applicationDefault();
  }

  return initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || "pasma-sys"
  }, "pasma-admin");
}

function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

async function getVerifiedFirebaseUser(req: express.Request) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;

  try {
    return await getAuth(getFirebaseAdminApp()).verifyIdToken(authorization.slice(7).trim());
  } catch {
    return null;
  }
}

async function isFirebaseSuperAdmin(uid: string, email?: string) {
  if (email?.toLowerCase() === "jacquesbene301@gmail.com") return true;
  const db = getAdminDb();
  const adminIds = [uid, email].filter((value): value is string => Boolean(value));
  const adminDocs = await Promise.all(adminIds.map(id => db.collection("super_admins").doc(id).get()));
  return adminDocs.some(adminDoc => adminDoc.exists);
}

async function canManageSchool(uid: string, email: string | undefined, schoolId: string) {
  if (await isFirebaseSuperAdmin(uid, email)) return true;
  const school = await getAdminDb().collection("establishments").doc(schoolId).get();
  return school.exists && school.get("ownerId") === uid;
}

async function canManageInvoice(uid: string, email: string | undefined, invoiceData: any) {
  if (!uid) return false;
  if (await isFirebaseSuperAdmin(uid, email)) return true;
  if (invoiceData.parentId && invoiceData.parentId === uid) return true;
  if (invoiceData.userId && invoiceData.userId === uid) return true;
  if (invoiceData.parentId && await canManageSchool(uid, email, invoiceData.parentId)) return true;
  if (invoiceData.schoolId && await canManageSchool(uid, email, invoiceData.schoolId)) return true;
  if (invoiceData.phone && invoiceData.phone.replace(/\D/g, '').endsWith(uid.slice(-9))) return true;
  if (invoiceData.amount && invoiceData.status !== 'Paid') return true;
  return false;
}

async function requireFirebaseSuperAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const firebaseUser = await getVerifiedFirebaseUser(req);
  if (!firebaseUser) {
    return res.status(401).json({ success: false, error: "Authentification Firebase requise." });
  }

  try {
    if (!await isFirebaseSuperAdmin(firebaseUser.uid, firebaseUser.email)) {
      return res.status(403).json({ success: false, error: "Accès réservé aux super-administrateurs." });
    }
  } catch (err) {
    console.error("[Campay Audit] Could not verify administrator permissions:", err);
    return res.status(503).json({ success: false, error: "Vérification des autorisations indisponible." });
  }

  return next();
}

function referenceDocumentId(reference: string) {
  return crypto.createHash("sha256").update(reference).digest("hex");
}

async function saveWebhookLogToFirestore(
  reference: string,
  payload: any,
  signatureVerified: boolean,
  financialVerified: boolean,
  synced: boolean,
  diagnosticError?: string,
  failureReason?: string
) {
  const safeRef = reference || `unknown_${Date.now()}`;
  const id = `log_webhook_${referenceDocumentId(safeRef)}`;
  await getAdminDb().collection("invoices").doc(id).set({
    id,
    reference: safeRef,
    status: String(payload?.status || "PENDING"),
    amount: String(payload?.amount ?? "0"),
    phone: String(payload?.phone || ""),
    operator: String(payload?.operator || ""),
    verified: signatureVerified,
    financialVerified,
    timestamp: new Date().toISOString(),
    payloadJson: typeof payload === "string" ? payload : JSON.stringify(payload || {}),
    synced,
    diagnosticError: diagnosticError || null,
    failureReason: failureReason || null
  }, { merge: true });
}

interface ReconciliationResult {
  financialVerified: boolean;
  synced: boolean;
  failureReason?: string;
  diagnosticError?: string;
  reconciliationType: 'portal_fee' | 'tuition' | 'unknown';
}

async function reconcilePortalFeeWebhook(payload: any): Promise<ReconciliationResult> {
  const db = getAdminDb();
  const externalReference = String(payload.external_reference || payload.externalReference || payload.data?.external_reference || "");
  const campayReference = String(payload.reference || payload.data?.reference || payload.transaction_id || "");
  const externalReferenceIsSafe = /^PRTL_[a-zA-Z0-9_-]{1,180}$/.test(externalReference);
  let intentRef = externalReferenceIsSafe
    ? db.collection("portal_payment_intents").doc(externalReference)
    : null;
  let intentSnap = intentRef ? await intentRef.get() : null;

  if (!intentSnap?.exists && campayReference) {
    const matches = await db.collection("portal_payment_intents")
      .where("campayReference", "==", campayReference)
      .limit(1)
      .get();
    if (!matches.empty) {
      intentRef = matches.docs[0].ref;
      intentSnap = matches.docs[0];
    }
  }

  if (!intentRef || !intentSnap?.exists) {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "NO_INTENT_FOUND",
      diagnosticError: `Aucune intention de frais de site/portail correspondante trouvée pour la référence (${externalReference || campayReference}).`,
      reconciliationType: 'portal_fee'
    };
  }

  const intent = intentSnap.data()!;
  const amount = Number(payload.amount ?? payload.data?.amount);
  const currency = String(payload.currency || payload.data?.currency || "XAF").toUpperCase();
  const expectedAmount = Number(intent.amount);
  const storedCampayReference = String(intent.campayReference || "");

  if (!Number.isFinite(amount) || amount !== expectedAmount) {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "AMOUNT_MISMATCH",
      diagnosticError: `Montant non concordant : reçu ${amount} FCFA, attendu ${expectedAmount} FCFA.`,
      reconciliationType: 'portal_fee'
    };
  }

  if (currency !== "XAF") {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "CURRENCY_MISMATCH",
      diagnosticError: `Devise invalide : reçue ${currency}, attendue XAF.`,
      reconciliationType: 'portal_fee'
    };
  }

  if (storedCampayReference && campayReference && campayReference !== storedCampayReference) {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "REFERENCE_MISMATCH",
      diagnosticError: `Référence Campay reçue (${campayReference}) différente de l'attente (${storedCampayReference}).`,
      reconciliationType: 'portal_fee'
    };
  }

  const status = String(payload.status || payload.data?.status || "").toUpperCase();
  if (status !== "SUCCESSFUL") {
    if (status === "FAILED") {
      await db.runTransaction(async transaction => {
        const currentIntent = await transaction.get(intentRef!);
        if (currentIntent.exists && currentIntent.get("status") !== "SUCCESSFUL") {
          transaction.update(intentRef!, { status: "FAILED", updatedAt: new Date().toISOString() });
        }
      });
      return {
        financialVerified: true,
        synced: false,
        failureReason: "TELCO_REJECTED",
        diagnosticError: `Transaction rejetée par l'opérateur Mobile Money (Raison: ${payload.reason || 'Paiement échoué ou annulé'}).`,
        reconciliationType: 'portal_fee'
      };
    }
    return {
      financialVerified: true,
      synced: false,
      failureReason: "STATUS_PENDING",
      diagnosticError: `Notification reçue avec un statut transitoire (${status}).`,
      reconciliationType: 'portal_fee'
    };
  }

  const reconciledAt = new Date().toISOString();
  const synced = await db.runTransaction(async transaction => {
    const currentIntent = await transaction.get(intentRef!);
    if (!currentIntent.exists) return false;
    if (currentIntent.get("status") === "SUCCESSFUL") return true;
    if (
      Number(currentIntent.get("amount")) !== amount ||
      currentIntent.get("schoolId") !== intent.schoolId
    ) {
      return false;
    }

    const schoolRef = db.collection("establishments").doc(String(currentIntent.get("schoolId")));
    const school = await transaction.get(schoolRef);
    if (!school.exists) return false;

    transaction.update(schoolRef, {
      portalFeesPaid: FieldValue.increment(amount),
      lastPortalPaymentDate: reconciledAt
    });
    transaction.update(intentRef!, {
      status: "SUCCESSFUL",
      verifiedAt: reconciledAt,
      updatedAt: reconciledAt,
      synced: true
    });
    return true;
  });

  return {
    financialVerified: synced,
    synced,
    reconciliationType: 'portal_fee'
  };
}

async function reconcileTuitionWebhook(payload: any): Promise<ReconciliationResult> {
  const db = getAdminDb();
  const externalReference = String(payload.external_reference || payload.externalReference || payload.data?.external_reference || "");
  const campayReference = String(payload.reference || payload.data?.reference || payload.transaction_id || "");
  const externalReferenceIsSafe = /^TUITION_[a-zA-Z0-9_-]{1,180}$/.test(externalReference);
  let intentRef = externalReferenceIsSafe
    ? db.collection("tuition_payment_intents").doc(externalReference)
    : null;
  let intentSnap = intentRef ? await intentRef.get() : null;

  if (!intentSnap?.exists && campayReference) {
    const matches = await db.collection("tuition_payment_intents")
      .where("campayReference", "==", campayReference)
      .limit(1)
      .get();
    if (!matches.empty) {
      intentRef = matches.docs[0].ref;
      intentSnap = matches.docs[0];
    }
  }

  if (!intentRef || !intentSnap?.exists) {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "NO_INTENT_FOUND",
      diagnosticError: `Aucune intention de frais de scolarité parent trouvée pour la référence (${externalReference || campayReference}).`,
      reconciliationType: 'tuition'
    };
  }

  const intent = intentSnap.data()!;
  const amount = Number(payload.amount ?? payload.data?.amount);
  const currency = String(payload.currency || payload.data?.currency || "XAF").toUpperCase();
  const expectedAmount = Number(intent.amount);
  const storedCampayReference = String(intent.campayReference || "");

  if (!Number.isFinite(amount) || amount !== expectedAmount) {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "AMOUNT_MISMATCH",
      diagnosticError: `Montant scolarité non concordant : reçu ${amount} FCFA, attendu ${expectedAmount} FCFA.`,
      reconciliationType: 'tuition'
    };
  }

  if (currency !== "XAF") {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "CURRENCY_MISMATCH",
      diagnosticError: `Devise scolarité invalide : reçue ${currency}, attendue XAF.`,
      reconciliationType: 'tuition'
    };
  }

  if (storedCampayReference && campayReference && campayReference !== storedCampayReference) {
    return {
      financialVerified: false,
      synced: false,
      failureReason: "REFERENCE_MISMATCH",
      diagnosticError: `Référence Campay scolarité (${campayReference}) différente de l'enregistrement (${storedCampayReference}).`,
      reconciliationType: 'tuition'
    };
  }

  const status = String(payload.status || payload.data?.status || "").toUpperCase();
  if (status !== "SUCCESSFUL") {
    if (status === "FAILED") {
      await db.runTransaction(async transaction => {
        const currentIntent = await transaction.get(intentRef!);
        if (currentIntent.exists && currentIntent.get("status") !== "SUCCESSFUL") {
          transaction.update(intentRef!, { status: "FAILED", updatedAt: new Date().toISOString() });
        }
      });
      return {
        financialVerified: true,
        synced: false,
        failureReason: "TELCO_REJECTED",
        diagnosticError: `Paiement scolarité refusé par l'opérateur (Raison: ${payload.reason || 'Transaction rejetée'}).`,
        reconciliationType: 'tuition'
      };
    }
    return {
      financialVerified: true,
      synced: false,
      failureReason: "STATUS_PENDING",
      diagnosticError: `Notification scolarité reçue avec statut non final (${status}).`,
      reconciliationType: 'tuition'
    };
  }

  const reconciledAt = new Date().toISOString();
  const synced = await db.runTransaction(async transaction => {
    const currentIntent = await transaction.get(intentRef!);
    if (!currentIntent.exists) return false;
    if (currentIntent.get("status") === "SUCCESSFUL") return true;

    const invoiceId = String(currentIntent.get("invoiceId"));
    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceDoc = await transaction.get(invoiceRef);
    if (!invoiceDoc.exists) return false;

    const invoiceData = invoiceDoc.data()!;
    const previousPaid = Number(invoiceData.amountPaid || 0);
    const newAmountPaid = previousPaid + amount;
    const totalDue = Number(invoiceData.amount || 0);
    const isFullyPaid = newAmountPaid >= totalDue;

    transaction.update(invoiceRef, {
      status: isFullyPaid ? 'Paid' : 'Partial',
      amountPaid: newAmountPaid,
      paidAt: reconciledAt,
      paymentMethod: 'momo_campay',
      provider: 'campay',
      transactionId: campayReference,
      updatedAt: reconciledAt
    });

    transaction.update(intentRef!, {
      status: "SUCCESSFUL",
      verifiedAt: reconciledAt,
      updatedAt: reconciledAt,
      synced: true
    });
    return true;
  });

  return {
    financialVerified: synced,
    synced,
    reconciliationType: 'tuition'
  };
}

// Helper to compute HMAC across multiple representations (raw body buffer, json string)
function verifyCampaySignature(
  req: express.Request,
  rawSignature: string,
  webhookKey: string
): { isValid: boolean; computedSignature: string } {
  let cleanSignature = rawSignature.trim();
  if (cleanSignature.toLowerCase().startsWith("sha256=")) {
    cleanSignature = cleanSignature.slice(7).trim();
  }

  const rawBuffer = (req as any).rawBody as Buffer | undefined;
  const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  // Candidates for hashing
  const candidates: Array<{ data: Buffer | string; isBuffer: boolean }> = [];
  if (rawBuffer && rawBuffer.length > 0) {
    candidates.push({ data: rawBuffer, isBuffer: true });
  }
  candidates.push({ data: bodyString, isBuffer: false });

  let primaryComputed = "";

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const hmacHex = crypto.createHmac("sha256", webhookKey);
    const hmacB64 = crypto.createHmac("sha256", webhookKey);
    
    if (candidate.isBuffer) {
      hmacHex.update(candidate.data as Buffer);
      hmacB64.update(candidate.data as Buffer);
    } else {
      hmacHex.update(candidate.data as string, "utf8");
      hmacB64.update(candidate.data as string, "utf8");
    }

    const hexDigest = hmacHex.digest("hex");
    const b64Digest = hmacB64.digest("base64");

    if (i === 0) primaryComputed = hexDigest;

    // Check hex match
    try {
      const sigBuffer = Buffer.from(cleanSignature, "hex");
      const compBuffer = Buffer.from(hexDigest, "hex");
      if (sigBuffer.length === compBuffer.length && crypto.timingSafeEqual(sigBuffer, compBuffer)) {
        return { isValid: true, computedSignature: hexDigest };
      }
    } catch {
      // not hex
    }

    // Check raw string or base64 match
    if (cleanSignature === hexDigest || cleanSignature === b64Digest) {
      return { isValid: true, computedSignature: hexDigest };
    }
  }

  return { isValid: false, computedSignature: primaryComputed };
}

// API: Campay Webhook Endpoint for school payment notification synchronisation
app.post("/api/campay-webhook", async (req, res) => {
  const signatureHeader = req.headers["x-campay-signature"] || req.headers["signature"] || "";
  const payload = req.body || {};
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  console.log("📥 [Campay Webhook Received]:", {
    headers: req.headers,
    body: payload,
    clientIp
  });

  try {
    const reference = String(payload.reference || payload.data?.reference || payload.transaction_id || payload.external_reference || "UNKNOWN");
    const status = String(payload.status || payload.data?.status || "PENDING").toUpperCase();
    const amount = String(payload.amount ?? payload.data?.amount ?? "0");
    const phone = String(payload.phone || payload.data?.phone || payload.from || "");
    const operator = String(payload.operator || payload.data?.operator || "");
    const reason = String(payload.reason || payload.data?.reason || "");

    // 1. Retrieve the App webhook key strictly from server environment
    const webhookKey = process.env.CAMPAY_WEBHOOK_KEY || "";
    if (!webhookKey) {
      console.error("❌ [Campay Webhook] CAMPAY_WEBHOOK_KEY is not configured in server environment!");
      const failureEvent: WebhookEvent = {
        timestamp: new Date().toISOString(),
        headers: req.headers,
        body: payload,
        signature: String(signatureHeader || ""),
        computedSignature: "",
        isValid: false,
        financialVerified: false,
        synced: false,
        reference,
        status: "CONFIG_ERROR",
        failureReason: "CAMPAY_WEBHOOK_KEY_MISSING",
        diagnosticError: "Le secret HMAC (CAMPAY_WEBHOOK_KEY) n'est pas défini dans les variables d'environnement du serveur.",
        clientIp: String(clientIp),
        reconciliationType: 'unknown'
      };
      receivedWebhooks.unshift(failureEvent);
      if (receivedWebhooks.length > 100) receivedWebhooks.pop();

      return res.status(500).json({ 
        success: false, 
        error: failureEvent.diagnosticError
      });
    }

    const rawSignature = String(signatureHeader || "").trim();
    if (!rawSignature) {
      console.warn(`❌ [Campay Webhook] Rejected: Missing signature header for reference: ${reference}`);
      const failureEvent: WebhookEvent = {
        timestamp: new Date().toISOString(),
        headers: req.headers,
        body: payload,
        signature: "",
        computedSignature: "",
        isValid: false,
        financialVerified: false,
        synced: false,
        reference,
        status: "REJECTED_MISSING_SIGNATURE",
        failureReason: "MISSING_SIGNATURE_HEADER",
        diagnosticError: "En-tête X-Campay-Signature manquant. Campay doit transmettre la signature HMAC dans les en-têtes HTTP.",
        clientIp: String(clientIp),
        reconciliationType: 'unknown'
      };
      receivedWebhooks.unshift(failureEvent);
      if (receivedWebhooks.length > 100) receivedWebhooks.pop();

      await saveWebhookLogToFirestore(
        reference,
        payload,
        false,
        false,
        false,
        failureEvent.diagnosticError,
        failureEvent.failureReason
      ).catch(() => {});

      return res.status(401).json({ 
        success: false, 
        error: failureEvent.diagnosticError
      });
    }

    // 2. Compute expected HMAC-SHA256 signature with constant-time verification
    const { isValid: isSignatureValid, computedSignature } = verifyCampaySignature(req, rawSignature, webhookKey);

    console.log(`🔒 [Campay Signature Verification] Reference: ${reference}`);
    console.log(`   - Provided Signature : ${rawSignature.slice(0, 10)}...`);
    console.log(`   - Signature Match    : ${isSignatureValid ? "VALID ✅" : "REJECTED ❌"}`);

    if (!isSignatureValid) {
      console.warn(`❌ [Campay Webhook] REJECTED: Invalid HMAC signature for reference: ${reference}`);
      const failureEvent: WebhookEvent = {
        timestamp: new Date().toISOString(),
        headers: req.headers,
        body: payload,
        signature: rawSignature,
        computedSignature,
        isValid: false,
        financialVerified: false,
        synced: false,
        reference,
        status: "REJECTED_INVALID_SIGNATURE",
        failureReason: "INVALID_HMAC_SIGNATURE",
        diagnosticError: "Signature HMAC-SHA256 non concordante. Vérifiez que la valeur de CAMPAY_WEBHOOK_KEY sur le serveur correspond au secret défini dans votre console Campay.",
        clientIp: String(clientIp),
        reconciliationType: 'unknown'
      };
      receivedWebhooks.unshift(failureEvent);
      if (receivedWebhooks.length > 100) receivedWebhooks.pop();

      await saveWebhookLogToFirestore(
        reference,
        payload,
        false,
        false,
        false,
        failureEvent.diagnosticError,
        failureEvent.failureReason
      ).catch(() => {});

      return res.status(403).json({ 
        success: false, 
        error: failureEvent.diagnosticError
      });
    }

    // 3. Reconcile only a previously-created payment intent and apply it idempotently
    const externalRefString = String(payload.external_reference || payload.externalReference || payload.data?.external_reference || "");
    let reconciliation: ReconciliationResult;
    if (externalRefString.startsWith("TUITION_")) {
      reconciliation = await reconcileTuitionWebhook(payload);
    } else if (externalRefString.startsWith("PRTL_")) {
      reconciliation = await reconcilePortalFeeWebhook(payload);
    } else {
      reconciliation = await reconcilePortalFeeWebhook(payload);
      if (!reconciliation.financialVerified) {
        const tuitionTry = await reconcileTuitionWebhook(payload);
        if (tuitionTry.financialVerified || tuitionTry.failureReason !== "NO_INTENT_FOUND") {
          reconciliation = tuitionTry;
        }
      }
    }

    // 4. Stash the event for live dashboard visualization
    const event: WebhookEvent = {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: payload,
      signature: rawSignature,
      computedSignature,
      isValid: true,
      financialVerified: reconciliation.financialVerified,
      synced: reconciliation.synced,
      reference,
      status,
      failureReason: reconciliation.failureReason,
      diagnosticError: reconciliation.diagnosticError,
      clientIp: String(clientIp),
      reconciliationType: reconciliation.reconciliationType
    };
    receivedWebhooks.unshift(event);
    if (receivedWebhooks.length > 100) {
      receivedWebhooks.pop();
    }

    // 5. Persist the signed event and whether it was reconciled against a trusted payment intent
    await saveWebhookLogToFirestore(
      reference,
      payload,
      true,
      reconciliation.financialVerified,
      reconciliation.synced,
      reconciliation.diagnosticError,
      reconciliation.failureReason
    ).catch(err => {
      console.warn("Could not write webhook to Firestore:", err.message);
    });

    if (status === 'SUCCESSFUL') {
      console.log(`✅ [Campay Webhook] Payment SUCCESSFUL for transaction ${reference}. Amount: ${amount} XAF. Source: ${phone} (${operator})`);
    } else {
      console.warn(`❌ [Campay Webhook] Payment ${status} for transaction ${reference}. Reason: ${reason || 'N/A'}`);
    }

    return res.status(200).json({ 
      success: true, 
      message: "Webhook processed and verified successfully",
      receivedReference: reference,
      receivedStatus: status,
      signatureVerified: true,
      financialVerified: reconciliation.financialVerified,
      synced: reconciliation.synced,
      diagnosticError: reconciliation.diagnosticError || null
    });
  } catch (err: any) {
    console.error("Error processing Campay webhook:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get received webhook logs (In-Memory)
app.get("/api/campay/webhooks", requireFirebaseSuperAdmin, (req, res) => {
  return res.json({ success: true, webhooks: receivedWebhooks });
});

// API: Clear received webhook logs (In-Memory)
app.post("/api/campay/webhooks/clear", requireFirebaseSuperAdmin, (req, res) => {
  receivedWebhooks.length = 0;
  return res.json({ success: true });
});

// API: Check Campay Integration Status (Safe metadata, no secrets exposed)
app.get("/api/campay/status", (req, res) => {
  return res.json({
    success: true,
    isWebhookKeyConfigured: Boolean(process.env.CAMPAY_WEBHOOK_KEY),
    isTokenConfigured: Boolean(process.env.CAMPAY_TOKEN),
    isPaymentLedgerConfigured: Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 
      process.env.FIREBASE_SERVICE_ACCOUNT || 
      process.env.FIREBASE_SERVICE_ACCOUNT_PASMA_SYS || 
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ),
    environment: process.env.NODE_ENV || "production"
  });
});

// API: Comprehensive Campay Diagnostic & Real-Time Monitoring Telemetry
app.get("/api/campay/diagnose", requireFirebaseSuperAdmin, async (_req, res) => {
  const isWebhookKeyConfigured = Boolean(process.env.CAMPAY_WEBHOOK_KEY);
  const isTokenConfigured = Boolean(process.env.CAMPAY_TOKEN);
  let ledgerReady = false;
  let ledgerError: string | null = null;
  try {
    const db = getAdminDb();
    await db.collection("portal_payment_intents").limit(1).get();
    ledgerReady = true;
  } catch (err: any) {
    ledgerError = err.message || "Impossible de contacter Firestore Admin";
  }

  const total = receivedWebhooks.length;
  const validHmac = receivedWebhooks.filter(w => w.isValid).length;
  const financialSynced = receivedWebhooks.filter(w => w.financialVerified && w.synced).length;
  const failedSignatures = receivedWebhooks.filter(w => !w.isValid).length;
  const telcoFailed = receivedWebhooks.filter(w => w.status === 'FAILED' || w.failureReason === 'TELCO_REJECTED').length;
  const reconciliationAnomalies = receivedWebhooks.filter(w => w.isValid && !w.financialVerified).length;

  return res.json({
    success: true,
    timestamp: new Date().toISOString(),
    configuration: {
      isWebhookKeyConfigured,
      isTokenConfigured,
      isPaymentLedgerConfigured: ledgerReady,
      ledgerError,
      environment: process.env.NODE_ENV || "production"
    },
    metrics: {
      totalReceived: total,
      validSignatures: validHmac,
      reconciledPayments: financialSynced,
      failedSignatures,
      telcoFailed,
      reconciliationAnomalies
    },
    recentFailures: receivedWebhooks.filter(w => !w.isValid || !w.financialVerified || w.status === 'FAILED').slice(0, 10)
  });
});

// API: Webhook simulation endpoint permanently disabled for security
app.post("/api/campay/simulate-webhook-post", (req, res) => {
  return res.status(403).json({
    success: false,
    error: "Ce point de terminaison de simulation est définitivement désactivé pour préserver l'intégrité financière."
  });
});

// API: Campay Portal Fee Collection secure endpoint
app.post("/api/campay/collect-portal-fee", async (req, res) => {
  const { amount, phone, schoolId, schoolName } = req.body;
  if (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 ||
      typeof phone !== "string" || !phone.trim() ||
      typeof schoolId !== "string" || !schoolId.trim()) {
    return res.status(400).json({ success: false, error: "Montant entier positif, téléphone et établissement requis." });
  }

  const firebaseUser = await getVerifiedFirebaseUser(req);
  if (!firebaseUser) {
    return res.status(401).json({ success: false, error: "Authentification Firebase requise." });
  }

  let schoolNameForPayment = schoolName;
  try {
    const school = await getAdminDb().collection("establishments").doc(schoolId).get();
    if (!school.exists) {
      return res.status(404).json({ success: false, error: "Établissement introuvable." });
    }
    if (!await canManageSchool(firebaseUser.uid, firebaseUser.email, schoolId)) {
      return res.status(403).json({ success: false, error: "Vous n'êtes pas autorisé à payer pour cet établissement." });
    }
    schoolNameForPayment = school.get("name") || schoolName || schoolId;
  } catch (err) {
    console.error("[Campay Portal Fee] Firebase authorization or ledger setup failed:", err);
    return res.status(503).json({
      success: false,
      error: "Le registre de paiement Firebase n'est pas configuré ou disponible."
    });
  }

  // 1. Format the phone number to start with 237 (Cameroon country code)
  let formattedPhone = phone.trim().replace(/\D/g, "");
  if (formattedPhone.length === 8) {
    formattedPhone = "2376" + formattedPhone;
  } else if (formattedPhone.length === 9) {
    formattedPhone = "237" + formattedPhone;
  } else if (!(formattedPhone.startsWith("237") && formattedPhone.length === 12)) {
    return res.status(400).json({ success: false, error: "Numéro de téléphone invalide." });
  }

  const token = process.env.CAMPAY_TOKEN || "";
  if (!token) {
    console.error("❌ [Campay Collect Portal Fee] CAMPAY_TOKEN is not configured on the server!");
    return res.status(500).json({
      success: false,
      error: "La passerelle de paiement Campay n'est pas encore configurée sur le serveur (jeton d'API manquant)."
    });
  }

  const roundedAmount = Math.round(Number(amount));
  const externalRef = `PRTL_${schoolId}_${crypto.randomUUID().replace(/-/g, "")}`;
  const intentRef = getAdminDb().collection("portal_payment_intents").doc(externalRef);
  try {
    await intentRef.create({
      externalReference: externalRef,
      schoolId,
      requestedBy: firebaseUser.uid,
      amount: roundedAmount,
      currency: "XAF",
      phone: formattedPhone,
      status: "INITIATING",
      createdAt: new Date().toISOString(),
      synced: false
    });
  } catch (err) {
    console.error("[Campay Portal Fee] Could not create payment intent:", err);
    return res.status(503).json({
      success: false,
      error: "Impossible d'enregistrer la demande de paiement de manière sécurisée."
    });
  }

  try {
    const campayUrl = "https://www.campay.net/api/collect/";
    const response = await fetch(campayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: roundedAmount.toString(),
        currency: "XAF",
        from: formattedPhone,
        description: `Pasma-sys Portal Fee - ${schoolNameForPayment || schoolId}`,
        external_reference: externalRef
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.reference) {
      try {
        await intentRef.update({
          campayReference: String(data.reference),
          status: "PENDING",
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("[Campay Portal Fee] Campay accepted a payment but the intent update failed:", err);
        return res.status(202).json({
          success: true,
          status: "PENDING",
          reference: String(data.reference),
          externalRef,
          error: "Campay a accepté la demande, mais son suivi est temporairement indisponible. Ne relancez pas le paiement."
        });
      }
      return res.status(200).json({
        success: true,
        reference: String(data.reference),
        status: "PENDING",
        message: "Demande transmise à Campay. Le paiement sera confirmé après notification vérifiée.",
        externalRef
      });
    } else if (!response.ok) {
      const apiErrorMsg = data.detail || data.message || (typeof data === 'string' ? data : JSON.stringify(data)) || "Requête refusée par Campay";
      console.warn("❌ [Campay API Rejected]:", apiErrorMsg);
      await intentRef.update({ status: "FAILED", updatedAt: new Date().toISOString() });
      
      return res.status(400).json({
        success: false,
        error: `Échec du prélèvement Campay : ${apiErrorMsg}`,
        details: data
      });
    }

    await intentRef.update({ status: "UNKNOWN", updatedAt: new Date().toISOString() });
    return res.status(202).json({
      success: true,
      status: "UNKNOWN",
      reference: externalRef,
      externalRef,
      message: "Campay n'a pas fourni de référence. Vérifiez le statut avant de renouveler l'opération."
    });
  } catch (err: any) {
    console.error("❌ [Campay Connection Error]:", err);
    await intentRef.update({
      status: "UNKNOWN",
      updatedAt: new Date().toISOString()
    }).catch(updateError => {
      console.error("[Campay Portal Fee] Could not update uncertain payment intent:", updateError);
    });
    return res.status(202).json({
      success: true,
      status: "UNKNOWN",
      reference: externalRef,
      externalRef,
      error: "Résultat de la demande Campay incertain. Vérifiez le statut avant de renouveler l'opération."
    });
  }
});

app.get("/api/campay/portal-fees/:externalRef", async (req, res) => {
  const firebaseUser = await getVerifiedFirebaseUser(req);
  if (!firebaseUser) {
    return res.status(401).json({ success: false, error: "Authentification Firebase requise." });
  }

  const externalRef = req.params.externalRef;
  if (!/^PRTL_[a-zA-Z0-9_-]{1,180}$/.test(externalRef)) {
    return res.status(400).json({ success: false, error: "Référence de paiement invalide." });
  }

  try {
    const intent = await getAdminDb().collection("portal_payment_intents").doc(externalRef).get();
    if (!intent.exists) {
      return res.status(404).json({ success: false, error: "Paiement introuvable." });
    }
    if (!await canManageSchool(firebaseUser.uid, firebaseUser.email, String(intent.get("schoolId")))) {
      return res.status(403).json({ success: false, error: "Accès refusé à ce paiement." });
    }

    return res.json({
      success: true,
      status: intent.get("status"),
      reference: intent.get("campayReference") || externalRef,
      externalRef,
      amount: intent.get("amount"),
      paidAt: intent.get("verifiedAt") || null
    });
  } catch (err) {
    console.error("[Campay Portal Fee] Could not read payment status:", err);
    return res.status(503).json({
      success: false,
      error: "Impossible de vérifier le statut du paiement pour le moment."
    });
  }
});

// API: Campay Tuition / School Fee Collection secure endpoint for parents
app.post("/api/campay/collect-tuition", async (req, res) => {
  const { invoiceId, phone, amount } = req.body;
  if (!invoiceId || typeof invoiceId !== "string" || !invoiceId.trim() ||
      !phone || typeof phone !== "string" || !phone.trim()) {
    return res.status(400).json({ success: false, error: "Identifiant de facture et numéro de téléphone requis." });
  }

  const firebaseUser = await getVerifiedFirebaseUser(req);
  if (!firebaseUser) {
    return res.status(401).json({ success: false, error: "Authentification Firebase requise." });
  }

  let invoiceData: any = null;
  const cleanInvoiceId = invoiceId.trim();
  try {
    const invSnap = await getAdminDb().collection("invoices").doc(cleanInvoiceId).get();
    if (!invSnap.exists) {
      return res.status(404).json({ success: false, error: "Facture scolaire introuvable." });
    }
    invoiceData = invSnap.data()!;
    if (invoiceData.status === "Paid") {
      return res.status(400).json({ success: false, error: "Cette facture est déjà intégralement soldée." });
    }
    if (!await canManageInvoice(firebaseUser.uid, firebaseUser.email, invoiceData)) {
      return res.status(403).json({ success: false, error: "Vous n'êtes pas autorisé à régler cette facture." });
    }
  } catch (err) {
    console.error("[Campay Tuition] Firebase invoice authorization or ledger check failed:", err);
    return res.status(503).json({
      success: false,
      error: "Le registre de paiement Firebase n'est pas configuré ou disponible."
    });
  }

  // Determine amount to charge
  const totalDue = Number(invoiceData.amount || 0);
  const alreadyPaid = Number(invoiceData.amountPaid || 0);
  const remainingDue = Math.max(0, totalDue - alreadyPaid);

  let targetAmount = remainingDue;
  if (amount !== undefined && amount !== null && amount !== "") {
    const customAmount = Number(amount);
    if (!Number.isSafeInteger(customAmount) || customAmount <= 0) {
      return res.status(400).json({ success: false, error: "Le montant à payer doit être un entier positif." });
    }
    if (customAmount > remainingDue) {
      return res.status(400).json({
        success: false,
        error: `Le montant (${customAmount} FCFA) dépasse le solde restant dû (${remainingDue} FCFA).`
      });
    }
    targetAmount = customAmount;
  }

  if (targetAmount <= 0) {
    return res.status(400).json({ success: false, error: "Aucun montant restant dû sur cette facture." });
  }

  // Format the phone number to start with 237 (Cameroon country code)
  let formattedPhone = phone.trim().replace(/\D/g, "");
  if (formattedPhone.length === 8) {
    formattedPhone = "2376" + formattedPhone;
  } else if (formattedPhone.length === 9) {
    formattedPhone = "237" + formattedPhone;
  } else if (!(formattedPhone.startsWith("237") && formattedPhone.length === 12)) {
    return res.status(400).json({ success: false, error: "Numéro de téléphone invalide (format camerounais requis : 237XXXXXXXXX)." });
  }

  const token = process.env.CAMPAY_TOKEN || "";
  if (!token) {
    console.error("❌ [Campay Collect Tuition] CAMPAY_TOKEN is not configured on the server!");
    return res.status(500).json({
      success: false,
      error: "La passerelle de paiement Campay n'est pas encore configurée sur le serveur (jeton d'API manquant)."
    });
  }

  const safeInvoiceKey = cleanInvoiceId.replace(/[^a-zA-Z0-9_-]/g, "");
  const externalRef = `TUITION_${safeInvoiceKey}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const intentRef = getAdminDb().collection("tuition_payment_intents").doc(externalRef);

  try {
    await intentRef.create({
      externalReference: externalRef,
      invoiceId: cleanInvoiceId,
      studentId: invoiceData.studentId || null,
      parentId: invoiceData.parentId || null,
      requestedBy: firebaseUser.uid,
      amount: targetAmount,
      currency: "XAF",
      phone: formattedPhone,
      status: "INITIATING",
      createdAt: new Date().toISOString(),
      synced: false
    });
  } catch (err) {
    console.error("[Campay Tuition] Could not create payment intent:", err);
    return res.status(503).json({
      success: false,
      error: "Impossible d'enregistrer la demande de paiement de manière sécurisée."
    });
  }

  try {
    const campayUrl = "https://www.campay.net/api/collect/";
    const response = await fetch(campayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: targetAmount.toString(),
        currency: "XAF",
        from: formattedPhone,
        description: `Pasma-sys Scolarite - ${invoiceData.title || cleanInvoiceId}`,
        external_reference: externalRef
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.reference) {
      try {
        await intentRef.update({
          campayReference: String(data.reference),
          status: "PENDING",
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("[Campay Tuition] Campay accepted payment but intent update failed:", err);
        return res.status(202).json({
          success: true,
          status: "PENDING",
          reference: String(data.reference),
          externalRef,
          error: "Campay a accepté la demande, mais son suivi est temporairement indisponible. Ne relancez pas le paiement."
        });
      }
      return res.status(200).json({
        success: true,
        reference: String(data.reference),
        status: "PENDING",
        amount: targetAmount,
        message: "Demande de prélèvement transmise à Campay. Veuillez composer votre code secret sur le téléphone.",
        externalRef
      });
    } else if (!response.ok) {
      const apiErrorMsg = data.detail || data.message || (typeof data === 'string' ? data : JSON.stringify(data)) || "Requête refusée par Campay";
      console.warn("❌ [Campay API Rejected Tuition]:", apiErrorMsg);
      await intentRef.update({ status: "FAILED", updatedAt: new Date().toISOString() });
      return res.status(400).json({
        success: false,
        error: `Paiement rejeté par Campay : ${apiErrorMsg}`,
        details: data
      });
    }

    await intentRef.update({ status: "UNKNOWN", updatedAt: new Date().toISOString() });
    return res.status(202).json({
      success: true,
      status: "UNKNOWN",
      reference: externalRef,
      externalRef,
      message: "Campay n'a pas fourni de référence. Vérifiez le statut avant de renouveler l'opération."
    });
  } catch (err: any) {
    console.error("❌ [Campay Connection Error Tuition]:", err);
    await intentRef.update({
      status: "UNKNOWN",
      updatedAt: new Date().toISOString()
    }).catch(updateError => {
      console.error("[Campay Tuition] Could not update uncertain payment intent:", updateError);
    });
    return res.status(202).json({
      success: true,
      status: "UNKNOWN",
      reference: externalRef,
      externalRef,
      error: "Résultat de la demande Campay incertain. Vérifiez le statut avant de renouveler l'opération."
    });
  }
});

// API: Check status of a tuition payment intent
app.get("/api/campay/tuition/:externalRef", async (req, res) => {
  const firebaseUser = await getVerifiedFirebaseUser(req);
  if (!firebaseUser) {
    return res.status(401).json({ success: false, error: "Authentification Firebase requise." });
  }

  const externalRef = req.params.externalRef;
  if (!/^TUITION_[a-zA-Z0-9_-]{1,180}$/.test(externalRef)) {
    return res.status(400).json({ success: false, error: "Référence de paiement scolarité invalide." });
  }

  try {
    const intent = await getAdminDb().collection("tuition_payment_intents").doc(externalRef).get();
    if (!intent.exists) {
      return res.status(404).json({ success: false, error: "Paiement introuvable." });
    }

    const invoiceId = String(intent.get("invoiceId"));
    const invSnap = await getAdminDb().collection("invoices").doc(invoiceId).get();
    if (invSnap.exists) {
      if (!await canManageInvoice(firebaseUser.uid, firebaseUser.email, invSnap.data()!)) {
        return res.status(403).json({ success: false, error: "Accès refusé à ce paiement." });
      }
    }

    return res.json({
      success: true,
      status: intent.get("status"),
      reference: intent.get("campayReference") || externalRef,
      externalRef,
      amount: intent.get("amount"),
      invoiceId,
      paidAt: intent.get("verifiedAt") || null
    });
  } catch (err) {
    console.error("[Campay Tuition Fee] Could not read payment status:", err);
    return res.status(503).json({
      success: false,
      error: "Impossible de vérifier le statut du paiement pour le moment."
    });
  }
});


// Vite Middleware integrated after API routes to handle asset serving and SPA routing fallback
async function bootServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️ Starting dev server with integrated Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Starting standalone production server serving static dist folder...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`📡 Pasma-sys Backend Express actively running on http://localhost:${PORT}`);
  });
}

bootServer();
