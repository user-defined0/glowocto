import React, { useState, useEffect, useMemo } from "react";
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
  Loader2, 
  ChevronRight, 
  ShieldCheck, 
  Flame, 
  ThermometerSnowflake, 
  ChefHat, 
  MessageCircle, 
  Sparkle 
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

// 2026 Active Production API Models
const MODEL_CASCADE = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash"
];

export default function ConsumerDashboard({ session, onSignOut }: ConsumerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"pantry" | "add" | "support">("pantry");
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
    const { error } = await supabase.from("consumer_pantry").delete().eq("id", id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedItemForAi?.id === id) setSelectedItemForAi(null);
    }
  };

  const askFoodAi = async (question: string) => {
    if (!selectedItemForAi) return;

    if (!apiKey) {
      setAiResponse("Missing VITE_GEMINI_API_KEY in your .env file.");
      return;
    }

    setAiLoading(true);
    setAiResponse("");

    const prompt = `You are a certified food safety scientist and clinical nutritionist.

Target Item: ${selectedItemForAi.name}
Category: ${selectedItemForAi.category}
Inquiry: ${question}

MANDATORY RESPONSE GUIDELINES:
1. Address EXCLUSIVELY the specific query asked about this exact product. Do not veer into general healthy eating advice.
2. Structure the analysis to be professional, technical, and in-depth.
3. The response length MUST strictly exceed 10 structured lines of content (aim for 11 to 15 lines).
4. Strictly NO introductory conversational filler (no "Sure", "Hello", "Here is your breakdown", "As an AI").
5. Strictly NO concluding pleasantries, advice disclaimers, or sign-offs (no "Hope this helps", "Consult a doctor", "Stay healthy").
6. Provide raw, high-value, itemized technical bullet points directly addressing the query.`;

    let requestSucceeded = false;
    let accumulatedText = "";
    let finalErrorMessage = "All available AI models are currently busy. Please retry in a few seconds.";

    for (const model of MODEL_CASCADE) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                maxOutputTokens: 800, 
                temperature: 0.1,
                thinkingConfig: {
                  thinkingBudget: 0
                }
              },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const rawMsg = errorData?.error?.message || `HTTP ${response.status}`;
          
          if (
            response.status === 503 || 
            response.status === 429 || 
            response.status === 404 ||
            rawMsg.toLowerCase().includes("demand") ||
            rawMsg.toLowerCase().includes("resource") ||
            rawMsg.toLowerCase().includes("quota") ||
            rawMsg.toLowerCase().includes("not found") ||
            rawMsg.toLowerCase().includes("no longer available")
          ) {
            finalErrorMessage = rawMsg;
            continue;
          }
          throw new Error(rawMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) continue;

        setAiLoading(false);
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
                const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) {
                  accumulatedText += textChunk;
                  setAiResponse(accumulatedText);
                  requestSucceeded = true;
                }
              } catch {}
            }
          }
        }

        if (requestSucceeded) break;
      } catch (err: any) {
        finalErrorMessage = err.message || finalErrorMessage;
      }
    }

    setAiLoading(false);
    if (!requestSucceeded) {
      setAiResponse(`Stream Connection Failed: ${finalErrorMessage}`);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter(i => 
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

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
      padding: "1.25rem 1rem 3rem 1rem",
      color: "#ffffff"
    }}>
      <div style={{ width: "100%", maxWidth: "680px", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        
        {/* Header */}
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 1.25rem",
          background: "rgba(14, 14, 18, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "20px",
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.9), 0 0 25px -5px rgba(99, 102, 241, 0.18)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                background: "linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.03em"
              }}>
                Consumer Hub
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: "999px",
                background: "rgba(129, 140, 248, 0.15)",
                color: "#c7d2fe",
                border: "1px solid rgba(129, 140, 248, 0.35)",
                boxShadow: "0 0 10px rgba(129, 140, 248, 0.25)"
              }}>
                <Sparkle size={10} fill="#818cf8" color="#818cf8" /> Live Stream
              </span>
            </div>
            <p style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: "0.2rem" }}>
              {session.user.email}
            </p>
          </div>

          <button
            onClick={onSignOut}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              color: "#f87171",
              border: "1px solid rgba(248, 113, 113, 0.25)",
              padding: "0.5rem 0.9rem",
              borderRadius: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              transition: "all 0.2s ease"
            }}
          >
            <LogOut size={14} /> Exit
          </button>
        </header>

        {/* Tab Controls */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          background: "rgba(12, 12, 16, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          padding: "5px",
          borderRadius: "18px",
          boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)"
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
                style={{
                  background: isSelected 
                    ? "linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.3) 100%)" 
                    : "transparent",
                  color: isSelected ? "#ffffff" : "#94a3b8",
                  border: isSelected ? "1px solid rgba(165, 180, 252, 0.45)" : "1px solid transparent",
                  borderRadius: "13px",
                  padding: "0.65rem 0.2rem",
                  fontSize: "0.84rem",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  boxShadow: isSelected ? "0 4px 18px -2px rgba(99, 102, 241, 0.45)" : "none",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              >
                <Icon size={15} color={isSelected ? "#c7d2fe" : "#64748b"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: MY PANTRY */}
        {activeTab === "pantry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ position: "relative" }}>
              <Search size={16} color="#6366f1" style={{ position: "absolute", left: "14px", top: "14px" }} />
              <input 
                type="text"
                placeholder="Search logged food items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "40px",
                  paddingRight: "14px",
                  background: "rgba(14, 14, 18, 0.95)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  borderRadius: "16px",
                  color: "#ffffff",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.6)"
                }}
              />
            </div>

            {loadingItems ? (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <Loader2 className="animate-spin" size={26} style={{ margin: "0 auto", color: "#818cf8" }} />
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "3.5rem 1.5rem",
                background: "rgba(14, 14, 18, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "22px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)"
              }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  background: "radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)",
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  borderRadius: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 0 25px rgba(99, 102, 241, 0.3)"
                }}>
                  <ShoppingBag size={24} color="#a5b4fc" />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Pantry is Empty</h3>
                <p style={{ fontSize: "0.84rem", color: "#94a3b8", marginTop: "0.35rem", marginBottom: "1.5rem", maxWidth: "340px", marginInline: "auto" }}>
                  Log grocery items you purchased to run instant professional AI analysis on ingredients, macros, and storage rules.
                </p>
                <button 
                  onClick={() => setActiveTab("add")}
                  style={{
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "14px",
                    padding: "0.7rem 1.5rem",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "0 6px 20px -2px rgba(99, 102, 241, 0.5)"
                  }}
                >
                  <PlusCircle size={16} /> Add First Item
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {filteredItems.map(item => {
                  const catTheme = getCategoryColor(item.category);
                  return (
                    <div 
                      key={item.id} 
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1.1rem 1.25rem",
                        background: "rgba(14, 14, 18, 0.95)",
                        border: "1px solid rgba(255, 255, 255, 0.07)",
                        borderRadius: "20px",
                        boxShadow: "0 8px 25px -8px rgba(0, 0, 0, 0.6)",
                        gap: "0.75rem",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#ffffff", letterSpacing: "-0.01em" }}>
                            {item.name}
                          </span>
                          <span style={{ 
                            fontSize: "0.74rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "999px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#cbd5e1"
                          }}>
                            {item.quantity}
                          </span>
                        </div>
                        <div style={{ marginTop: "0.35rem" }}>
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

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <button
                          onClick={() => {
                            setSelectedItemForAi(item);
                            setAiResponse(null);
                          }}
                          style={{
                            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.3) 100%)",
                            border: "1px solid rgba(165, 180, 252, 0.4)",
                            color: "#ffffff",
                            padding: "0.5rem 0.95rem",
                            borderRadius: "14px",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            cursor: "pointer",
                            boxShadow: "0 0 16px -2px rgba(99, 102, 241, 0.4)",
                            transition: "all 0.2s ease"
                          }}
                        >
                          <Sparkles size={14} color="#c7d2fe" /> Ask AI
                        </button>

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          style={{
                            background: "rgba(255, 255, 255, 0.04)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            color: "#94a3b8",
                            padding: "0.55rem",
                            borderRadius: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title="Delete item"
                        >
                          <Trash2 size={15} />
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
            background: "rgba(14, 14, 18, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "22px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)"
          }}>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Add Food to Pantry</h3>
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                Keep an ongoing log of items you brought home for instant AI nutritional reviews.
              </p>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Instant Food Presets:
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
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#e2e8f0",
                      fontSize: "0.78rem",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: "0.35rem" }}>
                  Product Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Greek Yogurt, Basmati Rice, Peanut Butter"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  style={{
                    width: "100%",
                    height: "46px",
                    background: "#000000",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    borderRadius: "14px",
                    color: "#fff",
                    padding: "0 1rem",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: "0.35rem" }}>
                    Category
                  </label>
                  <select 
                    value={itemCategory}
                    onChange={e => setItemCategory(e.target.value)}
                    style={{
                      width: "100%",
                      height: "46px",
                      background: "#000000",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "14px",
                      color: "#fff",
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
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: "0.35rem" }}>
                    Quantity / Pack
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. 500g, 2 packets"
                    value={itemQuantity}
                    onChange={e => setItemQuantity(e.target.value)}
                    style={{
                      width: "100%",
                      height: "46px",
                      background: "#000000",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "14px",
                      color: "#fff",
                      padding: "0 1rem",
                      fontSize: "0.9rem",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                style={{
                  height: "48px",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "16px",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 6px 20px -3px rgba(99, 102, 241, 0.55)",
                  marginTop: "0.5rem"
                }}
              >
                {isSubmitting ? "Adding to Pantry..." : "Save to My Pantry"}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: HELP & SUPPORT DESK */}
        {activeTab === "support" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{
              background: "rgba(14, 14, 18, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "22px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)"
            }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Customer Concierge Desk</h3>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  Direct assistance for account synchronization, grocery inquiries, and app support.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.65rem" }}>
                <a 
                  href="tel:+919129958865"
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "0.9rem 1.15rem", 
                    background: "rgba(255, 255, 255, 0.03)", 
                    border: "1px solid rgba(255, 255, 255, 0.07)", 
                    borderRadius: "16px" 
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Phone size={17} color="#34d399" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff" }}>Direct Helpline</div>
                      <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>+91 91299 58865</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#64748b" />
                </a>

                <a 
                  href="https://wa.me/919129958865?text=Hello%20QuickPick%20Support"
                  target="_blank"
                  rel="noreferrer"
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "0.9rem 1.15rem", 
                    background: "rgba(255, 255, 255, 0.03)", 
                    border: "1px solid rgba(255, 255, 255, 0.07)", 
                    borderRadius: "16px" 
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MessageCircle size={17} color="#4ade80" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff" }}>WhatsApp Desk</div>
                      <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>Instant live chat support</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#64748b" />
                </a>

                <a 
                  href="mailto:anaadigeet75@gmail.com"
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "0.9rem 1.15rem", 
                    background: "rgba(255, 255, 255, 0.03)", 
                    border: "1px solid rgba(255, 255, 255, 0.07)", 
                    borderRadius: "16px" 
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Mail size={17} color="#818cf8" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff" }}>Official Email</div>
                      <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>anaadigeet75@gmail.com</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#64748b" />
                </a>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* AI Modal with SSE Output */}
      {selectedItemForAi && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.88)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            width: "100%",
            maxWidth: "540px",
            maxHeight: "88vh",
            background: "#09090e",
            border: "1px solid rgba(99, 102, 241, 0.35)",
            boxShadow: "0 -10px 40px rgba(99, 102, 241, 0.25)",
            borderRadius: "26px 26px 0 0",
            padding: "1.25rem 1.25rem 2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            overflowY: "auto"
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.7rem", color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Product Intelligence Analysis
                </span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                  {selectedItemForAi.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedItemForAi(null)}
                style={{ background: "rgba(255, 255, 255, 0.06)", border: "none", color: "#94a3b8", cursor: "pointer", width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Preset Chips */}
            <div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: "0.45rem", fontWeight: 600 }}>
                Select a Question:
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
                {[
                  {
                    title: "Health & Safety Check",
                    query: "Is this healthy and safe to eat regularly? What are the key health warnings or processed red flags?",
                    icon: ShieldCheck,
                    color: "#34d399",
                    bg: "rgba(16, 185, 129, 0.12)",
                    border: "rgba(16, 185, 129, 0.25)"
                  },
                  {
                    title: "Calorie & Macro Info",
                    query: "How many calories, fats, carbs, and proteins does this typically contain per standard serving?",
                    icon: Flame,
                    color: "#fbbf24",
                    bg: "rgba(251, 191, 36, 0.12)",
                    border: "rgba(251, 191, 36, 0.25)"
                  },
                  {
                    title: "Shelf Life & Storage",
                    query: "How should I store this properly (pantry vs fridge) and what is its typical shelf life after opening?",
                    icon: ThermometerSnowflake,
                    color: "#38bdf8",
                    bg: "rgba(56, 189, 248, 0.12)",
                    border: "rgba(56, 189, 248, 0.25)"
                  },
                  {
                    title: "Quick Meal Ideas",
                    query: "Give me 2 quick, healthy everyday snacks or recipe ideas using this item.",
                    icon: ChefHat,
                    color: "#c084fc",
                    bg: "rgba(192, 132, 252, 0.12)",
                    border: "rgba(192, 132, 252, 0.25)"
                  }
                ].map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => askFoodAi(chip.query)}
                      style={{
                        background: chip.bg,
                        border: `1px solid ${chip.border}`,
                        color: "#fff",
                        borderRadius: "14px",
                        padding: "0.6rem 0.75rem",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        cursor: "pointer"
                      }}
                    >
                      <ChipIcon size={15} color={chip.color} /> {chip.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Query Bar */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input 
                type="text"
                placeholder="Or type custom question..."
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
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "14px",
                  padding: "0 1rem",
                  color: "#fff",
                  fontSize: "0.85rem",
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
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "14px",
                  padding: "0 1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Send size={15} />
              </button>
            </div>

            {/* Live Streaming Response Block */}
            {aiLoading && (
              <div style={{ padding: "1.75rem", textAlign: "center", color: "#a5b4fc", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <Loader2 className="animate-spin" size={17} /> Analyzing...
              </div>
            )}

            {aiResponse && (
              <div style={{
                background: "rgba(14, 14, 20, 0.95)",
                border: "1px solid rgba(165, 180, 252, 0.25)",
                borderRadius: "16px",
                padding: "1.1rem",
                fontSize: "0.85rem",
                color: "#f1f5f9",
                lineHeight: 1.6,
                maxHeight: "320px",
                overflowY: "auto"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.6rem", color: "#34d399", fontWeight: 700, fontSize: "0.8rem" }}>
                  <Sparkles size={14} /> Technical Analysis:
                </div>
                <div style={{ whiteSpace: "pre-line", letterSpacing: "0.01em" }}>
                  {aiResponse}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
