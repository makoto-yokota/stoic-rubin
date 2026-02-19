import React, { useState, useEffect } from "react";
import {
  Users,
  MapPin,
  Wallet,
  Home,
  Heart,
  ArrowRight,
  MessageCircle,
  Lightbulb,
  CheckCircle2,
  Printer,
  RefreshCw,
  Sparkles,
  User,
  Baby,
  BrainCircuit,
  ShieldCheck,
  Coffee,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Key,
  Settings,
  ExternalLink,
  Lock,
  Copy,
  Check,
  Bug,
  Cpu,
  Signal,
  Loader2,
  FileText,
  FileSpreadsheet,
  Download,
  Zap,
  Eye,
  CloudSun,
  MessageSquareQuote,
  List,
  Palette,
  Thermometer,
  Dog,
  Coins,
  Briefcase,
  Trees,
  Search,
  Gem,
  ChevronRight,
  Table,
  RefreshCcw,
} from "lucide-react";

// --- 定数: デフォルトモデルリスト ---
// gemini-2.5-flash-lite をデフォルトに設定
const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-002",
  "gemini-1.5-pro",
  "gemini-2.0-flash-exp",
];

// --- ヘルパー関数: 頑丈なJSON抽出ロジック ---
const extractJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    // Markdownコードブロックを除去して再トライ
    let cleanText = text.replace(/```json/g, "").replace(/```/g, "");
    try {
      return JSON.parse(cleanText);
    } catch (e2) {
      // {} で囲まれた部分を抽出して再トライ
      const start = cleanText.indexOf("{");
      const end = cleanText.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        try {
          return JSON.parse(cleanText.substring(start, end + 1));
        } catch (e3) {
          throw new Error("AIの返答を解析できませんでした。");
        }
      }
      throw new Error("AIからの返答に有効なデータが含まれていません。");
    }
  }
};

