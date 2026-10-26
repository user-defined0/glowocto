import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import ShopkeeperDashboard from "./components/ShopkeeperDashboard";
import ConsumerDashboard from "./components/ConsumerDashboard";
import { 
  Store, 
  User, 
  BarChart2, 
  ScanLine, 
  ArrowRight, 
  Loader2,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  AlertCircle
} from "lucide-react";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [roleSelection, setRoleSelection] = useState<"CONSUMER" | "SHOPKEEPER">("CONSUMER");
  const [savingRole, setSavingRole] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Detect and cleanly handle OAuth URL errors (bad_oauth_state)
    const params = new URLSearchParams(window.location.search);
    const errorDesc = params.get("error_description");
    if (errorDesc) {
      setOauthError(errorDesc.replace(/\+/g, " "));
      // Clean url without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Fetch session and subscribe to auth state
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
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthError(null);
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
    } else {
      alert(`Role Save Error: ${error.message}`);
    }
    setSavingRole(false);
  };

  const handleSignOut = () => supabase.auth.signOut();

  // 1. Loading State
  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
        color: "#ffffff"
      }}>
        <Loader2 className="animate-spin" size={28} color="#6366f1" />
        <span style={{ marginTop: "0.85rem", fontSize: "0.85rem", color: "#8e8e93" }}>
          Synchronizing Quick Pick...
        </span>
      </div>
    );
  }

  // 2. Auth Login Screen
  if (!session) {
    return (
      <div 
        style={{
          minHeight: "100dvh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem 1.25rem",
          backgroundColor: "#000000",
          boxSizing: "border-box"
        }}
      >
        <div 
          style={{
            width: "100%",
            maxWidth: "380px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
            textAlign: "center"
          }}
        >
          {/* Logo Badge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div 
              style={{
                width: "50px",
                height: "50px",
                backgroundColor: "#ffffff",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
                boxShadow: "0 0 25px rgba(255, 255, 255, 0.2)"
              }}
            >
              <Store size={26} color="#000000" />
            </div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.03em" }}>
              Quick Pick
            </h1>
            <p style={{ marginTop: "0.35rem", fontSize: "0.88rem", color: "#8e8e93" }}>
              Autonomous retail intelligence & fast operations.
            </p>
          </div>

          {/* OAuth Expiration Alert Banner */}
          {oauthError && (
            <div style={{
              width: "100%",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "12px",
              padding: "0.75rem 1rem",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              color: "#fca5a5",
              fontSize: "0.8rem"
            }}>
              <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
              <div>
                <strong>Sign-in session expired.</strong> Please click below to try again.
              </div>
            </div>
          )}

          {/* Full-Width Google Button */}
          <button 
            onClick={handleGoogleLogin} 
            style={{
              width: "100%",
              height: "50px",
              backgroundColor: "#ffffff",
              color: "#000000",
              border: "none",
              borderRadius: "14px",
              fontSize: "0.95rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              cursor: "pointer",
              transition: "transform 0.15s ease",
              boxShadow: "0 4px 20px rgba(255, 255, 255, 0.12)"
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Feature Showcase Stack */}
          <div 
            style={{
              width: "100%",
              borderTop: "1px solid #1a1a1f",
              paddingTop: "1.35rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
              <div 
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: "#111114",
                  border: "1px solid #222226",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  flexShrink: 0
                }}
              >
                <BarChart2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "0.92rem", fontWeight: 600, color: "#ffffff", margin: 0 }}>Live Sales Trends</h3>
                <p style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: "0.15rem", margin: 0 }}>
                  Real-time revenue monitoring and turnover metrics in ₹ (INR).
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
              <div 
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: "#111114",
                  border: "1px solid #222226",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  flexShrink: 0
                }}
              >
                <ScanLine size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "0.92rem", fontWeight: 600, color: "#ffffff", margin: 0 }}>Free Barcode Scanner</h3>
                <p style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: "0.15rem", margin: 0 }}>
                  Scan barcodes to auto-populate product names instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Redesigned Premium OLED Role Selection Screen
  if (!profile?.role) {
    return (
      <div style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem 1rem",
        backgroundColor: "#000000",
        color: "#ffffff",
        boxSizing: "border-box"
      }}>
        <div style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem"
        }}>
          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#818cf8",
              background: "rgba(129, 140, 248, 0.12)",
              padding: "0.25rem 0.65rem",
              borderRadius: "999px",
              border: "1px solid rgba(129, 140, 248, 0.3)"
            }}>
              Onboarding
            </span>
            <h1 style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              marginTop: "0.75rem"
            }}>
              Select Your Workspace
            </h1>
            <p style={{ fontSize: "0.86rem", color: "#8e8e93", marginTop: "0.25rem" }}>
              How do you plan to use Quick Pick today?
            </p>
          </div>

          {/* Selection Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            
            {/* Card 1: Consumer Role */}
            <div 
              onClick={() => setRoleSelection("CONSUMER")}
              style={{
                cursor: "pointer",
                padding: "1.25rem",
                borderRadius: "18px",
                background: roleSelection === "CONSUMER" 
                  ? "rgba(99, 102, 241, 0.1)" 
                  : "#09090c",
                border: roleSelection === "CONSUMER"
                  ? "2px solid #6366f1"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: roleSelection === "CONSUMER"
                  ? "0 0 25px -5px rgba(99, 102, 241, 0.3)"
                  : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            >
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: roleSelection === "CONSUMER"
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <ShoppingBag size={22} color="#ffffff" />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    Household Consumer
                  </h3>
                  {roleSelection === "CONSUMER" && (
                    <CheckCircle2 size={18} color="#6366f1" />
                  )}
                </div>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.3rem", margin: "0.3rem 0 0 0", lineHeight: 1.4 }}>
                  Personal grocery log, pantry shelf-life tracking, and instant food safety AI reviews.
                </p>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem" }}>
                  <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                    • Pantry Tracker
                  </span>
                  <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                    • AI Nutritionist
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Shopkeeper Role */}
            <div 
              onClick={() => setRoleSelection("SHOPKEEPER")}
              style={{
                cursor: "pointer",
                padding: "1.25rem",
                borderRadius: "18px",
                background: roleSelection === "SHOPKEEPER" 
                  ? "rgba(245, 158, 11, 0.08)" 
                  : "#09090c",
                border: roleSelection === "SHOPKEEPER"
                  ? "2px solid #f59e0b"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: roleSelection === "SHOPKEEPER"
                  ? "0 0 25px -5px rgba(245, 158, 11, 0.25)"
                  : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            >
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: roleSelection === "SHOPKEEPER"
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <Store size={22} color="#ffffff" />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    Retail Storekeeper
                  </h3>
                  {roleSelection === "SHOPKEEPER" && (
                    <CheckCircle2 size={18} color="#f59e0b" />
                  )}
                </div>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.3rem", margin: "0.3rem 0 0 0", lineHeight: 1.4 }}>
                  Camera barcode scanner, inventory stock alarms, daily revenue analytics, and WhatsApp billing.
                </p>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem" }}>
                  <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                    • Barcode POS
                  </span>
                  <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                    • Revenue Charts
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Continue Action Button */}
          <button 
            onClick={saveRole} 
            disabled={savingRole}
            style={{
              width: "100%",
              height: "50px",
              background: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)",
              color: "#000000",
              border: "none",
              borderRadius: "14px",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: savingRole ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              marginTop: "0.25rem",
              boxShadow: "0 6px 20px rgba(255, 255, 255, 0.15)",
              transition: "transform 0.15s ease"
            }}
          >
            {savingRole ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Initializing Workspace...
              </>
            ) : (
              <>
                Enter Workspace <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 4. Mount Shopkeeper Dashboard
  if (profile.role === "SHOPKEEPER") {
    return <ShopkeeperDashboard session={session} onSignOut={handleSignOut} />;
  }

  // 5. Mount Consumer Dashboard
  return <ConsumerDashboard session={session} onSignOut={handleSignOut} />;
}
