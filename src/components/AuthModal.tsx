import React from "react";
import { Mail, LockKeyhole, X, LogIn, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.25-.2-1.8H12v3.27h5.52c-.11.81-.71 2.03-2.04 2.85l-.02.11 2.97 2.3.21.02c1.94-1.79 2.96-4.43 2.96-6.75Z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.63-2.42l-3.16-2.44c-.85.59-1.99 1-3.47 1-2.6 0-4.8-1.76-5.59-4.2l-.1.01-3.08 2.38-.04.1C4.84 19.71 8.18 22 12 22Z"/>
      <path fill="#FBBC05" d="M6.41 13.94A6.12 6.12 0 0 1 6.08 12c0-.67.12-1.31.32-1.94l-.01-.13-3.12-2.42-.1.05A10 10 0 0 0 2 12c0 1.6.38 3.11 1.05 4.44l3.36-2.5Z"/>
      <path fill="#EA4335" d="M12 5.86c1.88 0 3.15.81 3.87 1.47l2.82-2.75C16.96 2.97 14.7 2 12 2 8.18 2 4.84 4.29 3.19 7.56l3.22 2.5c.8-2.44 2.99-4.2 5.59-4.2Z"/>
    </svg>
  );
}

export function AuthModal({ open, onClose }: Props) {
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  if (!open) return null;

  const googleLogin = async () => {
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!email || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. Check your email if confirmation is enabled.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="auth-card" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button>

        <span className="auth-kicker">MYTRAVELPLANNER</span>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p>{mode === "login" ? "Login to use AI planning and save trips." : "Create an account to save and reopen your trips."}</p>

        <button className="google-auth-btn" disabled={busy} onClick={googleLogin}>
          <GoogleIcon /> Continue with Google
        </button>

        <div className="auth-divider"><span>or use email</span></div>

        <label className="auth-field">
          <Mail size={18}/>
          <input type="email" placeholder="Email address" value={email} onChange={(e)=>setEmail(e.target.value)}/>
        </label>

        <label className="auth-field">
          <LockKeyhole size={18}/>
          <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)}/>
        </label>

        {message && <div className="auth-message">{message}</div>}

        <button className="auth-submit" disabled={busy} onClick={submit}>
          {mode === "login" ? <LogIn size={18}/> : <UserPlus size={18}/>}
          {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>

        <button className="auth-switch" onClick={()=>{
          setMode(mode === "login" ? "signup" : "login");
          setMessage("");
        }}>
          {mode === "login" ? "New here? Create account" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}
