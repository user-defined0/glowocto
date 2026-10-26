import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { 
  Package, 
  ScanLine, 
  TrendingUp, 
  Phone, 
  Mail, 
  LogOut, 
  Plus, 
  Download, 
  Search, 
  Edit2, 
  Trash2, 
  Share2, 
  Calendar, 
  Camera, 
  Check, 
  X, 
  AlertTriangle, 
  Sparkles, 
  ChevronRight, 
  MessageCircle, 
  Send, 
  Boxes, 
  Percent, 
  Clock, 
  Tag, 
  BarChart3, 
  PieChart, 
  Crown, 
  Zap, 
  ShieldCheck, 
  BellRing, 
  FileSpreadsheet, 
  DollarSign, 
  Layers, 
  ShoppingBag 
} from "lucide-react";

export interface InventoryItem {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  stock: number;
  min_threshold: number;
  expiry_date?: string;
}

export interface SaleRecord {
  id: string;
  item_name: string;
  quantity: number;
  total_price: number;
  created_at: string;
}

interface ShopkeeperDashboardProps {
  session: any;
  onSignOut: () => void;
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

export default function ShopkeeperDashboard({ session, onSignOut }: ShopkeeperDashboardProps) {
  const [activeTab, setActiveTab] = useState<"inventory" | "scanner" | "analytics" | "support">("inventory");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Premium Modal State
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Edit State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editThreshold, setEditThreshold] = useState("");

  // Add Item State
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [newItemThreshold, setNewItemThreshold] = useState("5");
  const [newItemExpiry, setNewItemExpiry] = useState("");
  const [newItemBarcode, setNewItemBarcode] = useState("");

  // Scanner State
  const [scanBarcode, setScanBarcode] = useState("");
  const [isScanningApi, setIsScanningApi] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Assistant State
  const [selectedItemForAi, setSelectedItemForAi] = useState<InventoryItem | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

  useEffect(() => {
    if (session?.user?.id) {
      fetchInventory(session.user.id);
      fetchSales(session.user.id);
    }
  }, [session]);

