import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "./supabase";
import { 
  User, 
  Store, 
  BarChart2, 
  ScanLine, 
  ArrowRight, 
  Loader2, 
  LogOut,
  AlertTriangle,
  Plus,
  Phone,
  Mail,
  TrendingUp,
  Package,
  Search,
  Edit2,
  Trash2,
  Camera,
  Check,
  X,
  Share2,
  Download,
  Calendar
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  stock: number;
  min_threshold: number;
  expiry_date?: string;
}

interface SaleRecord {
  id: string;
  item_name: string;
  quantity: number;
  total_price: number;
  created_at: string;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [roleSelection, setRoleSelection] = useState<"CONSUMER" | "SHOPKEEPER">("CONSUMER");
  const [savingRole, setSavingRole] = useState(false);

  // Shopkeeper Workspace State
  const [activeTab, setActiveTab] = useState<"inventory" | "scanner" | "analytics" | "support">("inventory");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editThreshold, setEditThreshold] = useState("");

  // Add Item Drawer State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [newItemThreshold, setNewItemThreshold] = useState("5");
  const [newItemExpiry, setNewItemExpiry] = useState("");
  const [newItemBarcode, setNewItemBarcode] = useState("");

  // Barcode Scanner Mode
  const [scanBarcode, setScanBarcode] = useState("");
  const [isScanningApi, setIsScanningApi] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setProfile(data);
      if (data?.role === "SHOPKEEPER") {
        fetchInventory(userId);
        fetchSales(userId);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async (userId: string) => {
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .eq("shopkeeper_id", userId)
      .order("stock", { ascending: true });
    if (data) setInventory(data as InventoryItem[]);
  };

  const fetchSales = async (userId: string) => {
    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("shopkeeper_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setSales(data as SaleRecord[]);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const saveRole = async () => {
    if (!session?.user) return;
    setSavingRole(true);
    const payload = {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || "",
      role: roleSelection,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) {
      setProfile(payload);
      if (roleSelection === "SHOPKEEPER") {
        fetchInventory(session.user.id);
        fetchSales(session.user.id);
      }
    }
    setSavingRole(false);
  };

  const handleSignOut = () => supabase.auth.signOut();

  // Open Food Facts Free API Barcode Lookup
  const lookupBarcode = async (code: string) => {
    if (!code.trim()) return;
    setIsScanningApi(true);
    setScannerFeedback(null);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code.trim()}.json`);
      const data = await response.json();

      if (data && data.status === 1 && data.product) {
        const foundName = data.product.product_name || data.product.generic_name || "Packaged Grocery Item";
        setNewItemName(foundName);
        setNewItemBarcode(code.trim());
        setScannerFeedback(`Found: "${foundName}". Fill in price & quantity below.`);
        setShowAddForm(true);
        setActiveTab("inventory");
      } else {
        setScannerFeedback("Barcode not found in global database. Enter item name manually.");
        setNewItemBarcode(code.trim());
        setShowAddForm(true);
        setActiveTab("inventory");
      }
    } catch {
      setScannerFeedback("Network error querying Open Food Facts. Manual entry activated.");
      setNewItemBarcode(code.trim());
      setShowAddForm(true);
      setActiveTab("inventory");
    } finally {
      setIsScanningApi(false);
      stopCamera();
    }
  };

  // Browser Camera Barcode Detector API Support
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        // Native BarcodeDetector (Chrome Android)
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
      setScannerFeedback("Camera permission denied. Use direct barcode entry below.");
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

  // Inventory Actions
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice || !newItemStock) return;

    const { data, error } = await supabase.from("inventory").insert([
      {
        shopkeeper_id: session.user.id,
        name: newItemName.trim(),
        barcode: newItemBarcode.trim() || null,
        price: parseFloat(newItemPrice),
        stock: parseInt(newItemStock, 10),
        min_threshold: parseInt(newItemThreshold, 10) || 5,
        expiry_date: newItemExpiry || null,
      }
    ]).select();

    if (!error && data) {
      setInventory(prev => [...prev, data[0] as InventoryItem]);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemStock("");
      setNewItemThreshold("5");
      setNewItemExpiry("");
      setNewItemBarcode("");
      setShowAddForm(false);
    }
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
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (!error) {
      setInventory(prev => prev.filter(i => i.id !== id));
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

  // CSV Export
  const exportInventoryCSV = () => {
    const headers = "Name,Barcode,Price,Stock,AlertThreshold,ExpiryDate\n";
    const rows = inventory.map(i => 
      `"${i.name}","${i.barcode || ""}","${i.price}","${i.stock}","${i.min_threshold}","${i.expiry_date || ""}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quickpick_inventory_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // WhatsApp Digital Receipt Generator
  const shareWhatsAppReceipt = (item: InventoryItem) => {
    const message = encodeURIComponent(
      `Quick Pick Receipt\nProduct: ${item.name}\nQuantity: 1\nTotal: Rs ${item.price.toFixed(2)}\nThank you for shopping with us!`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const q = searchQuery.toLowerCase();
    return inventory.filter(i => 
      i.name.toLowerCase().includes(q) || (i.barcode && i.barcode.includes(q))
    );
  }, [inventory, searchQuery]);

  // Aggregated Analytics
  const lowStockCount = inventory.filter(i => i.stock <= i.min_threshold).length;
  const criticalItems = inventory.filter(i => i.stock <= i.min_threshold);
  const totalValuation = inventory.reduce((acc, curr) => acc + (curr.price * curr.stock), 0);
  
  // Calculate daily earnings for last 7 days
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

  const maxEarning = Math.max(...chartData.map(d => d.earnings), 50);

  // 1. Initial Loading
  if (loading) {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <Loader2 className="animate-spin text-muted" size={24} />
      </div>
    );
  }

  // 2. Auth Screen
  if (!session) {
    return (
      <div className="page-wrapper">
        <div className="auth-container">
          <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            <div style={{ width: "42px", height: "42px", background: "#ffffff", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
              <Store size={22} color="#000000" />
            </div>
            <h1>Quick Pick</h1>
            <p style={{ marginTop: "0.4rem" }}>Autonomous retail intelligence & fast operations.</p>
          </div>

          <button onClick={handleGoogleLogin} className="btn-google">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="feature-list">
            <div className="feature-item">
              <BarChart2 className="feature-icon" size={20} />
              <div className="feature-text">
                <h3>Live Sales Trends</h3>
                <p>Real-time revenue monitoring and turnover metrics.</p>
              </div>
            </div>
            <div className="feature-item">
              <ScanLine className="feature-icon" size={20} />
              <div className="feature-text">
                <h3>Free Open Food Facts Scanner</h3>
                <p>Scan barcodes to auto-populate product names instantly.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Workspace Role Selection
  if (!profile?.role) {
    return (
      <div className="page-wrapper">
        <div className="auth-container">
          <div style={{ textAlign: "center" }}>
            <h1>Select Workspace</h1>
            <p style={{ marginTop: "0.4rem" }}>Select your account role to proceed.</p>
          </div>

          <div className="clean-card">
            <div className="role-grid">
              <div 
                className={`role-box ${roleSelection === "CONSUMER" ? "active" : ""}`}
                onClick={() => setRoleSelection("CONSUMER")}
              >
                <User size={24} />
                <span>Consumer</span>
              </div>
              <div 
                className={`role-box ${roleSelection === "SHOPKEEPER" ? "active" : ""}`}
                onClick={() => setRoleSelection("SHOPKEEPER")}
              >
                <Store size={24} />
                <span>Shopkeeper</span>
              </div>
            </div>

            <button onClick={saveRole} disabled={savingRole} className="btn-action">
              {savingRole ? "Saving..." : "Continue"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Shopkeeper Console Portal
  if (profile.role === "SHOPKEEPER") {
    return (
      <div className="page-wrapper" style={{ alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "800px" }}>
          
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.25rem" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem" }}>Merchant Console</h1>
              <p style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>{session.user.email}</p>
            </div>
            <button onClick={handleSignOut} style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "0.45rem 0.75rem", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
              <LogOut size={14} /> Exit
            </button>
          </header>

          {/* Critical Inventory Alert Banner */}
          {criticalItems.length > 0 && (
            <div style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", color: "#f43f5e" }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: "0.85rem" }}>
                <strong>Critical Restock Alert:</strong> {criticalItems.length} items ({criticalItems.map(i => i.name).slice(0, 3).join(", ")}) have reached their custom threshold limit.
              </div>
            </div>
          )}

          {/* Quick Stats Bar */}
          <div className="stat-grid">
            <div className="clean-card" style={{ padding: "0.85rem 1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total SKUs</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.2rem", color: "#fff" }}>{inventory.length}</p>
            </div>
            <div className="clean-card" style={{ padding: "0.85rem 1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Stock Value</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.2rem", color: "#fff" }}>${totalValuation.toFixed(2)}</p>
            </div>
            <div className="clean-card" style={{ padding: "0.85rem 1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Low Stock</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.2rem", color: lowStockCount > 0 ? "var(--rose)" : "var(--emerald)" }}>
                {lowStockCount}
              </p>
            </div>
          </div>

          {/* Module Navigation Tabs */}
          <div className="nav-tab-bar">
            <button 
              className={`nav-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
              onClick={() => setActiveTab("inventory")}
            >
              <Package size={15} /> Inventory
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === "scanner" ? "active" : ""}`}
              onClick={() => setActiveTab("scanner")}
            >
              <ScanLine size={15} /> Add via Barcode
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              <TrendingUp size={15} /> Sales Graph
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === "support" ? "active" : ""}`}
              onClick={() => setActiveTab("support")}
            >
              <Phone size={15} /> Support
            </button>
          </div>

          {/* TAB 1: INVENTORY MANAGEMENT WITH SEARCH & EDIT */}
          {activeTab === "inventory" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "10px", top: "11px" }} />
                  <input 
                    type="text" 
                    placeholder="Search inventory by name or barcode..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: "32px" }}
                  />
                </div>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)}
                  style={{ background: "#ffffff", color: "#000000", border: "none", padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <Plus size={15} /> {showAddForm ? "Cancel" : "Add Item"}
                </button>
                <button 
                  onClick={exportInventoryCSV}
                  title="Export to CSV"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "#fff", padding: "0.4rem 0.65rem", borderRadius: "8px", cursor: "pointer" }}
                >
                  <Download size={16} />
                </button>
              </div>

              {/* Add Item Form */}
              {showAddForm && (
                <form onSubmit={handleAddItem} className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>Add New Item</span>
                  <input 
                    type="text" 
                    placeholder="Product name (e.g. Britannia Biscuits)" 
                    value={newItemName} 
                    onChange={e => setNewItemName(e.target.value)} 
                    className="form-input" 
                    required 
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="Price ($)" 
                      value={newItemPrice} 
                      onChange={e => setNewItemPrice(e.target.value)} 
                      className="form-input" 
                      required 
                    />
                    <input 
                      type="number" 
                      placeholder="Stock quantity" 
                      value={newItemStock} 
                      onChange={e => setNewItemStock(e.target.value)} 
                      className="form-input" 
                      required 
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Low Alert Limit</label>
                      <input 
                        type="number" 
                        placeholder="Default 5" 
                        value={newItemThreshold} 
                        onChange={e => setNewItemThreshold(e.target.value)} 
                        className="form-input" 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Expiry Date (Optional)</label>
                      <input 
                        type="date" 
                        value={newItemExpiry} 
                        onChange={e => setNewItemExpiry(e.target.value)} 
                        className="form-input" 
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-action" style={{ height: "42px", fontSize: "0.88rem" }}>
                    Save Product to Database
                  </button>
                </form>
              )}

              {/* Items List */}
              {filteredInventory.length === 0 ? (
                <div className="clean-card" style={{ textAlign: "center", padding: "2.5rem" }}>
                  <p style={{ fontSize: "0.85rem" }}>No matching products. Click "+ Add Item" or scan a barcode.</p>
                </div>
              ) : (
                filteredInventory.map(item => {
                  const isLow = item.stock <= item.min_threshold;
                  const isEditing = editingItemId === item.id;

                  if (isEditing) {
                    return (
                      <div key={item.id} className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Editing Item</span>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)} 
                          className="form-input" 
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                          <input 
                            type="number" 
                            placeholder="Price" 
                            value={editPrice} 
                            onChange={e => setEditPrice(e.target.value)} 
                            className="form-input" 
                          />
                          <input 
                            type="number" 
                            placeholder="Stock" 
                            value={editStock} 
                            onChange={e => setEditStock(e.target.value)} 
                            className="form-input" 
                          />
                          <input 
                            type="number" 
                            placeholder="Alert limit" 
                            value={editThreshold} 
                            onChange={e => setEditThreshold(e.target.value)} 
                            className="form-input" 
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
                          <button 
                            onClick={() => handleSaveEdit(item.id)} 
                            style={{ flex: 1, background: "#fff", color: "#000", border: "none", padding: "0.45rem", borderRadius: "6px", fontWeight: 600, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", cursor: "pointer" }}
                          >
                            <Check size={14} /> Save
                          </button>
                          <button 
                            onClick={() => setEditingItemId(null)} 
                            style={{ background: "var(--surface)", color: "#fff", border: "1px solid var(--border)", padding: "0.45rem 0.85rem", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className="clean-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{item.name}</span>
                          {isLow ? (
                            <span className="badge-alert">Low ({item.stock})</span>
                          ) : (
                            <span className="badge-good">{item.stock} left</span>
                          )}
                          {item.expiry_date && (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <Calendar size={12} /> {item.expiry_date}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                          ${item.price.toFixed(2)} · Alert at ≤{item.min_threshold} {item.barcode && `· Barcode: ${item.barcode}`}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <button 
                          onClick={() => handleQuickSale(item)}
                          disabled={item.stock === 0}
                          title="Record single sale"
                          style={{ background: "#ffffff", color: "#000000", border: "none", padding: "0.4rem 0.65rem", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          Sell 1
                        </button>
                        <button 
                          onClick={() => shareWhatsAppReceipt(item)}
                          title="Send WhatsApp Receipt"
                          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--emerald)", padding: "0.4rem 0.5rem", borderRadius: "6px", cursor: "pointer" }}
                        >
                          <Share2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleStartEdit(item)}
                          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "0.4rem 0.5rem", borderRadius: "6px", cursor: "pointer" }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--rose)", padding: "0.4rem 0.5rem", borderRadius: "6px", cursor: "pointer" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: FREE OPEN FOOD FACTS BARCODE SCANNER */}
          {activeTab === "scanner" && (
            <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Open Food Facts Barcode Integration</h3>
                <p style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Scan or enter a product barcode. We will automatically query the free Open Food Facts international grocery database for product details.
                </p>
              </div>

              {/* Camera Preview */}
              <div style={{ width: "100%", height: cameraActive ? "220px" : "auto", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                {cameraActive ? (
                  <>
                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button 
                      onClick={stopCamera} 
                      style={{ position: "absolute", bottom: "10px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "1px solid var(--border)", padding: "0.3rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      Stop Camera
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={startCamera} 
                    style={{ background: "transparent", color: "var(--text-main)", border: "none", padding: "1.75rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
                  >
                    <Camera size={28} color="var(--text-muted)" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Open Camera to Scan Barcode</span>
                  </button>
                )}
              </div>

              {/* Direct Code Input Fallback */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input 
                  type="text" 
                  placeholder="Enter barcode number (e.g. 5449000000996)" 
                  value={scanBarcode}
                  onChange={e => setScanBarcode(e.target.value)}
                  className="form-input"
                />
                <button 
                  onClick={() => lookupBarcode(scanBarcode)}
                  disabled={isScanningApi}
                  className="btn-action" 
                  style={{ width: "auto", padding: "0 1.25rem", height: "42px", fontSize: "0.85rem" }}
                >
                  {isScanningApi ? <Loader2 className="animate-spin" size={16} /> : "Search API"}
                </button>
              </div>

              {scannerFeedback && (
                <div style={{ fontSize: "0.85rem", padding: "0.75rem", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)", color: "#fff" }}>
                  {scannerFeedback}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VISUAL SALES & REVENUE CHARTS */}
          {activeTab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="clean-card">
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>Daily Revenue (Past 7 Days)</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                  Hardware-accelerated native graph of total daily income.
                </p>

                {/* Lightweight Native SVG Bar Chart */}
                <div style={{ width: "100%", height: "160px", display: "flex", alignItems: "flex-end", gap: "0.5rem", paddingTop: "1rem", borderBottom: "1px solid var(--border)" }}>
                  {chartData.map((d, index) => {
                    const heightPercent = maxEarning > 0 ? (d.earnings / maxEarning) * 100 : 0;
                    return (
                      <div key={index} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: "0.7rem", color: "#fff", marginBottom: "0.25rem" }}>
                          ${d.earnings.toFixed(0)}
                        </span>
                        <div 
                          style={{ 
                            width: "100%", 
                            height: `${Math.max(heightPercent, 6)}%`, 
                            backgroundColor: d.earnings > 0 ? "#ffffff" : "var(--surface)", 
                            borderRadius: "4px 4px 0 0",
                            transition: "height 0.4s ease"
                          }} 
                        />
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                          {d.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Product Turnout Logs */}
              <div className="clean-card">
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Recent Sales Activity</h3>
                {sales.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>No recorded sales. Tap "Sell 1" on any product in Inventory to register transactions.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
                    {sales.slice(0, 10).map(s => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.4rem" }}>
                        <span>{s.item_name} (×{s.quantity})</span>
                        <span style={{ fontWeight: 600, color: "var(--emerald)" }}>+${Number(s.total_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SUPPORT DESK */}
          {activeTab === "support" && (
            <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Merchant Support Channels</h3>
                <p style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>Direct contact lines for POS issues, barcode errors, or system recovery.</p>
              </div>

              <a 
                href="tel:+919129958865" 
                style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "0.85rem", borderRadius: "8px" }}
              >
                <Phone size={18} color="var(--emerald)" />
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Phone Hotline</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>+91 91299 58865</div>
                </div>
              </a>

              <a 
                href="mailto:anaadigeet75@gmail.com" 
                style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "0.85rem", borderRadius: "8px" }}
              >
                <Mail size={18} color="#ffffff" />
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Primary Support Email</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>anaadigeet75@gmail.com</div>
                </div>
              </a>
            </div>
          )}

        </div>
      </div>
    );
  }

  // 5. Consumer Workspace
  return (
    <div className="page-wrapper" style={{ alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: "800px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.2rem" }}>Consumer Portal</h1>
            <p style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>{session.user.email}</p>
          </div>
          <button onClick={handleSignOut} style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "0.45rem 0.75rem", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
            <LogOut size={14} /> Exit
          </button>
        </header>

        <div className="clean-card">
          <h3 style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: "0.4rem", color: "var(--text-main)" }}>Consumer Health Scanner</h3>
          <p style={{ fontSize: "0.85rem" }}>Barcode ingredient safety and nutritional verification module ready.</p>
        </div>
      </div>
    </div>
  );
}
