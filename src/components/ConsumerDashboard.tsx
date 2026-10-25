import React, { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "../supabase";
import { 
  ScanLine, 
  Camera, 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  Thermometer, 
  Star, 
  MessageSquare, 
  Phone, 
  Mail, 
  Bell, 
  LogOut, 
  Loader2, 
  HeartPulse,
  Send,
  Sparkles
} from "lucide-react";

interface ConsumerDashboardProps {
  session: any;
  onSignOut: () => void;
}

interface ProductHealthData {
  barcode: string;
  name: string;
  brand?: string;
  ingredientsText?: string;
  nutriScore?: string;
  novaGroup?: number;
  flags: { type: "danger" | "warn" | "safe"; label: string; detail: string }[];
  healthVerdict: "HEALTHY" | "MODERATE" | "UNHEALTHY";
  storageTip: string;
  shelfLifeAdvice: string;
}

interface ProductReview {
  id: string;
  user_email: string;
  barcode: string;
  product_name: string;
  rating: number;
  review_text: string;
  created_at: string;
}

export default function ConsumerDashboard({ session, onSignOut }: ConsumerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"scanner" | "reviews" | "support">("scanner");
  
  // Scanner state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ProductHealthData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Preferences & permissions toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (scannedProduct?.barcode) {
      fetchProductReviews(scannedProduct.barcode);
    }
  }, [scannedProduct]);

  const fetchProductReviews = async (barcode: string) => {
    const { data } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("barcode", barcode)
      .order("created_at", { ascending: false });
    if (data) setReviews(data as ProductReview[]);
  };

  const analyzeProductHealth = (data: any, barcode: string): ProductHealthData => {
    const p = data.product || {};
    const name = p.product_name || p.generic_name || "Packaged Food Item";
    const brand = p.brands || "";
    const ingredients = p.ingredients_text || "";
    const lowerIng = ingredients.toLowerCase();

    const flags: ProductHealthData["flags"] = [];

    // Detect harmful ingredients
    if (lowerIng.includes("palm oil") || lowerIng.includes("palmolein")) {
      flags.push({ type: "danger", label: "Palm Oil / Palmolein Present", detail: "High in saturated fat content, elevates bad LDL cholesterol." });
    }
    if (lowerIng.includes("high fructose corn syrup") || lowerIng.includes("liquid glucose") || lowerIng.includes("invert syrup")) {
      flags.push({ type: "danger", label: "Refined Added Sugars", detail: "Causes immediate insulin spikes and metabolic stress." });
    }
    if (lowerIng.includes("monosodium glutamate") || lowerIng.includes("msg") || lowerIng.includes("e621")) {
      flags.push({ type: "warn", label: "MSG / E621 Flavor Enhancer", detail: "Can cause hypersensitive reactions in susceptible individuals." });
    }
    if (lowerIng.includes("preservative") || lowerIng.includes("sodium benzoate") || lowerIng.includes("potassium sorbate")) {
      flags.push({ type: "warn", label: "Chemical Preservatives", detail: "Synthetic shelf-life stabilizers present." });
    }
    if (lowerIng.includes("artificial flavour") || lowerIng.includes("synthetic color") || lowerIng.includes("tartrazine") || lowerIng.includes("sunset yellow")) {
      flags.push({ type: "warn", label: "Artificial Colors & Flavors", detail: "Contains synthetic chemical coloring agents." });
    }

    if (flags.length === 0) {
      flags.push({ type: "safe", label: "Wholesome Ingredients", detail: "No aggressive preservatives, hydrogenated oils, or excessive additives found." });
    }

    let verdict: ProductHealthData["healthVerdict"] = "HEALTHY";
    if (flags.some(f => f.type === "danger")) {
      verdict = "UNHEALTHY";
    } else if (flags.some(f => f.type === "warn")) {
      verdict = "MODERATE";
    }

    const categories = (p.categories || "").toLowerCase();
    let storage = "Store in a cool, dry place away from direct heat and sunlight.";
    let shelfLife = "Refer to the printed Best Before / Use By date on the container.";

    if (categories.includes("milk") || categories.includes("dairy") || categories.includes("cheese") || categories.includes("paneer")) {
      storage = "Refrigerate continuously between 2°C and 4°C. Consume within 48-72 hours of unsealing.";
      shelfLife = "High risk of bacterial spoilage if left at room temperature.";
    } else if (categories.includes("biscuit") || categories.includes("cookie") || categories.includes("chips") || categories.includes("namkeen")) {
      storage = "Store in an airtight container once opened to avoid moisture entry and oxidation.";
      shelfLife = "Best consumed within 3 months from packing.";
    } else if (categories.includes("sauce") || categories.includes("ketchup") || categories.includes("jam")) {
      storage = "Refrigerate after opening to prevent fungal formation.";
      shelfLife = "Good for up to 30 days once the seal is broken.";
    }

    return {
      barcode,
      name,
      brand,
      ingredientsText: ingredients,
      nutriScore: p.nutriscore_grade?.toUpperCase(),
      novaGroup: p.nova_group,
      flags,
      healthVerdict: verdict,
      storageTip: p.conservation_conditions || storage,
      shelfLifeAdvice: shelfLife,
    };
  };

  const lookupBarcode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setIsScanning(true);
    setScanError(null);
    setScannedProduct(null);

    try {
      const response = await fetch(`https://in.openfoodfacts.org/api/v0/product/${cleanCode}.json`);
      const data = await response.json();

      if (data && data.status === 1 && data.product) {
        const parsed = analyzeProductHealth(data, cleanCode);
        setScannedProduct(parsed);
      } else {
        setScanError(`Barcode ${cleanCode} not found in the verified grocery safety directory.`);
      }
    } catch {
      setScanError("Network error querying health database. Please check your connection.");
    } finally {
      setIsScanning(false);
      stopCamera();
    }
  };

  const startCamera = async () => {
    setCameraActive(true);
    setScanError(null);
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
      setScanError("Camera access denied. Please enter the barcode number below.");
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

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedProduct || !newReviewText.trim()) return;

    setIsSubmittingReview(true);
    const payload = {
      user_id: session.user.id,
      user_email: session.user.email,
      barcode: scannedProduct.barcode,
      product_name: scannedProduct.name,
      rating: newRating,
      review_text: newReviewText.trim(),
    };

    const { data, error } = await supabase.from("product_reviews").insert([payload]).select();

    if (!error && data) {
      setReviews(prev => [data[0] as ProductReview, ...prev]);
      setNewReviewText("");
      setNewRating(5);
    } else {
      alert(error?.message || "Failed to submit review.");
    }
    setIsSubmittingReview(false);
  };

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  return (
    <div className="page-wrapper" style={{ alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: "800px" }}>
        
        {/* Header */}
        <header style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr auto 1fr", 
          alignItems: "center", 
          paddingBottom: "1.25rem", 
          borderBottom: "1px solid var(--border)", 
          marginBottom: "1.25rem" 
        }}>
          <div style={{ display: "flex", flexDirection: "column", justifySelf: "start" }}>
            <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff" }}>Hello!</span>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>{session.user.email}</p>
          </div>

          <h1 style={{ 
            fontSize: "1.25rem", 
            fontWeight: 700, 
            color: "#ffffff", 
            letterSpacing: "0.01em",
            textAlign: "center",
            margin: 0,
            textShadow: "0 0 10px rgba(255, 255, 255, 0.45), 0 0 20px rgba(255, 255, 255, 0.2)"
          }}>
            Consumer Hub
          </h1>

          <button 
            onClick={onSignOut} 
            style={{ 
              justifySelf: "end",
              background: "transparent", 
              color: "var(--text-muted)", 
              border: "1px solid var(--border)", 
              padding: "0.45rem 0.75rem", 
              borderRadius: "8px", 
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center", 
              gap: "0.4rem", 
              fontSize: "0.82rem" 
            }}
          >
            <LogOut size={14} /> Exit
          </button>
        </header>

        {/* Tab Controls */}
        <div className="nav-tab-bar">
          <button 
            className={`nav-tab-btn ${activeTab === "scanner" ? "active" : ""}`}
            onClick={() => setActiveTab("scanner")}
          >
            <ScanLine size={15} /> Safety Scanner
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "reviews" ? "active" : ""}`}
            onClick={() => setActiveTab("reviews")}
          >
            <Star size={15} /> Customer Reviews
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "support" ? "active" : ""}`}
            onClick={() => setActiveTab("support")}
          >
            <Phone size={15} /> Care & Access
          </button>
        </div>

        {/* 1. SAFETY SCANNER & INGREDIENT VERDICT */}
        {activeTab === "scanner" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Food Ingredient & Safety Inspector</h3>
                <p style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Scan product barcodes to check for harmful ingredients, shelf life, and storage advice[span_5](start_span)[span_5](end_span).
                </p>
              </div>

              {/* Camera Preview */}
              <div style={{ width: "100%", height: cameraActive ? "220px" : "auto", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                {cameraActive ? (
                  <>
                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button 
                      onClick={stopCamera} 
                      style={{ position: "absolute", bottom: "10px", background: "rgba(0,0,0,0.75)", color: "#fff", border: "1px solid var(--border)", padding: "0.3rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
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

              {/* Manual Input */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input 
                  type="text" 
                  placeholder="Or enter barcode (e.g. 8901030383742)" 
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  className="form-input"
                />
                <button 
                  onClick={() => lookupBarcode(barcodeInput)}
                  disabled={isScanning}
                  className="btn-action" 
                  style={{ width: "auto", padding: "0 1.25rem", height: "42px", fontSize: "0.85rem" }}
                >
                  {isScanning ? <Loader2 className="animate-spin" size={16} /> : "Inspect"}
                </button>
              </div>

              {scanError && (
                <div style={{ fontSize: "0.85rem", padding: "0.75rem", borderRadius: "8px", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", color: "var(--rose)" }}>
                  {scanError}
                </div>
              )}
            </div>

            {/* SCAN RESULTS */}
            {scannedProduct && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                
                {/* Verdict Header */}
                <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{scannedProduct.brand || "Packaged Good"}</span>
                      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>{scannedProduct.name}</h2>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Barcode: {scannedProduct.barcode}</span>
                    </div>

                    <div style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      background: scannedProduct.healthVerdict === "HEALTHY" 
                        ? "rgba(16, 185, 129, 0.15)" 
                        : scannedProduct.healthVerdict === "MODERATE" 
                        ? "rgba(245, 158, 11, 0.15)" 
                        : "rgba(244, 63, 94, 0.15)",
                      color: scannedProduct.healthVerdict === "HEALTHY" 
                        ? "var(--emerald)" 
                        : scannedProduct.healthVerdict === "MODERATE" 
                        ? "var(--amber)" 
                        : "var(--rose)",
                      border: `1px solid ${scannedProduct.healthVerdict === "HEALTHY" ? "rgba(16,185,129,0.3)" : scannedProduct.healthVerdict === "MODERATE" ? "rgba(245,158,11,0.3)" : "rgba(244,63,94,0.3)"}`
                    }}>
                      {scannedProduct.healthVerdict === "HEALTHY" && <ShieldCheck size={16} />}
                      {scannedProduct.healthVerdict === "MODERATE" && <AlertTriangle size={16} />}
                      {scannedProduct.healthVerdict === "UNHEALTHY" && <ShieldAlert size={16} />}
                      {scannedProduct.healthVerdict}
                    </div>
                  </div>

                  {(scannedProduct.nutriScore || scannedProduct.novaGroup) && (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                      {scannedProduct.nutriScore && (
                        <div style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          Nutri-Score: <strong>Grade {scannedProduct.nutriScore}</strong>
                        </div>
                      )}
                      {scannedProduct.novaGroup && (
                        <div style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          Processing: <strong>NOVA Group {scannedProduct.novaGroup}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 1. Ingredients Audit */}
                <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <HeartPulse size={16} color="var(--rose)" /> Ingredients & Health Checklist[span_6](start_span)[span_6](end_span)
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {scannedProduct.flags.map((flag, idx) => (
                      <div key={idx} style={{ 
                        display: "flex", 
                        alignItems: "flex-start", 
                        gap: "0.6rem", 
                        padding: "0.65rem", 
                        borderRadius: "8px", 
                        background: "var(--surface)", 
                        border: "1px solid var(--border)" 
                      }}>
                        {flag.type === "danger" && <ShieldAlert size={16} color="var(--rose)" style={{ marginTop: "2px", flexShrink: 0 }} />}
                        {flag.type === "warn" && <AlertTriangle size={16} color="var(--amber)" style={{ marginTop: "2px", flexShrink: 0 }} />}
                        {flag.type === "safe" && <ShieldCheck size={16} color="var(--emerald)" style={{ marginTop: "2px", flexShrink: 0 }} />}
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: flag.type === "danger" ? "var(--rose)" : flag.type === "warn" ? "var(--amber)" : "var(--emerald)" }}>
                            {flag.label}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                            {flag.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {scannedProduct.ingredientsText && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Identified Ingredients:</span>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4, marginTop: "0.2rem" }}>
                        {scannedProduct.ingredientsText}
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Shelf Life & Proper Storage Method */}
                <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Thermometer size={16} color="var(--emerald)" /> Shelf Life & Storage Method[span_7](start_span)[span_7](end_span)
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.6rem" }}>
                    <div style={{ padding: "0.65rem", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.2rem" }}>Storage Method:</div>
                      <div style={{ fontSize: "0.85rem", color: "#fff" }}>{scannedProduct.storageTip}</div>
                    </div>

                    <div style={{ padding: "0.65rem", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.2rem" }}>Estimated Shelf Life:</div>
                      <div style={{ fontSize: "0.85rem", color: "#fff" }}>{scannedProduct.shelfLifeAdvice}</div>
                    </div>
                  </div>
                </div>

                {/* Review Jump Button */}
                <button 
                  onClick={() => setActiveTab("reviews")}
                  className="btn-action" 
                  style={{ gap: "0.5rem" }}
                >
                  <MessageSquare size={16} /> Open Community Ratings & Reviews
                </button>

              </div>
            )}

          </div>
        )}

        {/* 2. RATINGS & REVIEWS (STORED IN DATABASE) */}
        {activeTab === "reviews" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Community Product Reviews[span_8](start_span)[span_8](end_span)</h3>
                <p style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Verified customer ratings stored directly in database for other shoppers[span_9](start_span)[span_9](end_span).
                </p>
              </div>

              {scannedProduct ? (
                <div style={{ padding: "0.75rem", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Current Product:</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>{scannedProduct.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem" }}>
                    <Star size={14} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{averageRating > 0 ? averageRating : "No ratings yet"}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>({reviews.length} reviews)</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "0.75rem", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Scan a barcode in the Safety Scanner tab to post or view product-specific reviews.
                </div>
              )}

              {/* Review Submission Form */}
              {scannedProduct && (
                <form onSubmit={handleReviewSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>Select Rating (1-5 Stars):</label>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setNewRating(star)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "0.2rem"
                          }}
                        >
                          <Star 
                            size={24} 
                            fill={star <= newRating ? "#fbbf24" : "transparent"} 
                            color={star <= newRating ? "#fbbf24" : "var(--text-muted)"} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea 
                    placeholder="Write your review on product freshness, taste, and packaging..."
                    value={newReviewText}
                    onChange={e => setNewReviewText(e.target.value)}
                    rows={3}
                    className="form-input"
                    style={{ resize: "vertical" }}
                    required
                  />

                  <button 
                    type="submit" 
                    disabled={isSubmittingReview} 
                    className="btn-action" 
                    style={{ height: "42px", fontSize: "0.88rem" }}
                  >
                    {isSubmittingReview ? "Saving Review..." : "Submit Review to Database"}
                  </button>
                </form>
              )}

              {/* Review Feed */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 600 }}>Recent Reviews</h4>

                {reviews.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    No reviews logged yet. Be the first to add one!
                  </p>
                ) : (
                  reviews.map(r => (
                    <div key={r.id} style={{ padding: "0.75rem", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff" }}>{r.user_email}</span>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {[...Array(r.rating)].map((_, i) => (
                            <Star key={i} size={12} fill="#fbbf24" color="#fbbf24" />
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.35 }}>{r.review_text}</p>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>
        )}

        {/* 3. CUSTOMER CARE & PERMISSIONS */}
        {activeTab === "support" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            {/* Customer Care Channels */}
            <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Customer Care[span_10](start_span)[span_10](end_span)</h3>
                <p style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Reach out directly for assistance, missing items, or food safety questions[span_11](start_span)[span_11](end_span).
                </p>
              </div>

              <a 
                href="tel:+919129958865" 
                style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "0.85rem", borderRadius: "8px" }}
              >
                <Phone size={18} color="var(--emerald)" />
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Phone Hotline[span_12](start_span)[span_12](end_span)</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>+91 91299 58865[span_13](start_span)[span_13](end_span)</div>
                </div>
              </a>

              <a 
                href="mailto:anaadigeet75@gmail.com" 
                style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "0.85rem", borderRadius: "8px" }}
              >
                <Mail size={18} color="#ffffff" />
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Gmail Desk[span_14](start_span)[span_14](end_span)</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>anaadigeet75@gmail.com</div>
                </div>
              </a>
            </div>

            {/* Basic Permissions */}
            <div className="clean-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Basic Permissions[span_15](start_span)[span_15](end_span)</h3>
                <p style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Manage notifications and camera access on your device[span_16](start_span)[span_16](end_span).
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Bell size={18} color="var(--text-muted)" />
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Notifications[span_17](start_span)[span_17](end_span)</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Receive alerts on product safety updates and deals</div>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={notificationsEnabled} 
                  onChange={e => setNotificationsEnabled(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#ffffff" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Camera size={18} color="var(--text-muted)" />
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Camera / Gallery Access[span_18](start_span)[span_18](end_span)</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Allows on-device barcode scanning[span_19](start_span)[span_19](end_span)</div>
                  </div>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--emerald)", fontWeight: 600 }}>Permitted</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
