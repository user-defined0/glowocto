import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase";
import { 
  ShoppingBag, 
  PlusCircle, 
  Sparkles, 
  LifeBuoy, 
  LogOut, 
  Search, 
  Trash2, 
  Phone, 
  Mail, 
  X, 
  Send, 
  ChevronRight, 
  ShieldCheck, 
  Flame, 
  ThermometerSnowflake, 
  ChefHat, 
  MessageCircle, 
  Crown, 
  Zap, 
  BellRing, 
  FileSpreadsheet, 
  Check, 
  AlertTriangle 
} from "lucide-react";

interface ConsumerDashboardProps {
  session: any;
  onSignOut: () => void;
}

interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  notes?: string;
  created_at: string;
}

const MODEL_CASCADE = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest"
];

const formatCleanText = (raw: string): string => {
  return raw
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[\*\-]\s+/gm, "• ")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s?/g, "")
    .trim();
};

export default function ConsumerDashboard({ session, onSignOut }: ConsumerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"pantry" | "add" | "support">("pantry");
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Premium Modal State
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Add Item State
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("Daily Staples");
  const [itemQuantity, setItemQuantity] = useState("1 pack");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Modal & Engine State
  const [selectedItemForAi, setSelectedItemForAi] = useState<PantryItem | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

  useEffect(() => {
    if (session?.user?.id) {
      fetchPantryItems(session.user.id);
    }
  }, [session]);

  const fetchPantryItems = async (userId: string) => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("consumer_pantry")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data as PantryItem[]);
    }
    setLoadingItems(false);
  };

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemName.trim()) return;

    setIsSubmitting(true);
    const payload = {
      user_id: session.user.id,
      name: itemName.trim(),
      category: itemCategory,
      quantity: itemQuantity.trim() || "1 unit",
    };

    const { data, error } = await supabase
      .from("consumer_pantry")
      .insert([payload])
      .select();

    if (!error && data) {
      setItems(prev => [data[0] as PantryItem, ...prev]);
      setItemName("");
      setItemQuantity("1 pack");
      setActiveTab("pantry");
    } else {
      alert("Failed to save item. Make sure the database migration was run.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to remove this item from your pantry?")) return;
    const { error } = await supabase.from("consumer_pantry").delete().eq("id", id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedItemForAi?.id === id) setSelectedItemForAi(null);
    }
  };

  const askFoodAi = async (question: string) => {
    if (!selectedItemForAi) return;

    if (!apiKey) {
      setAiResponse("Missing API key. Add VITE_GEMINI_API_KEY in your .env file.");
      setAiLoading(false);
      return;
    }

    setAiLoading(true);
    setAiResponse("");

    const prompt = `You are a certified clinical nutritionist and food safety scientist.
Target Food: ${selectedItemForAi.name}
Category: ${selectedItemForAi.category}
User Question: ${question}

Instructions:
1. Provide a professional, direct, and factual technical analysis.
2. Highlight nutritional facts, health flags, preservatives, shelf-life, and practical advice.
3. Write clean, itemized bullet points. Avoid filler introductions and pleasantries. Finish all sentences completely.`;

    let requestSucceeded = false;
    let accumulatedText = "";
    let finalErrorMessage = "Server took too long to reply. Try again.";

    try {
      for (const model of MODEL_CASCADE) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
            {
              method: "POST",
              signal: controller.signal,
              headers: { 
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey.trim()
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {  
                  maxOutputTokens: 2048,
                  temperature: 0.2
                },
              }),
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            finalErrorMessage = errorData?.error?.message || `Error ${response.status}`;
            continue;
          }

          const reader = response.body?.getReader();
          if (!reader) continue;

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.replace("data: ", "").trim();
                if (dataStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(dataStr);
                  const candidateParts = parsed.candidates?.[0]?.content?.parts || [];
                  let textChunk = "";
                  for (const p of candidateParts) {
                    if (p.text && !p.thought) {
                      textChunk += p.text;
                    }
                  }

                  if (textChunk) {
                    accumulatedText += textChunk;
                    setAiResponse(formatCleanText(accumulatedText));
                    requestSucceeded = true;
                  }
                } catch {}
              }
            }
          }

          if (buffer.trim().startsWith("data: ")) {
            try {
              const dataStr = buffer.trim().replace("data: ", "").trim();
              if (dataStr !== "[DONE]") {
                const parsed = JSON.parse(dataStr);
                const candidateParts = parsed.candidates?.[0]?.content?.parts || [];
                let textChunk = "";
                for (const p of candidateParts) {
                  if (p.text && !p.thought) {
                    textChunk += p.text;
                  }
                }

                if (textChunk) {
                  accumulatedText += textChunk;
                  setAiResponse(formatCleanText(accumulatedText));
                  requestSucceeded = true;
                }
              }
            } catch {}
          }

          if (requestSucceeded) break;
        } catch (err: any) {
          clearTimeout(timeoutId);
          finalErrorMessage = err.name === "AbortError" 
            ? "Connection timed out. Check your network and retry."
            : (err.message || finalErrorMessage);
        }
      }
    } finally {
      setAiLoading(false);
      if (!requestSucceeded && accumulatedText === "") {
        setAiResponse(`Unable to get answer. ${finalErrorMessage}`);
      }
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => 
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const categoryStats = useMemo(() => {
    const stats: { [key: string]: number } = {};
    items.forEach(i => {
      stats[i.category] = (stats[i.category] || 0) + 1;
    });
    return stats;
  }, [items]);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Dairy & Milk":
        return { text: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)" };
      case "Snacks & Chips":
        return { text: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.3)" };
      case "Beverages":
        return { text: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.3)" };
      case "Fruits & Veggies":
        return { text: "#4ade80", bg: "rgba(74, 222, 128, 0.12)", border: "rgba(74, 222, 128, 0.3)" };
      default:
        return { text: "#818cf8", bg: "rgba(129, 140, 248, 0.12)", border: "rgba(129, 140, 248, 0.3)" };
    }
  };

  return (
    <div style={{
      width: "100%",
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#000000",
      padding: "1.25rem 1rem 3.5rem 1rem",
      color: "#ffffff",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <style>{`
        .btn-tap {
          transition: transform 0.1s ease, opacity 0.15s ease, background 0.15s ease;
        }
        .btn-tap:hover {
          opacity: 0.92;
        }
        .btn-tap:active {
          transform: scale(0.98);
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .stream-dot {
          animation: pulseDot 1s infinite ease-in-out;
        }

        /* Default layout: Mobile clean container */
        .dash-shell {
          width: 100%;
          max-width: 800px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .pantry-card-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.75rem;
        }
        .assistant-modal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0,0,0,0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 9999;
        }
        .assistant-modal-box {
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 22px 22px 0 0;
          padding: 1.35rem 1.35rem 2.2rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          overflow-y: auto;
        }

        /* Desktop Enhancement: Fully utilizes widescreen space */
        @media (min-width: 820px) {
          .dash-shell {
            max-width: 1120px !important;
            gap: 1.35rem !important;
          }
          .pantry-card-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.95rem !important;
          }
          @media (min-width: 1200px) {
            .pantry-card-grid {
              grid-template-columns: repeat(3, 1fr) !important;
            }
          }
          .assistant-modal-wrapper {
            align-items: center !important;
            padding: 1.5rem !important;
          }
          .assistant-modal-box {
            border-radius: 24px !important;
            max-height: 84vh !important;
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.95) !important;
          }
        }
      `}</style>

      <div className="dash-shell">
        
        {/* Header */}
        <header style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: "1rem 1.25rem", 
          background: "#09090b", 
          border: "1px solid rgba(255, 255, 255, 0.1)", 
          borderRadius: "18px"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>
                Consumer Hub
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#8b8b93", marginTop: "0.15rem" }}>
              {session?.user?.email}
            </p>
          </div>

          <button 
            onClick={onSignOut} 
            className="btn-tap"
            style={{ 
              background: "#000000", 
              color: "#ffffff", 
              border: "1px solid rgba(255, 255, 255, 0.2)", 
              padding: "0.45rem 0.85rem", 
              borderRadius: "12px", 
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center", 
              gap: "0.4rem", 
              fontSize: "0.8rem",
              fontWeight: 500
            }}
          >
            <LogOut size={14} /> Log out
          </button>
        </header>

        {/* Consumer Premium Banner */}
        <div 
          onClick={() => setShowPremiumModal(true)}
          className="btn-tap"
          style={{
            cursor: "pointer",
            background: "#0c0c0e",
            border: "1px solid rgba(229, 192, 123, 0.25)",
            borderRadius: "16px",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            boxShadow: "0 8px 24px -10px rgba(0, 0, 0, 0.85)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: 1 }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(229, 192, 123, 0.08)",
              border: "1px solid rgba(229, 192, 123, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <Crown size={17} color="#e5c07b" />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  whiteSpace: "nowrap"
                }}>
                  Pantry Premium
                </span>
                <span style={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  padding: "0.1rem 0.45rem",
                  borderRadius: "6px",
                  background: "rgba(229, 192, 123, 0.12)",
                  color: "#e5c07b",
                  border: "1px solid rgba(229, 192, 123, 0.25)",
                  whiteSpace: "nowrap"
                }}>
                  Trial
                </span>
              </div>
              <p style={{
                fontSize: "0.75rem",
                color: "#8b8b93",
                margin: "0.15rem 0 0 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                Nutritional alarms, AI recipe pairings & expiry risks
              </p>
            </div>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.2rem",
            color: "#e5c07b",
            fontSize: "0.78rem",
            fontWeight: 600,
            flexShrink: 0,
            whiteSpace: "nowrap"
          }}>
            Plans <ChevronRight size={14} />
          </div>
        </div>

        {/* Quick Numbers Bar */}
        <div className="stats-grid">
          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "16px", 
            padding: "0.85rem 1rem" 
          }}>
            <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Logged Items</span>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#ffffff" }}>
              {items.length}
            </p>
          </div>

          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "16px", 
            padding: "0.85rem 1rem" 
          }}>
            <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Categories</span>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#ffffff" }}>
              {Object.keys(categoryStats).length}
            </p>
          </div>

          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "16px", 
            padding: "0.85rem 1rem" 
          }}>
            <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>AI Analysis</span>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#ffffff" }}>
              Live
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          background: "#09090b", 
          border: "1px solid rgba(255, 255, 255, 0.1)", 
          padding: "4px", 
          borderRadius: "16px" 
        }}>
          {[
            { id: "pantry", label: `My Pantry (${items.length})`, icon: ShoppingBag },
            { id: "add", label: "Add Food", icon: PlusCircle },
            { id: "support", label: "Help Desk", icon: LifeBuoy }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="btn-tap"
                style={{
                  background: isSelected ? "#ffffff" : "transparent",
                  color: isSelected ? "#000000" : "#8b8b93",
                  border: "none",
                  borderRadius: "12px",
                  padding: "0.65rem 0.2rem",
                  fontSize: "0.82rem",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem"
                }}
              >
                <Icon size={14} color={isSelected ? "#000000" : "#8b8b93"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: MY PANTRY */}
        {activeTab === "pantry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ position: "relative" }}>
              <Search size={16} color="#71717a" style={{ position: "absolute", left: "14px", top: "14px" }} />
              <input 
                type="text" 
                placeholder="Search food items or categories..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "38px",
                  paddingRight: "14px",
                  background: "#09090b", 
                  border: "1px solid rgba(255, 255, 255, 0.12)", 
                  borderRadius: "14px", 
                  color: "#ffffff", 
                  fontSize: "0.86rem", 
                  outline: "none" 
                }}
              />
            </div>

            {loadingItems ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#8b8b93", fontSize: "0.85rem" }}>
                Loading your food items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ 
                background: "#09090b", 
                border: "1px solid rgba(255, 255, 255, 0.08)", 
                borderRadius: "18px", 
                textAlign: "center", 
                padding: "3.5rem 1.5rem" 
              }}>
                <ShoppingBag size={32} color="#71717a" style={{ margin: "0 auto 0.85rem" }} />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>Pantry is Empty</h3>
                <p style={{ fontSize: "0.82rem", color: "#8b8b93", maxWidth: "320px", margin: "0.4rem auto 1.25rem" }}>
                  Log items you brought home to run instant clinical nutrition and shelf safety reviews.
                </p>
                <button
                  onClick={() => setActiveTab("add")}
                  className="btn-tap"
                  style={{
                    background: "#ffffff",
                    color: "#000000",
                    border: "none",
                    borderRadius: "12px",
                    padding: "0.6rem 1.2rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                >
                  <PlusCircle size={15} /> Add First Food Item
                </button>
              </div>
            ) : (
              <div className="pantry-card-grid">
                {filteredItems.map(item => {
                  const catTheme = getCategoryColor(item.category);
                  return (
                    <div 
                      key={item.id} 
                      style={{ 
                        background: "#09090b", 
                        border: "1px solid rgba(255, 255, 255, 0.1)", 
                        borderRadius: "18px", 
                        padding: "1rem 1.15rem", 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "0.85rem" 
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                            <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                              {item.name}
                            </h4>
                            <span style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              padding: "0.15rem 0.5rem",
                              borderRadius: "999px",
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              color: "#ffffff"
                            }}>
                              {item.quantity}
                            </span>
                          </div>

                          <div style={{ marginTop: "0.4rem" }}>
                            <span style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "0.15rem 0.55rem",
                              borderRadius: "8px",
                              background: catTheme.bg,
                              border: `1px solid ${catTheme.border}`,
                              color: catTheme.text
                            }}>
                              {item.category}
                            </span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          title="Remove item"
                          className="btn-tap"
                          style={{ 
                            background: "transparent", 
                            border: "1px solid rgba(255, 255, 255, 0.12)", 
                            color: "#8b8b93", 
                            padding: "0.45rem", 
                            borderRadius: "10px", 
                            cursor: "pointer",
                            flexShrink: 0
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        paddingTop: "0.75rem", 
                        borderTop: "1px solid rgba(255, 255, 255, 0.06)", 
                        gap: "0.5rem" 
                      }}>
                        <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>
                          Food safety & health rating
                        </span>

                        <button
                          onClick={() => {
                            setSelectedItemForAi(item);
                            setAiResponse(null);
                          }}
                          className="btn-tap"
                          style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.16)",
                            color: "#ffffff",
                            padding: "0.45rem 0.85rem",
                            borderRadius: "10px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            cursor: "pointer"
                          }}
                        >
                          <Sparkles size={13} /> Ask AI
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADD TO PANTRY */}
        {activeTab === "add" && (
          <div style={{
            background: "#09090b",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "18px",
            padding: "1.35rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.15rem"
          }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>Add Food Item</h3>
              <p style={{ fontSize: "0.82rem", color: "#8b8b93", marginTop: "0.25rem" }}>
                Keep an ongoing log of home grocery items for nutrition analysis.
              </p>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#8b8b93", display: "block", marginBottom: "0.5rem" }}>
                Quick Presets:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                {[
                  { name: "Amul Gold Milk", cat: "Dairy & Milk", qty: "1 Litre" },
                  { name: "Whole Wheat Bread", cat: "Daily Staples", qty: "400g" },
                  { name: "Brown Eggs", cat: "Daily Staples", qty: "6 pack" },
                  { name: "Maggi 2-Minute Noodles", cat: "Snacks & Chips", qty: "4 pack" },
                  { name: "Lays Classic Salted", cat: "Snacks & Chips", qty: "1 packet" }
                ].map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setItemName(preset.name);
                      setItemCategory(preset.cat);
                      setItemQuantity(preset.qty);
                    }}
                    className="btn-tap"
                    style={{
                      background: "#000000",
                      border: "1px solid rgba(255, 255, 255, 0.14)",
                      color: "#ffffff",
                      fontSize: "0.78rem",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "10px",
                      cursor: "pointer"
                    }}
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddItem} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <input 
                type="text"
                placeholder="Product name (e.g. Greek Yogurt, Oats, Peanut Butter)"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  background: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  borderRadius: "12px",
                  color: "#ffffff",
                  padding: "0 0.95rem",
                  fontSize: "0.85rem",
                  outline: "none"
                }}
                required
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <select 
                  value={itemCategory}
                  onChange={e => setItemCategory(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    background: "#000000",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    borderRadius: "12px",
                    color: "#ffffff",
                    padding: "0 0.85rem",
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                >
                  <option value="Daily Staples">Daily Staples</option>
                  <option value="Dairy & Milk">Dairy & Milk</option>
                  <option value="Snacks & Chips">Snacks & Chips</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Sauces & Spreads">Sauces & Spreads</option>
                  <option value="Fruits & Veggies">Fruits & Veggies</option>
                </select>

                <input 
                  type="text"
                  placeholder="Quantity (e.g. 500g, 2 packs)"
                  value={itemQuantity}
                  onChange={e => setItemQuantity(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    background: "#000000",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    borderRadius: "12px",
                    color: "#ffffff",
                    padding: "0 0.95rem",
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="btn-tap"
                style={{
                  height: "46px",
                  background: "#ffffff",
                  color: "#000000",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  marginTop: "0.25rem"
                }}
              >
                {isSubmitting ? "Saving..." : "Save to My Pantry"}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: HELP & SUPPORT */}
        {activeTab === "support" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{
              background: "#09090b", 
              border: "1px solid rgba(255, 255, 255, 0.12)", 
              borderRadius: "20px", 
              padding: "1.5rem", 
              display: "flex", 
              flexDirection: "column", 
              gap: "1.1rem" 
            }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>Customer Concierge Desk</h3>
                <p style={{ fontSize: "0.82rem", color: "#8b8b93", marginTop: "0.2rem" }}>
                  Direct assistance for account synchronization, grocery inquiries, and app support.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
                <a 
                  href="tel:+919129958865"
                  className="btn-tap"
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    padding: "0.95rem 1.25rem", 
                    background: "#000000", 
                    border: "1px solid rgba(255, 255, 255, 0.12)", 
                    borderRadius: "14px" 
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
                    <div style={{ 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      background: "rgba(255, 255, 255, 0.08)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center" 
                    }}>
                      <Phone size={16} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#ffffff" }}>Direct Helpline</div>
                      <div style={{ fontSize: "0.76rem", color: "#8b8b93", marginTop: "0.1rem" }}>+91 91299 58865</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#71717a" />
                </a>

                <a 
                  href="https://wa.me/919129958865?text=Hello%20QuickPick%20Consumer%20Support"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-tap"
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    padding: "0.95rem 1.25rem", 
                    background: "#000000", 
                    border: "1px solid rgba(255, 255, 255, 0.12)", 
                    borderRadius: "14px" 
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
                    <div style={{ 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      background: "rgba(255, 255, 255, 0.08)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center" 
                    }}>
                      <MessageCircle size={16} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#ffffff" }}>WhatsApp Desk</div>
                      <div style={{ fontSize: "0.76rem", color: "#8b8b93", marginTop: "0.1rem" }}>Instant live chat support</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#71717a" />
                </a>

                <a 
                  href="mailto:anaadigeet75@gmail.com"
                  className="btn-tap"
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    padding: "0.95rem 1.25rem", 
                    background: "#000000", 
                    border: "1px solid rgba(255, 255, 255, 0.12)", 
                    borderRadius: "14px" 
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
                    <div style={{ 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      background: "rgba(255, 255, 255, 0.08)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center" 
                    }}>
                      <Mail size={16} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#ffffff" }}>Official Email</div>
                      <div style={{ fontSize: "0.76rem", color: "#8b8b93", marginTop: "0.1rem" }}>anaadigeet75@gmail.com</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#71717a" />
                </a>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Food Intelligence Assistant Modal (Matching Shopkeeper's Robust Engine) */}
      {selectedItemForAi && (
        <div className="assistant-modal-wrapper">
          <div className="assistant-modal-box">
            {/* Modal Header */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)", 
              paddingBottom: "0.85rem" 
            }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "#8b8b93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Clinical Food Analysis
                </span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginTop: "0.15rem" }}>
                  {selectedItemForAi.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedItemForAi(null)}
                className="btn-tap"
                style={{ 
                  background: "#000000", 
                  border: "1px solid rgba(255, 255, 255, 0.16)", 
                  color: "#ffffff", 
                  cursor: "pointer", 
                  width: "32px", 
                  height: "32px", 
                  borderRadius: "10px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Chips */}
            <div>
              <span style={{ fontSize: "0.75rem", color: "#8b8b93", display: "block", marginBottom: "0.5rem" }}>
                Select an inquiry:
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  {
                    title: "Health & safety check",
                    query: "Is this healthy and safe to eat regularly? Are there harmful preservatives or flags?",
                    icon: ShieldCheck
                  },
                  {
                    title: "Calories & macros",
                    query: "What are the typical calories, protein, carbs, and fats per serving?",
                    icon: Flame
                  },
                  {
                    title: "Storage & shelf life",
                    query: "How should I store this properly (pantry vs fridge) and what is its shelf life?",
                    icon: ThermometerSnowflake
                  },
                  {
                    title: "Healthy meal ideas",
                    query: "Give me 2 quick, healthy snacks or meal pairing ideas using this item.",
                    icon: ChefHat
                  }
                ].map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => askFoodAi(chip.query)}
                      className="btn-tap"
                      style={{
                        background: "#000000", 
                        border: "1px solid rgba(255, 255, 255, 0.16)", 
                        color: "#ffffff", 
                        borderRadius: "12px", 
                        padding: "0.75rem 0.85rem", 
                        fontSize: "0.78rem", 
                        fontWeight: 600, 
                        textAlign: "left", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "0.5rem", 
                        cursor: "pointer" 
                      }}
                    >
                      <ChipIcon size={14} color="#ffffff" /> {chip.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div style={{ display: "flex", gap: "0.55rem" }}>
              <input 
                type="text" 
                placeholder="Ask custom question about this item..." 
                value={customQuery}
                onChange={e => setCustomQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customQuery.trim()) {
                    askFoodAi(customQuery);
                    setCustomQuery("");
                  }
                }}
                style={{
                  flex: 1,
                  height: "44px",
                  background: "#000000", 
                  border: "1px solid rgba(255, 255, 255, 0.16)", 
                  borderRadius: "12px", 
                  padding: "0 1rem", 
                  color: "#ffffff", 
                  fontSize: "0.86rem", 
                  outline: "none" 
                }}
              />
              <button 
                onClick={() => {
                  if (customQuery.trim()) {
                    askFoodAi(customQuery);
                    setCustomQuery("");
                  }
                }}
                disabled={aiLoading || !customQuery.trim()}
                className="btn-tap"
                style={{
                  background: "#ffffff", 
                  color: "#000000", 
                  border: "none", 
                  borderRadius: "12px", 
                  padding: "0 1.15rem", 
                  cursor: (aiLoading || !customQuery.trim()) ? "not-allowed" : "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  opacity: (aiLoading || !customQuery.trim()) ? 0.3 : 1 
                }}
              >
                <Send size={15} />
              </button>
            </div>

            {/* Live Streaming Response Block */}
            {(aiResponse || aiLoading) && (
              <div 
                style={{
                  background: "#000000", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "14px", 
                  padding: "1.1rem", 
                  fontSize: "0.85rem", 
                  color: "#f4f4f5", 
                  lineHeight: 1.6, 
                  maxHeight: "340px", 
                  overflowY: "auto" 
                }}
              >
                {aiLoading && !aiResponse ? (
                  <div style={{ color: "#8b8b93", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className="stream-dot">•</span> Analyzing nutrition & food safety...
                  </div>
                ) : (
                  <div style={{ whiteSpace: "pre-line" }}>
                    {aiResponse}
                    {aiLoading && (
                      <span className="stream-dot" style={{ display: "inline-block", marginLeft: "4px" }}>•</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consumer Premium Modal */}
      {showPremiumModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.25rem",
          zIndex: 99999
        }}>
          <div style={{
            width: "100%",
            maxWidth: "460px",
            background: "#0c0c0e",
            border: "1px solid rgba(212, 175, 55, 0.35)",
            borderRadius: "22px",
            padding: "1.75rem",
            position: "relative",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.95)"
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowPremiumModal(false)}
              className="btn-tap"
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#8b8b93",
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={16} />
            </button>

            {/* Header Badge */}
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#18181c",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.1rem"
            }}>
              <Crown size={22} color="#e5c07b" />
            </div>

            <h3 style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "#f5e6c8",
              letterSpacing: "-0.02em",
              margin: 0
            }}>
              Pantry Premium
            </h3>
            
            <p style={{ fontSize: "0.84rem", color: "#8b8b93", marginTop: "0.35rem", marginBottom: "1.25rem", lineHeight: 1.45 }}>
              Smart household grocery intelligence with continuous food safety and recipe preservation alarms.
            </p>

            {/* Current Active Plan Status */}
            <div style={{
              background: "#000000",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "14px",
              padding: "0.85rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.35rem"
            }}>
              <div>
                <span style={{ fontSize: "0.7rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                  Active Household Plan
                </span>
                <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#ffffff" }}>
                  7-Day Free Trial
                </span>
              </div>
              <span style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#e5c07b",
                background: "rgba(229, 192, 123, 0.12)",
                padding: "0.25rem 0.65rem",
                borderRadius: "999px",
                border: "1px solid rgba(229, 192, 123, 0.3)"
              }}>
                5 days remaining
              </span>
            </div>

            {/* Features Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginBottom: "1.6rem" }}>
              {[
                { icon: Zap, label: "Unlimited optical barcode & pantry label scanning" },
                { icon: BellRing, label: "Expiry date alarms & post-unsealing preservation alerts" },
                { icon: Sparkles, label: "Deep clinical nutrition, allergen & harmful additive analysis" },
                { icon: FileSpreadsheet, label: "Automated weekly grocery lists & zero-waste meal recipes" },
                { icon: ShieldCheck, label: "Multi-device real-time household pantry synchronization" }
              ].map((f, i) => {
                const IconComponent = f.icon;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "7px",
                      background: "rgba(229, 192, 123, 0.1)",
                      border: "1px solid rgba(229, 192, 123, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <IconComponent size={12} color="#e5c07b" />
                    </div>
                    <span style={{ fontSize: "0.84rem", color: "#d4d4d8" }}>{f.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Plan Price Tag */}
            <div style={{
              textAlign: "center",
              marginBottom: "1.1rem"
            }}>
              <span style={{ fontSize: "1.55rem", fontWeight: 800, color: "#ffffff" }}>₹199</span>
              <span style={{ fontSize: "0.82rem", color: "#71717a" }}> / month after trial</span>
            </div>

            {/* Purchase Action Button */}
            <button
              onClick={() => {
                alert("Thank you for your interest. Premium household accounts are currently on free evaluation trials.");
                setShowPremiumModal(false);
              }}
              className="btn-tap"
              style={{
                width: "100%",
                height: "46px",
                borderRadius: "12px",
                border: "none",
                background: "#ffffff",
                color: "#000000",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.45rem"
              }}
            >
              <Crown size={16} color="#000000" /> Activate Pantry Premium
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
