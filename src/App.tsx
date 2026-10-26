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
  Loader2 
} from "lucide-react";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [roleSelection, setRoleSelection] = useState<"CONSUMER" | "SHOPKEEPER">("CONSUMER");
  const [savingRole, setSavingRole] = useState(false);

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
    } finally {
      setLoading(false);
    }
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
    } else {
      alert(`Role Save Error: ${error.message}`);
    }
    setSavingRole(false);
  };

  const handleSignOut = () => supabase.auth.signOut();

  // 1. Initial Loading
  if (loading) {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <Loader2 className="animate-spin text-muted" size={24} />
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
            gap: "1.75rem",
            textAlign: "center"
          }}
        >
          {/* Logo Badge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div 
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem"
              }}
            >
              <Store size={24} color="#000000" />
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.03em" }}>
              Quick Pick
            </h1>
            <p style={{ marginTop: "0.35rem", fontSize: "0.88rem", color: "#8e8e93" }}>
              Autonomous retail intelligence & fast operations.
            </p>
          </div>

          {/* Full-Width Google Button */}
          <button 
            onClick={handleGoogleLogin} 
            style={{
              width: "100%",
              height: "50px",
              backgroundColor: "#ffffff",
              color: "#000000",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.95rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              cursor: "pointer"
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
              borderTop: "1px solid #222226",
              paddingTop: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
              <div 
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: "#141416",
                  border: "1px solid #222226",
                  borderRadius: "8px",
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
                <h3 style={{ fontSize: "0.92rem", fontWeight: 600, color: "#ffffff" }}>Live Sales Trends</h3>
                <p style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: "0.15rem" }}>
                  Real-time revenue monitoring and turnover metrics in ₹ (INR).
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
              <div 
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: "#141416",
                  border: "1px solid #222226",
                  borderRadius: "8px",
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
                <h3 style={{ fontSize: "0.92rem", fontWeight: 600, color: "#ffffff" }}>Free Barcode Scanner</h3>
                <p style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: "0.15rem" }}>
                  Scan barcodes to auto-populate product names instantly.
                </p>
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

  // 4. Mount Shopkeeper Dashboard
  if (profile.role === "SHOPKEEPER") {
    return <ShopkeeperDashboard session={session} onSignOut={handleSignOut} />;
  }

  // 5. Mount Consumer Dashboard
  return <ConsumerDashboard session={session} onSignOut={handleSignOut} />;
}