// --- 自動リトライ機能 (Exponential Backoff) ---
const fetchWithRetry = async (url, options, retries = 3, delay = 2000) => {
  try {
    const response = await fetch(url, options);
    // 429 (Too Many Requests) または 5xx (Server Error) の場合
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      console.warn(`Retry attempt ${4 - retries}... waiting ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      // 待機時間を増やして再帰呼び出し
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

// --- アプリケーション全体 ---
const App = () => {
  const [step, setStep] = useState("checking_session");
  const [apiKey, setApiKey] = useState("");
  const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0]);
  const [mode, setMode] = useState("standard"); // 'standard' | 'first_visit'

  // 標準モード用データ (初期値を空に設定)
  const [standardData, setStandardData] = useState({
    customerName: "",
    age: "",
    family: "",
    currentHome: "",
    land: "なし",
    budget: "",
    hobbies: "",
    worries: "",
    personality: "",
  });

  // 初回接客モード用データ (初期値を空に設定)
  const [firstVisitData, setFirstVisitData] = useState({
    appearance: "",
    atmosphere: "",
    situation: "",
    estimatedAge: "",
    group: "",
    memo: "",
  });

  const [aiResult, setAiResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  // 初回ロード時
  useEffect(() => {
    const storedKey = localStorage.getItem("gemini_api_key");
    const storedModel = localStorage.getItem("gemini_model_id");

    if (storedKey) {
      setApiKey(storedKey);

      // 保存されたモデルがあればそれを使用、なければデフォルト
      if (storedModel) {
        setSelectedModel(storedModel);
      } else {
        setSelectedModel(DEFAULT_MODELS[0]);
      }

      // モデル一覧取得（失敗しても入力画面へ進む）
      refreshModelList(storedKey).finally(() => {
        setStep("input");
      });
    } else {
      setStep("setup");
    }
  }, []);

  // モデルリスト更新
  const refreshModelList = async (key) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!response.ok) return;

      const data = await response.json();
      const validModels = (data.models || [])
        .filter(
          (m) =>
            m.supportedGenerationMethods &&
            m.supportedGenerationMethods.includes("generateContent")
        )
        .map((m) => m.name.replace("models/", ""));

      if (validModels.length > 0) {
        // デフォルトにしたいモデルをリストに強制追加（API一覧に出てこない場合があるため）
        const targetModel = "gemini-2.5-flash-lite";
        if (!validModels.includes(targetModel)) {
          validModels.push(targetModel);
        }

        const sortedModels = validModels.sort((a, b) => {
          const score = (name) => {
            if (name === targetModel) return 100;
            if (name.includes("gemini-2.5-flash")) return 90;
            if (name.includes("gemini-1.5-flash")) return 50;
            return 0;
          };
          return score(b) - score(a);
        });

        setAvailableModels(sortedModels);

        const current = localStorage.getItem("gemini_model_id");
        if (!current) {
          setSelectedModel(sortedModels[0]);
          localStorage.setItem("gemini_model_id", sortedModels[0]);
        } else if (sortedModels.includes(current)) {
          setSelectedModel(current);
        }
      }
    } catch (e) {
      console.warn("Offline or API unavailable, using default models.", e);
    }
  };

  const handleSaveSettings = async (key) => {
    if (!key.trim()) return;
    localStorage.setItem("gemini_api_key", key.trim());
    setApiKey(key.trim());
    await refreshModelList(key.trim());
    setStep("input");
  };

  const handleClearSettings = () => {
    if (
      window.confirm("保存されているAPIキーを削除して、初期設定に戻りますか？")
    ) {
      localStorage.removeItem("gemini_api_key");
      localStorage.removeItem("gemini_model_id");
      setApiKey("");
      setStep("setup");
      setAiResult(null);
    }
  };

  const handleStandardChange = (e) => {
    const { name, value } = e.target;
    setStandardData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFirstVisitChange = (e) => {
    const { name, value } = e.target;
    setFirstVisitData((prev) => ({ ...prev, [name]: value }));
  };

  // 429エラー時にモデルをFlashに切り替えて再実行する関数
  const handleSwitchModelAndRetry = () => {
    const safeModel = "gemini-1.5-flash";
    setSelectedModel(safeModel);
    localStorage.setItem("gemini_model_id", safeModel);
    // State更新の反映を待たずに即実行するために引数で渡す
    setTimeout(() => {
      generateStrategy(safeModel);
    }, 100);
  };

  // Gemini API呼び出し
  const generateStrategy = async (overrideModel = null) => {
    setStep("loading");
    setErrorMessage("");
    setDebugInfo("");

    const modelToUse = overrideModel || selectedModel;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    let prompt = "";

    const outputSchema = `
    以下のJSON形式で出力してください。Markdownコードブロックは不要です。純粋なJSONオブジェクトのみを返してください。
    
    {
      "strategy_theme": "戦略テーマ",
      "customer_psychology": "顧客の心理状態・プロファイリング（簡潔に）",
      "phases": [
        {
          "title": "フェーズ名",
          "goal": "ゴール",
          "script_example": "トーク例（短く）",
          "pro_insight": "プロの意図（短く）"
        }
      ],
      "closing_message": "アドバイス",
      "ice_break_categories": [
        {
          "category_id": "money",
          "category_name": "資金・ローン",
          "items": [
            { 
              "topic": "話題のトピック（20文字以内）", 
              "script": "実際の会話切り出し例（1文程度。ラポール形成を意識した言葉遣いで）",
              "type": "きっかけ" OR "深掘り",
              "intent": "狙い" 
            },
            { "topic": "...", "script": "...", "type": "...", "intent": "..." }
          ]
        },
        { "category_id": "family", "category_name": "家族・教育", "items": [] },
        { "category_id": "work_hobby", "category_name": "仕事・趣味", "items": [] },
        { "category_id": "pet", "category_name": "ペット", "items": [] },
        { "category_id": "land", "category_name": "立地・環境", "items": [] },
        { "category_id": "design", "category_name": "デザイン", "items": [] },
        { "category_id": "spec", "category_name": "設備・性能", "items": [] }
      ]
    }
    `;

    let instruction = "";
    if (mode === "standard") {
      if (!standardData.customerName) {
        alert("お客様名を入力してください");
        setStep("input");
        return;
      }
      instruction = `
        あなたは注文住宅のトップセールスです。
        以下の顧客情報をもとに、商談戦略と、7つのカテゴリ別に「アイスブレイク（雑談）の引き出し」を生成してください。
        
        【重要：雑談リストの生成ルール】
        1. **必ず各カテゴリにつき10個の項目を生成してください。（合計70個）**
        2. **会話例 (script)**: 「〜ですよね？」「〜というお話もよく聞きますが...」など、営業がそのまま口に出せる自然な1文にしてください。
        3. **タイプ分類 (type)**:
           - 「きっかけ」: ニーズを引き出す入り口となる質問。
           - 「深掘り」: 相手の価値観に触れ、信頼（ラポール）を得るための質問。
        4. 顧客の趣味（${standardData.hobbies}）や性格（${standardData.personality}）に関連付けた話題を多く含めてください。
           ただし、無理やり結びつけず、自然な会話の流れを最優先し、一般的な話題も適度に混ぜてください。

        【顧客データ (詳細)】
        - 氏名: ${standardData.customerName}
        - 年代: ${standardData.age}代
        - 家族構成: ${standardData.family}
        - 現在の住まい: ${standardData.currentHome}
        - 土地の有無: ${standardData.land}
        - 予算・年収: ${standardData.budget}
        - 趣味・仕事・役割: ${standardData.hobbies}
        - 現在の悩み: ${standardData.worries}
        - 性格・タイプ: ${standardData.personality}
      `;
    } else {
      instruction = `
        あなたは注文住宅のトップセールスです。
        まだ情報の少ない「初回接客」のお客様が来店されました。

        【重要：雑談リストの生成ルール】
        1. **必ず各カテゴリにつき10個の項目を生成してください。（合計70個）**
        2. **会話例 (script)**: 警戒心を解くための、柔らかい1文にしてください。
        3. **タイプ分類 (type)**:
           - 「きっかけ」: 天気や状況から入れる軽い話題。
           - 「深掘り」: 「なぜ住宅展示場に来ようと思ったか」など、動機の核心に迫る話題。
        4. 見た目や状況（${firstVisitData.appearance} / ${firstVisitData.situation}）から推測できる話題を優先してください。
           ただし、無理やり結びつけず、自然な会話の流れを最優先し、一般的な話題も適度に混ぜてください。

        【顧客データ (観察・状況)】
        - 推定年代: ${firstVisitData.estimatedAge}
        - 推定グループ: ${firstVisitData.group}
        - 見た目の印象: ${firstVisitData.appearance}
        - その場の雰囲気: ${firstVisitData.atmosphere}
        - 来場状況: ${firstVisitData.situation}
        - 営業メモ: ${firstVisitData.memo}
      `;
    }

    try {
      const response = await fetchWithRetry(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction + outputSchema }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setDebugInfo(JSON.stringify(errorData, null, 2));

        if (response.status === 429) {
          throw new Error(
            "アクセス集中により制限がかかっています(429)。安定版モデル(Flash)への切り替えを推奨します。"
          );
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content
      ) {
        throw new Error("AIからの応答が空でした。");
      }

      const rawText = data.candidates[0].content.parts[0].text;
      const parsedData = extractJSON(rawText);

      setAiResult(parsedData);
      setStep("result");
    } catch (error) {
      console.error("Generation Error:", error);
      setErrorMessage(error.message);
      setStep("error");
    }
  };

  const resetApp = () => {
    setStep("input");
    setAiResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 pb-12">
      <Header
        step={step}
        onReset={resetApp}
        onClearKey={handleClearSettings}
        showSettings={step !== "setup" && step !== "checking_session"}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {step === "checking_session" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-300">
            <Loader2 size={32} className="text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500">Loading...</p>
          </div>
        )}

        {step === "setup" && <SetupScreen onSave={handleSaveSettings} />}

        {step === "input" && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm inline-flex">
                <button
                  onClick={() => setMode("standard")}
                  className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                    mode === "standard"
                      ? "bg-indigo-100 text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <User size={16} /> 標準プロファイリング
                </button>
                <button
                  onClick={() => setMode("first_visit")}
                  className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                    mode === "first_visit"
                      ? "bg-teal-100 text-teal-700 shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Eye size={16} /> 初回接客モード
                </button>
              </div>
            </div>

            <InputSection
              mode={mode}
              standardData={standardData}
              firstVisitData={firstVisitData}
              onStandardChange={handleStandardChange}
              onFirstVisitChange={handleFirstVisitChange}
              onGenerate={() => generateStrategy(null)}
              selectedModel={selectedModel}
              availableModels={availableModels}
              onModelChange={(m) => {
                setSelectedModel(m);
                localStorage.setItem("gemini_model_id", m);
              }}
            />
          </div>
        )}

        {step === "loading" && <LoadingView mode={mode} />}

        {step === "error" && (
          <ErrorView
            message={errorMessage}
            debugInfo={debugInfo}
            onRetry={() => setStep("input")}
            onResetKey={handleClearSettings}
            onSwitchModel={handleSwitchModelAndRetry}
          />
        )}

        {step === "result" && aiResult && (
          <ResultView
            data={aiResult}
            customerName={
              mode === "standard" ? standardData.customerName : "初回のお客様"
            }
          />
        )}
      </main>
    </div>
  );
};

// --- ヘッダー ---
const Header = ({ step, onReset, onClearKey, showSettings }) => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-2 rounded-lg shadow-md">
          <BrainCircuit size={20} />
        </div>
        <h1 className="font-bold text-xl tracking-tight text-slate-900">
          Sales Flow Architect{" "}
          <span className="text-indigo-600 text-sm font-normal ml-1">
            Final Edition
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {step === "result" && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
          >
            <RefreshCw size={16} /> 新規作成
          </button>
        )}
        {showSettings && (
          <button
            onClick={onClearKey}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-md transition-colors"
          >
            <Settings size={18} />
          </button>
        )}
      </div>
    </div>
  </header>
);

// --- 初期設定画面 ---
const SetupScreen = ({ onSave }) => {
  const [inputKey, setInputKey] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const aiStudioUrl = "https://aistudio.google.com/app/apikey";

  const handleCopyUrl = () => {
    // navigator.clipboard.writeTextのフォールバック
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(aiStudioUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          fallbackCopyTextToClipboard(aiStudioUrl);
        });
    } else {
      fallbackCopyTextToClipboard(aiStudioUrl);
    }
  };

  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  const handleConnect = async () => {
    setIsChecking(true);
    await onSave(inputKey);
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500 max-w-lg mx-auto mt-10">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-center">
          <Settings className="text-white mx-auto mb-2" size={32} />
          <h2 className="text-xl font-bold text-white">Initial Setup</h2>
          <p className="text-indigo-100 text-sm">アプリの初期設定</p>
        </div>
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Step 1: APIキー取得サイト
              </label>
              <a
                href={aiStudioUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink size={10} /> 外部サイトで開く
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={aiStudioUrl}
                className="flex-1 bg-white border border-slate-300 text-slate-600 text-xs p-2.5 rounded select-all focus:outline-none"
              />
              <button
                onClick={handleCopyUrl}
                className={`p-2.5 rounded border transition-colors ${
                  copied
                    ? "bg-green-50 border-green-200 text-green-600"
                    : "bg-white border-slate-300 text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                }`}
                title="URLをコピー"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Step 2: キーを入力
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={!inputKey || isChecking}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold disabled:bg-slate-300 flex justify-center items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md"
          >
            {isChecking ? (
              <>
                <Loader2 className="animate-spin" size={20} /> 接続中...
              </>
            ) : (
              "設定を保存して開始"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 入力フォーム ---
const InputSection = ({
  mode,
  standardData,
  firstVisitData,
  onStandardChange,
  onFirstVisitChange,
  onGenerate,
  selectedModel,
  availableModels,
  onModelChange,
}) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-4xl mx-auto">
        <div
          className={`p-4 text-center border-b ${
            mode === "first_visit"
              ? "bg-teal-50 border-teal-100 text-teal-800"
              : "bg-indigo-50 border-indigo-100 text-indigo-800"
          }`}
        >
          <h3 className="font-bold text-lg flex items-center justify-center gap-2">
            {mode === "first_visit" ? <Eye size={20} /> : <User size={20} />}
            {mode === "first_visit" ? "初回接客モード" : "標準プロファイリング"}
          </h3>
          <p className="text-xs opacity-80 mt-1">
            {mode === "first_visit"
              ? "まだ情報が少ないお客様向け。見た目や状況から会話の糸口を探ります。"
              : "具体的な情報があるお客様向け。役割や趣味から「語りたい話題」を分析します。"}
          </p>
        </div>

        <div className="p-8 grid gap-8">
          {mode === "standard" && (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    お客様名 (必須)
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={standardData.customerName}
                    onChange={onStandardChange}
                    placeholder="例: 佐藤"
                    className="w-full p-3 bg-indigo-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    年代 / 家族構成
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="age"
                      value={standardData.age}
                      onChange={onStandardChange}
                      placeholder="例: 30"
                      className="w-1/3 p-3 bg-indigo-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      name="family"
                      value={standardData.family}
                      onChange={onStandardChange}
                      placeholder="例: 夫婦、子供2人"
                      className="flex-1 p-3 bg-indigo-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={14} /> ここが重要！ (Ice Break Keys)
                </h4>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    趣味・仕事・役割（詳しく書いてください）
                  </label>
                  <textarea
                    name="hobbies"
                    value={standardData.hobbies}
                    onChange={onStandardChange}
                    rows="3"
                    placeholder="例: バスケチームのコーチをしている。戦略を立てるのが好き。キャンプでは道具にこだわるタイプ。"
                    className="w-full p-3 bg-indigo-50/30 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none shadow-sm"
                  />
                  <p className="text-xs text-slate-500">
                    ※ここに書かれた内容から、お客様が「語りたくなる」話題をAIが生成します。
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">
                      現在の住まい・悩み
                    </label>
                    <input
                      type="text"
                      name="worries"
                      value={standardData.worries}
                      onChange={onStandardChange}
                      placeholder="例: 収納不足、冬寒いなど"
                      className="w-full p-3 bg-indigo-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">
                      性格・タイプ
                    </label>
                    <input
                      type="text"
                      name="personality"
                      value={standardData.personality}
                      onChange={onStandardChange}
                      placeholder="例: 慎重派、即決派など"
                      className="w-full p-3 bg-indigo-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === "first_visit" && (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    推定年代
                  </label>
                  <input
                    type="text"
                    name="estimatedAge"
                    value={firstVisitData.estimatedAge}
                    onChange={onFirstVisitChange}
                    placeholder="例: 30代前半くらい"
                    className="w-full p-3 bg-teal-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    推定グループ
                  </label>
                  <input
                    type="text"
                    name="group"
                    value={firstVisitData.group}
                    onChange={onFirstVisitChange}
                    placeholder="例: 若い夫婦、親御さんも一緒"
                    className="w-full p-3 bg-teal-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">
                  見た目の印象・持ち物
                </label>
                <textarea
                  name="appearance"
                  value={firstVisitData.appearance}
                  onChange={onFirstVisitChange}
                  rows="2"
                  placeholder="例: スポーティーな服装、アウトドアブランドの帽子..."
                  className="w-full p-3 bg-teal-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    その場の雰囲気
                  </label>
                  <input
                    type="text"
                    name="atmosphere"
                    value={firstVisitData.atmosphere}
                    onChange={onFirstVisitChange}
                    placeholder="例: 緊張している、楽しそう"
                    className="w-full p-3 bg-teal-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    来場状況
                  </label>
                  <input
                    type="text"
                    name="situation"
                    value={firstVisitData.situation}
                    onChange={onFirstVisitChange}
                    placeholder="例: 雨の日、予約なし"
                    className="w-full p-3 bg-teal-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-200 text-center">
          <div className="mb-4 flex justify-center items-center gap-2 text-xs text-slate-500">
            <Cpu size={14} /> Model:
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="bg-transparent border-b border-slate-300 focus:outline-none px-1"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onGenerate}
            className={`w-full sm:w-auto px-12 py-4 rounded-full font-bold text-lg shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 mx-auto text-white ${
              mode === "first_visit"
                ? "bg-gradient-to-r from-teal-500 to-emerald-500 hover:shadow-teal-500/30"
                : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-indigo-500/30"
            }`}
          >
            <BrainCircuit size={20} />
            {mode === "first_visit"
              ? "会話の糸口をAI分析する"
              : "商談戦略を立案させる"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ローディング ---
const LoadingView = ({ mode }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
    <div className="relative">
      <div
        className={`w-20 h-20 border-4 border-slate-200 rounded-full animate-spin ${
          mode === "first_visit" ? "border-t-teal-500" : "border-t-indigo-600"
        }`}
      ></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles
          size={28}
          className={`animate-pulse ${
            mode === "first_visit" ? "text-teal-500" : "text-indigo-600"
          }`}
        />
      </div>
    </div>
    <h3 className="mt-8 text-2xl font-bold text-slate-800">
      {mode === "first_visit"
        ? "会話の糸口を探しています..."
        : "最適なアイスブレイクを生成中..."}
    </h3>
    <div className="mt-4 space-y-2 text-center text-slate-500">
      <p className="animate-pulse delay-75">顧客プロファイルを解析しています</p>
      <p className="animate-pulse delay-150">
        7つのカテゴリで会話の引き出しを検索中...
      </p>
      <p className="animate-pulse delay-300">簡潔なリストを作成しています</p>
    </div>
  </div>
);

// --- エラー画面 ---
const ErrorView = ({
  message,
  debugInfo,
  onRetry,
  onResetKey,
  onSwitchModel,
}) => (
  <div className="text-center p-12 animate-in fade-in max-w-2xl mx-auto">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
      <AlertCircle size={32} />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">
      エラーが発生しました
    </h3>
    <p className="text-slate-600 mb-6 font-medium">{message}</p>

    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
      {/* 429エラー時はモデル切り替えを優先表示 */}
      {message.includes("429") && (
        <button
          onClick={onSwitchModel}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2 justify-center"
        >
          <RefreshCcw size={16} /> 安定モデル(Flash)で再試行
        </button>
      )}

      <button
        onClick={onRetry}
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
      >
        もう一度試す
      </button>
      <button
        onClick={onResetKey}
        className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
      >
        設定変更
      </button>
    </div>
  </div>
);

// --- 個別の雑談アイテム (Accordion) ---
const IceBreakItem = ({ item, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`border rounded-xl transition-all duration-200 cursor-pointer ${
        isOpen
          ? "bg-white border-indigo-200 shadow-sm"
          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
      }`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {/* Header (Always Visible) */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <span
            className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
              isOpen
                ? "bg-indigo-100 text-indigo-700"
                : "bg-white border border-slate-200 text-slate-500"
            }`}
          >
            {index + 1}
          </span>
          <div className="flex flex-col min-w-0">
            <p
              className={`text-sm font-bold truncate ${
                isOpen ? "text-indigo-800" : "text-slate-700"
              }`}
            >
              {item.topic}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {item.type && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border hidden sm:inline-block ${
                item.type.includes("深掘り")
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-green-50 text-green-700 border-green-200"
              }`}
            >
              {item.type.includes("深掘り") ? "深掘り" : "きっかけ"}
            </span>
          )}
          {isOpen ? (
            <ChevronUp size={16} className="text-indigo-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mt-3">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">
              Talk Script
            </p>
            <p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed mb-3">
              "{item.script}"
            </p>

            <div className="flex items-start gap-2 text-xs text-slate-500 bg-yellow-50/50 p-2 rounded">
              <Lightbulb
                size={14}
                className="text-yellow-500 shrink-0 mt-0.5"
              />
              <span>
                <span className="font-bold">狙い:</span> {item.intent}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 結果表示 ---
const ResultView = ({ data, customerName }) => {
  const [activeTab, setActiveTab] = useState("strategy"); // 'strategy' | 'icebreak'
  const [iceBreakCat, setIceBreakCat] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedSpreadsheet, setCopiedSpreadsheet] = useState(false);

  const CATEGORY_ICONS = [
    { icon: Coins, color: "text-yellow-600", bg: "bg-yellow-100" }, // 資金
    { icon: Baby, color: "text-pink-600", bg: "bg-pink-100" }, // 家族
    { icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" }, // 仕事・趣味
    { icon: Dog, color: "text-orange-600", bg: "bg-orange-100" }, // ペット
    { icon: MapPin, color: "text-green-600", bg: "bg-green-100" }, // 立地
    { icon: Palette, color: "text-purple-600", bg: "bg-purple-100" }, // デザイン
    { icon: Thermometer, color: "text-cyan-600", bg: "bg-cyan-100" }, // 性能
  ];

  // クリップボードコピー処理の共通関数 (堅牢版)
  const copyToClipboard = (text, callback) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          callback(true);
          setTimeout(() => callback(false), 2000);
        })
        .catch((err) => {
          fallbackCopyTextToClipboard(text, callback);
        });
    } else {
      fallbackCopyTextToClipboard(text, callback);
    }
  };

  const fallbackCopyTextToClipboard = (text, callback) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        callback(true);
        setTimeout(() => callback(false), 2000);
      }
    } catch (err) {
      console.error("Fallback copy failed", err);
      alert("コピーに失敗しました。");
    }
    document.body.removeChild(textArea);
  };

  // ドキュメント用テキストコピー (Markdown)
  const handleCopyDocument = () => {
    let text = `# ${customerName || "お客様"}様 戦略シート\n\n`;
    text += `■ 戦略テーマ: ${data.strategy_theme}\n`;
    text += `■ 顧客心理: ${data.customer_psychology}\n\n`;

    // 戦略
    text += `## 商談シナリオ\n`;
    data.phases.forEach((phase, i) => {
      text += `\n### Phase ${i + 1}: ${phase.title}\n`;
      text += `**ゴール**: ${phase.goal}\n`;
      text += `**トーク例**: ${phase.script_example}\n`;
      text += `**プロの意図**: ${phase.pro_insight}\n`;
    });

    // 雑談リスト
    text += `\n## アイスブレイク・雑談の引き出し\n`;
    if (data.ice_break_categories) {
      data.ice_break_categories.forEach((cat) => {
        text += `\n### ${cat.category_name}\n`;
        cat.items.forEach((item) => {
          text += `- **${item.topic}** (${item.type || "-"}): "${
            item.script
          }"\n  (狙い: ${item.intent})\n`;
        });
      });
    }

    copyToClipboard(text, setCopied);
  };

  // スプレッドシート用コピー (TSV)
  const handleCopySpreadsheet = () => {
    let tsv = "Category\tType\tTopic\tScript\tIntent\n";

    if (data.ice_break_categories) {
      data.ice_break_categories.forEach((cat) => {
        cat.items.forEach((item) => {
          // タブや改行を除去・エスケープ
          const safe = (str) =>
            (str || "").replace(/\t/g, " ").replace(/\n/g, " ");
          tsv += `${safe(cat.category_name)}\t${safe(item.type)}\t${safe(
            item.topic
          )}\t${safe(item.script)}\t${safe(item.intent)}\n`;
        });
      });
    }

    copyToClipboard(tsv, setCopiedSpreadsheet);
  };

  // CSVダウンロード機能 (BOM付き)
  const handleDownloadCSV = () => {
    // ユーティリティ: CSVエスケープ
    const escapeCSV = (str) => {
      if (str === null || str === undefined) return "";
      return `"${String(str).replace(/"/g, '""')}"`;
    };

    let csvContent = "\ufeff"; // BOM
    csvContent += "Category,Type,Topic,Script,Intent\n";

    if (data.ice_break_categories) {
      data.ice_break_categories.forEach((cat) => {
        cat.items.forEach((item) => {
          csvContent += `${escapeCSV(cat.category_name)},${escapeCSV(
            item.type
          )},${escapeCSV(item.topic)},${escapeCSV(item.script)},${escapeCSV(
            item.intent
          )}\n`;
        });
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${customerName || "guest"}_icebreak_list.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          AI Generated
        </div>

        <div className="p-6 pb-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-1">
                Target Customer
              </h2>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                {customerName || "Guest"}様
              </h1>
              <p className="text-lg font-medium text-slate-600">
                {data.strategy_theme}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyDocument}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold transition-all ${
                  copied
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                }`}
                title="Googleドキュメントなどに貼り付け"
              >
                {copied ? <Check size={14} /> : <FileText size={14} />}{" "}
                {copied ? "コピー完了" : "テキストコピー"}
              </button>

              <button
                onClick={handleCopySpreadsheet}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold transition-all ${
                  copiedSpreadsheet
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700"
                }`}
                title="Googleスプレッドシートに直接貼り付け"
              >
                {copiedSpreadsheet ? <Check size={14} /> : <Table size={14} />}{" "}
                {copiedSpreadsheet ? "コピー完了" : "スプシ用コピー"}
              </button>

              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all"
                title="CSVファイルとしてダウンロード"
              >
                <Download size={14} /> CSV DL
              </button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("strategy")}
              className={`px-6 py-3 font-bold text-sm rounded-t-lg border-t border-x transition-colors ${
                activeTab === "strategy"
                  ? "bg-white border-slate-200 text-indigo-600 border-b-white -mb-px z-10"
                  : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <MapPin size={16} /> 戦略・シナリオ
              </span>
            </button>
            <button
              onClick={() => setActiveTab("icebreak")}
              className={`px-6 py-3 font-bold text-sm rounded-t-lg border-t border-x transition-colors ${
                activeTab === "icebreak"
                  ? "bg-white border-slate-200 text-teal-600 border-b-white -mb-px z-10"
                  : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <MessageSquareQuote size={16} /> 雑談の引き出し(70選)
              </span>
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-white min-h-[500px]">
          {/* === 戦略タブ === */}
          {activeTab === "strategy" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <BrainCircuit size={18} className="text-indigo-500" />{" "}
                  顧客心理プロファイリング
                </h3>
                <p className="text-slate-700 leading-relaxed text-sm">
                  {data.customer_psychology}
                </p>
              </div>

              <div className="space-y-6">
                <h3 className="font-bold text-lg text-slate-800 border-l-4 border-indigo-500 pl-3">
                  商談フロー
                </h3>
                {data.phases.map((phase, index) => (
                  <PhaseCard key={index} phase={phase} index={index} />
                ))}
              </div>

              <div className="text-center py-4 bg-indigo-50 rounded-lg">
                <p className="text-indigo-700 font-medium italic text-sm">
                  Advice: {data.closing_message}
                </p>
              </div>
            </div>
          )}

          {/* === 雑談タブ（アコーディオンUI） === */}
          {activeTab === "icebreak" && data.ice_break_categories && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {/* カテゴリ選択タブ */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                {data.ice_break_categories.map((cat, idx) => {
                  const Icon = CATEGORY_ICONS[idx % CATEGORY_ICONS.length].icon;
                  const isActive = iceBreakCat === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setIceBreakCat(idx)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                        isActive
                          ? `bg-teal-50 border-teal-200 text-teal-700 ring-2 ring-teal-500 ring-offset-1`
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Icon
                        size={14}
                        className={
                          isActive ? "text-teal-600" : "text-slate-400"
                        }
                      />
                      {cat.category_name.replace(/^[0-9]+\.\s*/, "")}
                    </button>
                  );
                })}
              </div>

              {/* 選択されたカテゴリの内容表示 */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 min-h-[400px]">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
                  <div
                    className={`p-2 rounded-lg ${
                      CATEGORY_ICONS[iceBreakCat % 7].bg
                    }`}
                  >
                    {React.createElement(CATEGORY_ICONS[iceBreakCat % 7].icon, {
                      size: 24,
                      className: CATEGORY_ICONS[iceBreakCat % 7].color,
                    })}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {data.ice_break_categories[iceBreakCat].category_name}
                  </h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {data.ice_break_categories[iceBreakCat].items.map(
                    (item, i) => (
                      <IceBreakItem key={i} item={item} index={i} />
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- サブコンポーネント: フェーズカード ---
const PhaseCard = ({ phase, index }) => {
  return (
    <div className="relative pl-0 md:pl-20 group">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 hidden md:block group-last:bottom-auto group-last:h-full"></div>
      <div className="absolute left-0 w-9 h-9 rounded-full border-4 border-white shadow-md z-10 hidden md:flex items-center justify-center bg-indigo-600 text-white font-bold text-sm">
        {index + 1}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="md:hidden bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {index + 1}
            </span>
            <h4 className="font-bold text-lg text-slate-800">{phase.title}</h4>
          </div>
          <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block w-fit">
            GOAL: {phase.goal}
          </div>
        </div>
        <div className="p-6 grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Conversation Script
            </div>
            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative">
              <div className="absolute top-4 left-4 w-2 h-full bg-indigo-500/10 rounded-full"></div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {phase.script_example}
              </p>
            </div>
          </div>
          <div className="lg:col-span-2 bg-yellow-50/50 rounded-xl p-4 border border-yellow-100">
            <h5 className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Lightbulb size={14} /> Pro Insight
            </h5>
            <p className="text-lg font-bold text-slate-800 leading-relaxed">
              {phase.pro_insight}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