  const fetchInventory = async (userId: string) => {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("shopkeeper_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) setInventory(data as InventoryItem[]);
  };

  const fetchSales = async (userId: string) => {
    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("shopkeeper_id", userId)
      .order("created_at", { ascending: false })
      .limit(150);
    if (data) setSales(data as SaleRecord[]);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice || !newItemStock) {
      alert("Please fill in the product name, price, and stock quantity.");
      return;
    }

    setIsSubmittingItem(true);
    const payload = {
      shopkeeper_id: session.user.id,
      name: newItemName.trim(),
      barcode: newItemBarcode.trim() || null,
      price: parseFloat(newItemPrice) || 0,
      stock: parseInt(newItemStock, 10) || 0,
      min_threshold: parseInt(newItemThreshold, 10) || 5,
      expiry_date: newItemExpiry || null,
    };

    const { data, error } = await supabase.from("inventory").insert([payload]).select();

    if (error) {
      alert(`Could not save item: ${error.message}`);
    } else if (data && data.length > 0) {
      setInventory(prev => [data[0] as InventoryItem, ...prev]);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemStock("");
      setNewItemThreshold("5");
      setNewItemExpiry("");
      setNewItemBarcode("");
      setShowAddForm(false);
    }
    setIsSubmittingItem(false);
  };

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditStock(item.stock.toString());
    setEditPrice(item.price.toString());
    setEditThreshold(item.min_threshold.toString());
  };

  const handleSaveEdit = async (id: string) => {
    const updated = {
      name: editName.trim(),
      stock: parseInt(editStock, 10) || 0,
      price: parseFloat(editPrice) || 0,
      min_threshold: parseInt(editThreshold, 10) || 5,
    };

    const { error } = await supabase.from("inventory").update(updated).eq("id", id);
    if (!error) {
      setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      setEditingItemId(null);
    } else {
      alert(`Update failed: ${error.message}`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (!error) {
      setInventory(prev => prev.filter(i => i.id !== id));
      if (selectedItemForAi?.id === id) setSelectedItemForAi(null);
    }
  };

  const handleQuickSale = async (item: InventoryItem) => {
    if (item.stock <= 0) return;
    const newStock = item.stock - 1;

    const { error } = await supabase.from("inventory").update({ stock: newStock }).eq("id", item.id);
    if (!error) {
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock: newStock } : i));
      const saleRow = {
        shopkeeper_id: session.user.id,
        item_id: item.id,
        item_name: item.name,
        quantity: 1,
        total_price: item.price,
      };
      const { data } = await supabase.from("sales").insert([saleRow]).select();
      if (data) setSales(prev => [data[0] as SaleRecord, ...prev]);
    }
  };

  const lookupBarcode = async (code: string) => {
    if (!code.trim()) return;
    setIsScanningApi(true);
    setScannerFeedback(null);

    try {
      const response = await fetch(`https://in.openfoodfacts.org/api/v0/product/${code.trim()}.json`);
      const data = await response.json();

      if (data && data.status === 1 && data.product) {
        const foundName = data.product.product_name || data.product.generic_name || "Grocery Item";
        setNewItemName(foundName);
        setNewItemBarcode(code.trim());
        setScannerFeedback(`Found: ${foundName}. Check price and quantity below.`);
        setShowAddForm(true);
        setActiveTab("inventory");
      } else {
        setScannerFeedback("Barcode not recognized. Add details manually.");
        setNewItemBarcode(code.trim());
        setShowAddForm(true);
        setActiveTab("inventory");
      }
    } catch {
      setScannerFeedback("Network error. Please enter details manually.");
      setNewItemBarcode(code.trim());
      setShowAddForm(true);
      setActiveTab("inventory");
    } finally {
      setIsScanningApi(false);
      stopCamera();
    }
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
          });

          const interval = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  clearInterval(interval);
                  lookupBarcode(barcodes[0].rawValue);
                }
              } catch {}
            }
          }, 400);
        }
      }
    } catch {
      setScannerFeedback("Camera access was denied. Enter code manually.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const exportInventoryCSV = () => {
    const headers = "Name,Barcode,Price,Stock,AlertThreshold,ExpiryDate\n";
    const rows = inventory.map(i => 
      `"${i.name}","${i.barcode || ""}","${i.price}","${i.stock}","${i.min_threshold}","${i.expiry_date || ""}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const shareWhatsAppReceipt = (item: InventoryItem) => {
    const message = encodeURIComponent(
      `*Receipt*\nItem: ${item.name}\nQuantity: 1\nTotal: ₹${item.price.toFixed(2)}\nThank you for shopping with us!`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const askAssistant = async (question: string) => {
    if (!selectedItemForAi) return;

    if (!apiKey) {
      setAiResponse("Missing API key. Add VITE_GEMINI_API_KEY in your .env file.");
      setAiLoading(false);
      return;
    }

    setAiLoading(true);
    setAiResponse("");

    const prompt = `Reply friendly and keep it short + ${selectedItemForAi.name} + ${question}. Make sure to finish your sentences and thoughts completely.`;

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
                  temperature: 0.7
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
            ? "Connection timed out. Check your connection and retry."
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

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const q = searchQuery.toLowerCase();
    return inventory.filter(i => 
      i.name.toLowerCase().includes(q) || (i.barcode && i.barcode.includes(q))
    );
  }, [inventory, searchQuery]);

  const lowStockCount = inventory.filter(i => i.stock <= i.min_threshold && i.stock > 0).length;
  const outOfStockCount = inventory.filter(i => i.stock === 0).length;
  const healthyStockCount = inventory.filter(i => i.stock > i.min_threshold).length;
  const criticalItems = inventory.filter(i => i.stock <= i.min_threshold);
  const totalValuation = inventory.reduce((acc, curr) => acc + (curr.price * curr.stock), 0);

  const totalSalesRevenue = useMemo(() => {
    return sales.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
  }, [sales]);

  const totalUnitsSold = useMemo(() => {
    return sales.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
  }, [sales]);

  const averageOrderValue = useMemo(() => {
    return sales.length > 0 ? (totalSalesRevenue / sales.length) : 0;
  }, [sales, totalSalesRevenue]);
  
  const chartData = useMemo(() => {
    const days: { [key: string]: { earnings: number; units: number } } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = { earnings: 0, units: 0 };
    }

    sales.forEach(sale => {
      const day = sale.created_at?.split("T")[0];
      if (days[day]) {
        days[day].earnings += Number(sale.total_price);
        days[day].units += Number(sale.quantity);
      }
    });

    return Object.entries(days).map(([date, val]) => ({
      date: date.slice(5),
      ...val
    }));
  }, [sales]);

  const maxEarning = Math.max(...chartData.map(d => d.earnings), 500);

  const topSellingItems = useMemo(() => {
    const map: { [name: string]: { units: number; revenue: number } } = {};
    sales.forEach(s => {
      if (!map[s.item_name]) {
        map[s.item_name] = { units: 0, revenue: 0 };
      }
      map[s.item_name].units += Number(s.quantity);
      map[s.item_name].revenue += Number(s.total_price);
    });
    return Object.entries(map)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  const maxItemRevenue = Math.max(...topSellingItems.map(i => i.revenue), 100);

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

        /* Default layout: mobile (remains 100% as you have it) */
        .dash-shell {
          width: 100%;
          max-width: 800px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .inventory-card-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .analytics-desktop-split {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .assistant-modal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0,0,0,0.85);
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

        /* Desktop Enhancement: only applies when viewport is >= 820px */
        @media (min-width: 820px) {
          .dash-shell {
            max-width: 1060px !important;
            gap: 1.35rem !important;
          }
          .inventory-card-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.85rem !important;
          }
          .analytics-desktop-split {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 1.15rem !important;
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
                Store Dashboard
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

        {/* Premium Banner: Clean, Single-Line, Mobile-Optimized */}
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
                  Store Premium
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
                Barcode scanning, alerts & reports
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

        {/* Low Stock Notice */}
        {criticalItems.length > 0 && (
          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.3)", 
            borderRadius: "16px", 
            padding: "0.85rem 1.15rem", 
            display: "flex", 
            alignItems: "center", 
            gap: "0.75rem", 
            color: "#ffffff" 
          }}>
            <AlertTriangle size={17} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: "0.82rem", lineHeight: 1.4, flex: 1 }}>
              <strong>Low stock warning:</strong> {criticalItems.length} item(s) need restocking ({criticalItems.map(i => i.name).slice(0, 3).join(", ")}).
            </div>
          </div>
        )}

        {/* Quick Numbers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "16px", 
            padding: "0.85rem 1rem" 
          }}>
            <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Total Products</span>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#ffffff" }}>
              {inventory.length}
            </p>
          </div>

          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "16px", 
            padding: "0.85rem 1rem" 
          }}>
            <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Inventory Value</span>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#ffffff" }}>
              ₹{totalValuation.toLocaleString("en-IN")}
            </p>
          </div>

          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "16px", 
            padding: "0.85rem 1rem" 
          }}>
            <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Low / Empty</span>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#ffffff" }}>
              {lowStockCount + outOfStockCount}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          background: "#09090b", 
          border: "1px solid rgba(255, 255, 255, 0.1)", 
          padding: "4px", 
          borderRadius: "16px" 
        }}>
          {[
            { id: "inventory", label: "Inventory", icon: Package },
            { id: "scanner", label: "Scanner", icon: ScanLine },
            { id: "analytics", label: "Reports", icon: TrendingUp },
            { id: "support", label: "Support", icon: Phone }
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

        {/* TAB 1: INVENTORY MANAGEMENT */}
        {activeTab === "inventory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ display: "flex", gap: "0.55rem" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} color="#71717a" style={{ position: "absolute", left: "14px", top: "14px" }} />
                <input 
                  type="text" 
                  placeholder="Search products by name or barcode..." 
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
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn-tap"
                style={{ 
                  background: "#ffffff", 
                  color: "#000000", 
                  border: "none", 
                  padding: "0 1.15rem", 
                  borderRadius: "14px", 
                  fontSize: "0.84rem", 
                  fontWeight: 700, 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "0.4rem", 
                  cursor: "pointer", 
                  whiteSpace: "nowrap" 
                }}
              >
                <Plus size={15} /> {showAddForm ? "Cancel" : "Add item"}
              </button>
              <button 
                onClick={exportInventoryCSV}
                title="Download CSV"
                className="btn-tap"
                style={{ 
                  background: "#09090b", 
                  border: "1px solid rgba(255, 255, 255, 0.12)", 
                  color: "#ffffff", 
                  padding: "0 0.95rem", 
                  borderRadius: "14px", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}
              >
                <Download size={15} />
              </button>
            </div>

            {/* Add Item Form */}
            {showAddForm && (
              <form 
                onSubmit={handleAddItem} 
                style={{ 
                  background: "#09090b", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "18px", 
                  padding: "1.25rem", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.85rem" 
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ffffff" }}>New product details</span>
                  <button type="button" onClick={() => setShowAddForm(false)} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer" }}>
                    <X size={16} />
                  </button>
                </div>
                
                <input 
                  type="text" 
                  placeholder="Product name (e.g. Parle-G 100g)" 
                  value={newItemName} 
                  onChange={e => setNewItemName(e.target.value)} 
                  style={{
                    width: "100%",
                    height: "44px",
                    background: "#000000", 
                    border: "1px solid rgba(255, 255, 255, 0.12)", 
                    borderRadius: "12px", 
                    color: "#ffffff", 
                    padding: "0 0.95rem", 
                    fontSize: "0.85rem", 
                    outline: "none" 
                  }}
                  required 
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="Price (₹)" 
                    value={newItemPrice} 
                    onChange={e => setNewItemPrice(e.target.value)} 
                    style={{
                      width: "100%",
                      height: "44px",
                      background: "#000000", 
                      border: "1px solid rgba(255, 255, 255, 0.12)", 
                      borderRadius: "12px", 
                      color: "#ffffff", 
                      padding: "0 0.95rem", 
                      fontSize: "0.85rem", 
                      outline: "none" 
                    }}
                    required 
                  />
                  <input 
                    type="number" 
                    placeholder="Initial stock quantity" 
                    value={newItemStock} 
                    onChange={e => setNewItemStock(e.target.value)} 
                    style={{
                      width: "100%",
                      height: "44px",
                      background: "#000000", 
                      border: "1px solid rgba(255, 255, 255, 0.12)", 
                      borderRadius: "12px", 
                      color: "#ffffff", 
                      padding: "0 0.95rem", 
                      fontSize: "0.85rem", 
                      outline: "none" 
                    }}
                    required 
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.74rem", color: "#8b8b93", display: "block", marginBottom: "0.3rem" }}>Low stock threshold</label>
                    <input 
                      type="number" 
                      placeholder="Default 5" 
                      value={newItemThreshold} 
                      onChange={e => setNewItemThreshold(e.target.value)} 
                      style={{
                        width: "100%",
                        height: "44px",
                        background: "#000000", 
                        border: "1px solid rgba(255, 255, 255, 0.12)", 
                        borderRadius: "12px", 
                        color: "#ffffff", 
                        padding: "0 0.95rem", 
                        fontSize: "0.85rem", 
                        outline: "none" 
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.74rem", color: "#8b8b93", display: "block", marginBottom: "0.3rem" }}>Expiry date (optional)</label>
                    <input 
                      type="date" 
                      value={newItemExpiry} 
                      onChange={e => setNewItemExpiry(e.target.value)} 
                      style={{
                        width: "100%",
                        height: "44px",
                        background: "#000000", 
                        border: "1px solid rgba(255, 255, 255, 0.12)", 
                        borderRadius: "12px", 
                        color: "#ffffff", 
                        padding: "0 0.95rem", 
                        fontSize: "0.85rem", 
                        outline: "none" 
                      }}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingItem} 
                  className="btn-tap"
                  style={{
                    height: "46px",
                    background: "#ffffff", 
                    color: "#000000", 
                    border: "none", 
                    borderRadius: "12px", 
                    fontSize: "0.88rem", 
                    fontWeight: 700, 
                    cursor: "pointer", 
                    marginTop: "0.25rem" 
                  }}
                >
                  {isSubmittingItem ? "Saving..." : "Add to inventory"}
                </button>
              </form>
            )}

            {/* Inventory List (Responsive: Single Column on Mobile, 2 Columns on Desktop) */}
            {filteredInventory.length === 0 ? (
              <div style={{ 
                background: "#09090b", 
                border: "1px solid rgba(255, 255, 255, 0.08)", 
                borderRadius: "18px", 
                textAlign: "center", 
                padding: "3.5rem 1.5rem" 
              }}>
                <Package size={32} color="#71717a" style={{ margin: "0 auto 0.85rem" }} />
                <p style={{ fontSize: "0.88rem", color: "#8b8b93", maxWidth: "320px", margin: "0 auto" }}>
                  No items found. Tap "Add item" or scan a barcode to stock your store.
                </p>
              </div>
            ) : (
              <div className="inventory-card-grid">
                {filteredInventory.map(item => {
                  const isOutOfStock = item.stock === 0;
                  const isLow = item.stock <= item.min_threshold && !isOutOfStock;
                  const isEditing = editingItemId === item.id;

                  if (isEditing) {
                    return (
                      <div 
                        key={item.id} 
                        style={{ 
                          background: "#09090b", 
                          border: "1px solid rgba(255, 255, 255, 0.35)", 
                          borderRadius: "16px", 
                          padding: "1.1rem", 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "0.75rem" 
                        }}
                      >
                        <span style={{ fontSize: "0.78rem", color: "#8b8b93", fontWeight: 600 }}>Edit product</span>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)} 
                          style={{
                            height: "40px",
                            background: "#000000", 
                            border: "1px solid rgba(255, 255, 255, 0.15)", 
                            borderRadius: "10px", 
                            color: "#ffffff", 
                            padding: "0 0.8rem", 
                            fontSize: "0.85rem", 
                            outline: "none" 
                          }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.55rem" }}>
                          <input 
                            type="number" 
                            placeholder="Price" 
                            value={editPrice} 
                            onChange={e => setEditPrice(e.target.value)} 
                            style={{
                              height: "40px",
                              background: "#000000", 
                              border: "1px solid rgba(255, 255, 255, 0.15)", 
                              borderRadius: "10px", 
                              color: "#ffffff", 
                              padding: "0 0.8rem", 
                              fontSize: "0.85rem", 
                              outline: "none" 
                            }}
                          />
                          <input 
                            type="number" 
                            placeholder="Stock" 
                            value={editStock} 
                            onChange={e => setEditStock(e.target.value)} 
                            style={{
                              height: "40px",
                              background: "#000000", 
                              border: "1px solid rgba(255, 255, 255, 0.15)", 
                              borderRadius: "10px", 
                              color: "#ffffff", 
                              padding: "0 0.8rem", 
                              fontSize: "0.85rem", 
                              outline: "none" 
                            }}
                          />
                          <input 
                            type="number" 
                            placeholder="Min alert" 
                            value={editThreshold} 
                            onChange={e => setEditThreshold(e.target.value)} 
                            style={{
                              height: "40px",
                              background: "#000000", 
                              border: "1px solid rgba(255, 255, 255, 0.15)", 
                              borderRadius: "10px", 
                              color: "#ffffff", 
                              padding: "0 0.8rem", 
                              fontSize: "0.85rem", 
                              outline: "none" 
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                          <button 
                            onClick={() => handleSaveEdit(item.id)} 
                            className="btn-tap"
                            style={{ 
                              flex: 1, 
                              background: "#ffffff", 
                              color: "#000000", 
                              border: "none", 
                              padding: "0.55rem", 
                              borderRadius: "10px", 
                              fontWeight: 700, 
                              fontSize: "0.82rem", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center", 
                              gap: "0.35rem", 
                              cursor: "pointer" 
                            }}
                          >
                            <Check size={14} /> Save
                          </button>
                          <button 
                            onClick={() => setEditingItemId(null)} 
                            className="btn-tap"
                            style={{ 
                              background: "#000000", 
                              color: "#ffffff", 
                              border: "1px solid rgba(255, 255, 255, 0.2)", 
                              padding: "0.55rem 0.95rem", 
                              borderRadius: "10px", 
                              fontSize: "0.82rem", 
                              cursor: "pointer" 
                            }}
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

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
                      {/* Top Row: Info & Stock Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                            <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                              {item.name}
                            </h4>
                            {isOutOfStock ? (
                              <span style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                padding: "0.15rem 0.5rem",
                                borderRadius: "999px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                color: "#f87171"
                              }}>
                                Out of stock
                              </span>
                            ) : isLow ? (
                              <span style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                padding: "0.15rem 0.5rem",
                                borderRadius: "999px",
                                background: "rgba(245, 158, 11, 0.15)",
                                border: "1px solid rgba(245, 158, 11, 0.4)",
                                color: "#fbbf24"
                              }}>
                                Low ({item.stock} left)
                              </span>
                            ) : (
                              <span style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                padding: "0.15rem 0.5rem",
                                borderRadius: "999px",
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#ffffff"
                              }}>
                                {item.stock} in stock
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.35rem", fontSize: "0.78rem", color: "#8b8b93", flexWrap: "wrap" }}>
                            {item.barcode && <span>Code: {item.barcode}</span>}
                            <span>Min limit: {item.min_threshold}</span>
                            {item.expiry_date && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <Calendar size={11} /> Exp: {item.expiry_date}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price Badge */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                            ₹{item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Actions Bar */}
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        paddingTop: "0.75rem", 
                        borderTop: "1px solid rgba(255, 255, 255, 0.06)", 
                        gap: "0.5rem" 
                      }}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button 
                            onClick={() => handleQuickSale(item)}
                            disabled={isOutOfStock}
                            className="btn-tap"
                            style={{ 
                              background: isOutOfStock ? "#1c1c20" : "#ffffff", 
                              color: isOutOfStock ? "#71717a" : "#000000", 
                              border: "none", 
                              padding: "0.45rem 0.9rem", 
                              borderRadius: "10px", 
                              fontSize: "0.78rem", 
                              fontWeight: 700, 
                              cursor: isOutOfStock ? "not-allowed" : "pointer" 
                            }}
                          >
                            Sell 1 unit
                          </button>

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
                              padding: "0.45rem 0.8rem",
                              borderRadius: "10px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              cursor: "pointer"
                            }}
                          >
                            <Sparkles size={13} /> Ask
                          </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <button 
                            onClick={() => shareWhatsAppReceipt(item)}
                            title="Share receipt on WhatsApp"
                            className="btn-tap"
                            style={{ 
                              background: "transparent", 
                              border: "1px solid rgba(255, 255, 255, 0.12)", 
                              color: "#ffffff", 
                              padding: "0.45rem", 
                              borderRadius: "10px", 
                              cursor: "pointer" 
                            }}
                          >
                            <Share2 size={13} />
                          </button>

                          <button 
                            onClick={() => handleStartEdit(item)}
                            title="Edit product"
                            className="btn-tap"
                            style={{ 
                              background: "transparent", 
                              border: "1px solid rgba(255, 255, 255, 0.12)", 
                              color: "#8b8b93", 
                              padding: "0.45rem", 
                              borderRadius: "10px", 
                              cursor: "pointer" 
                            }}
                          >
                            <Edit2 size={13} />
                          </button>

                          <button 
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete product"
                            className="btn-tap"
                            style={{ 
                              background: "transparent", 
                              border: "1px solid rgba(255, 255, 255, 0.12)", 
                              color: "#8b8b93", 
                              padding: "0.45rem", 
                              borderRadius: "10px", 
                              cursor: "pointer" 
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BARCODE SCANNER */}
        {activeTab === "scanner" && (
          <div style={{ 
            background: "#09090b", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "18px", 
            padding: "1.5rem", 
            display: "flex", 
            flexDirection: "column", 
            gap: "1.25rem" 
          }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>Scan Barcode</h3>
              <p style={{ fontSize: "0.82rem", color: "#8b8b93", marginTop: "0.25rem" }}>
                Scan using your device camera or enter the number below.
              </p>
            </div>

            <div style={{ 
              width: "100%", 
              height: cameraActive ? "260px" : "auto", 
              background: "#000000", 
              border: "1px dashed rgba(255, 255, 255, 0.2)", 
              borderRadius: "14px", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center", 
              overflow: "hidden", 
              position: "relative" 
            }}>
              {cameraActive ? (
                <>
                  <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button 
                    onClick={stopCamera} 
                    className="btn-tap"
                    style={{ 
                      position: "absolute", 
                      bottom: "12px", 
                      background: "#ffffff", 
                      color: "#000000", 
                      border: "none", 
                      padding: "0.45rem 1rem", 
                      borderRadius: "10px", 
                      fontSize: "0.8rem", 
                      fontWeight: 700, 
                      cursor: "pointer" 
                    }}
                  >
                    Close camera
                  </button>
                </>
              ) : (
                <button 
                  onClick={startCamera} 
                  className="btn-tap"
                  style={{ 
                    background: "transparent", 
                    color: "#ffffff", 
                    border: "none", 
                    padding: "2.5rem 1.5rem", 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "0.6rem", 
                    cursor: "pointer" 
                  }}
                >
                  <Camera size={28} color="#8b8b93" />
                  <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>Open camera to scan</span>
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.55rem" }}>
              <input 
                type="text" 
                placeholder="Enter barcode number..." 
                value={scanBarcode}
                onChange={e => setScanBarcode(e.target.value)}
                style={{
                  flex: 1,
                  height: "44px",
                  background: "#000000", 
                  border: "1px solid rgba(255, 255, 255, 0.14)", 
                  borderRadius: "12px", 
                  color: "#ffffff", 
                  padding: "0 0.95rem", 
                  fontSize: "0.86rem", 
                  outline: "none" 
                }}
              />
              <button 
                onClick={() => lookupBarcode(scanBarcode)}
                disabled={isScanningApi}
                className="btn-tap"
                style={{ 
                  background: "#ffffff", 
                  color: "#000000", 
                  border: "none", 
                  padding: "0 1.25rem", 
                  borderRadius: "12px", 
                  fontSize: "0.86rem", 
                  fontWeight: 700, 
                  cursor: "pointer" 
                }}
              >
                {isScanningApi ? "Searching..." : "Search"}
              </button>
            </div>

            {scannerFeedback && (
              <div style={{ 
                fontSize: "0.84rem", 
                padding: "0.85rem", 
                borderRadius: "12px", 
                background: "#000000", 
                border: "1px solid rgba(255, 255, 255, 0.2)", 
                color: "#ffffff" 
              }}>
                {scannerFeedback}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ANALYTICS & REPORTS */}
        {activeTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            {/* Sales Numbers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div style={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "1rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Total sales</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ffffff", marginTop: "0.3rem" }}>
                  ₹{totalSalesRevenue.toFixed(2)}
                </p>
              </div>
              <div style={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "1rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Items sold</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ffffff", marginTop: "0.3rem" }}>
                  {totalUnitsSold}
                </p>
              </div>
              <div style={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "1rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#8b8b93" }}>Average bill</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ffffff", marginTop: "0.3rem" }}>
                  ₹{averageOrderValue.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Desktop 2-Column Container for Analytics Modules */}
            <div className="analytics-desktop-split">
              {/* Daily Revenue Chart */}
              <div style={{ 
                background: "#09090b", 
                border: "1px solid rgba(255, 255, 255, 0.1)", 
                borderRadius: "18px", 
                padding: "1.25rem" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>7-Day Sales Trend</h3>
                    <p style={{ fontSize: "0.78rem", color: "#8b8b93", marginTop: "0.2rem" }}>
                      Daily recorded revenue
                    </p>
                  </div>
                  <BarChart3 size={18} color="#8b8b93" />
                </div>

                <div style={{ 
                  width: "100%", 
                  height: "175px", 
                  display: "flex", 
                  alignItems: "flex-end", 
                  gap: "0.6rem", 
                  paddingTop: "1rem", 
                  borderBottom: "1px solid rgba(255, 255, 255, 0.12)" 
                }}>
                  {chartData.map((d, index) => {
                    const heightPercent = maxEarning > 0 ? (d.earnings / maxEarning) * 100 : 0;
                    return (
                      <div key={index} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: "0.68rem", color: "#ffffff", marginBottom: "0.35rem", fontWeight: 600 }}>
                          {d.earnings > 0 ? `₹${d.earnings.toFixed(0)}` : "—"}
                        </span>
                        <div 
                          style={{ 
                            width: "100%", 
                            height: `${Math.max(heightPercent, 4)}%`, 
                            backgroundColor: d.earnings > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.08)", 
                            borderRadius: "4px 4px 0 0" 
                          }} 
                        />
                        <span style={{ fontSize: "0.68rem", color: "#8b8b93", marginTop: "0.45rem" }}>
                          {d.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Products */}
              <div style={{ 
                background: "#09090b", 
                border: "1px solid rgba(255, 255, 255, 0.1)", 
                borderRadius: "18px", 
                padding: "1.25rem" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>Top Selling Items</h3>
                    <p style={{ fontSize: "0.78rem", color: "#8b8b93", marginTop: "0.2rem" }}>
                      Products bringing the highest sales
                    </p>
                  </div>
                  <ShoppingBag size={18} color="#8b8b93" />
                </div>

                {topSellingItems.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#71717a", textAlign: "center", padding: "1.5rem" }}>
                    No sales recorded yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {topSellingItems.map((item, idx) => {
                      const widthPercent = (item.revenue / maxItemRevenue) * 100;
                      return (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                            <span style={{ fontWeight: 600, color: "#ffffff" }}>{item.name}</span>
                            <span style={{ color: "#8b8b93" }}>{item.units} sold · ₹{item.revenue.toFixed(2)}</span>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ width: `${widthPercent}%`, height: "100%", background: "#ffffff", borderRadius: "999px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop 2-Column Container for Health & Recent Transactions */}
            <div className="analytics-desktop-split">
              {/* Inventory Status Bar */}
              <div style={{ 
                background: "#09090b", 
                border: "1px solid rgba(255, 255, 255, 0.1)", 
                borderRadius: "18px", 
                padding: "1.25rem" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>Stock Health</h3>
                    <p style={{ fontSize: "0.78rem", color: "#8b8b93", marginTop: "0.2rem" }}>
                      Current inventory balance
                    </p>
                  </div>
                  <PieChart size={18} color="#8b8b93" />
                </div>

                {inventory.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#71717a" }}>Inventory is empty.</p>
                ) : (
                  <div>
                    <div style={{ width: "100%", height: "10px", background: "#000000", borderRadius: "999px", display: "flex", overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", marginBottom: "1rem" }}>
                      <div style={{ width: `${(healthyStockCount / inventory.length) * 100}%`, background: "#ffffff", height: "100%" }} />
                      <div style={{ width: `${(lowStockCount / inventory.length) * 100}%`, background: "rgba(255, 255, 255, 0.4)", height: "100%" }} />
                      <div style={{ width: `${(outOfStockCount / inventory.length) * 100}%`, background: "rgba(255, 255, 255, 0.12)", height: "100%" }} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
                      <div style={{ padding: "0.75rem", background: "#000000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                        <span style={{ fontSize: "0.72rem", color: "#8b8b93" }}>In stock</span>
                        <p style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginTop: "0.2rem" }}>{healthyStockCount} items</p>
                      </div>
                      <div style={{ padding: "0.75rem", background: "#000000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                        <span style={{ fontSize: "0.72rem", color: "#8b8b93" }}>Low stock</span>
                        <p style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginTop: "0.2rem" }}>{lowStockCount} items</p>
                      </div>
                      <div style={{ padding: "0.75rem", background: "#000000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                        <span style={{ fontSize: "0.72rem", color: "#8b8b93" }}>Out of stock</span>
                        <p style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginTop: "0.2rem" }}>{outOfStockCount} items</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Sales List */}
              <div style={{ 
                background: "#09090b", 
                border: "1px solid rgba(255, 255, 255, 0.1)", 
                borderRadius: "18px", 
                padding: "1.25rem" 
              }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.85rem" }}>Recent Transactions</h3>
                {sales.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#8b8b93" }}>No recorded sales yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", maxHeight: "240px", overflowY: "auto" }}>
                    {sales.slice(0, 12).map(s => (
                      <div 
                        key={s.id} 
                        style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          fontSize: "0.84rem", 
                          borderBottom: "1px solid rgba(255, 255, 255, 0.08)", 
                          paddingBottom: "0.5rem" 
                        }}
                      >
                        <span style={{ color: "#ffffff" }}>{s.item_name} <span style={{ color: "#71717a" }}>(×{s.quantity})</span></span>
                        <span style={{ fontWeight: 600, color: "#ffffff" }}>+₹{Number(s.total_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: SUPPORT */}
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
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>Contact Support</h3>
                <p style={{ fontSize: "0.82rem", color: "#8b8b93", marginTop: "0.2rem" }}>
                  Reach out directly if you have any questions or store issues.
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
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#ffffff" }}>Phone</div>
                      <div style={{ fontSize: "0.76rem", color: "#8b8b93", marginTop: "0.1rem" }}>+91 91299 58865</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#71717a" />
                </a>

                <a 
                  href="https://wa.me/919129958865?text=Hello%20QuickPick%20Support"
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
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#ffffff" }}>WhatsApp</div>
                      <div style={{ fontSize: "0.76rem", color: "#8b8b93", marginTop: "0.1rem" }}>Chat with us directly</div>
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
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#ffffff" }}>Email</div>
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

      {/* Product Details & Question Modal */}
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
                  Product Helper
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

            {/* Quick Suggestions */}
            <div>
              <span style={{ fontSize: "0.75rem", color: "#8b8b93", display: "block", marginBottom: "0.5rem" }}>
                Quick options:
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  {
                    title: "Price & margin",
                    query: "price and margin suggestions",
                    icon: Percent
                  },
                  {
                    title: "When to reorder",
                    query: "when should I reorder this and how much",
                    icon: Boxes
                  },
                  {
                    title: "Storage tips",
                    query: "how to store this properly to avoid spoiling",
                    icon: Clock
                  },
                  {
                    title: "Items to pair with",
                    query: "what other items can I pair or sell together with this",
                    icon: Tag
                  }
                ].map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => askAssistant(chip.query)}
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
                placeholder="Ask anything about this item..." 
                value={customQuery}
                onChange={e => setCustomQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customQuery.trim()) {
                    askAssistant(customQuery);
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
                    askAssistant(customQuery);
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

            {/* Answer Display */}
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
                    <span className="stream-dot">•</span> Finding answer...
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

      {/* Premium Modal */}
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
              Store Premium
            </h3>
            
            <p style={{ fontSize: "0.84rem", color: "#8b8b93", marginTop: "0.35rem", marginBottom: "1.25rem", lineHeight: 1.45 }}>
              Professional inventory infrastructure with real-time barcode synchronization and automatic alerts.
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
                  Active Subscription
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
                { icon: Zap, label: "Unlimited high-speed optical barcode queries" },
                { icon: BellRing, label: "Automatic WhatsApp customer receipts & low stock alerts" },
                { icon: Sparkles, label: "Daily margin & fast-selling item suggestions" },
                { icon: FileSpreadsheet, label: "One-click CSV accounting and ledger exports" },
                { icon: ShieldCheck, label: "Encrypted multi-terminal synchronization" }
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
              <span style={{ fontSize: "1.55rem", fontWeight: 800, color: "#ffffff" }}>₹499</span>
              <span style={{ fontSize: "0.82rem", color: "#71717a" }}> / month after trial</span>
            </div>

            {/* Purchase Button */}
            <button
              onClick={() => {
                alert("Thank you for your interest. Premium accounts are currently on free evaluation trials.");
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
              <Crown size={16} color="#000000" /> Activate Store Premium
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
