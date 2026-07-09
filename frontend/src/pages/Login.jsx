import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { connectGmail } from "../api/auth";
import { FiMail, FiArrowLeft, FiLoader } from "react-icons/fi";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "missing_permissions") {
      setError("You must check the box to grant Gmail permissions during sign-in.");
    }
    
    if (searchParams.get("auth") === "success") {
      const userEmail = searchParams.get("email");
      if (userEmail) {
        // We need the user_id, which we could fetch, but for simplicity let's assume 
        // the backend returned it or we can fetch it via /auth/me
        const fetchMe = async () => {
          try {
            const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${backendUrl}/auth/me?user_email=${encodeURIComponent(userEmail)}`);
            const data = await res.json();
            if (data && data.id) {
              localStorage.setItem("deepclean_user_id", data.id);
              localStorage.setItem("deepclean_user_email", data.email);
              localStorage.setItem("deepclean_user_plan", data.plan);
              navigate("/dashboard");
            } else {
              setError("Failed to retrieve user profile after login.");
            }
          } catch (e) {
            setError("Failed to retrieve user profile after login.");
          }
        };
        fetchMe();
      }
    }
  }, [searchParams, navigate]);

  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Redirect to the backend login endpoint to start the Web OAuth flow
    const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
    window.location.href = `${backendUrl}/auth/google/login?frontend_url=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-center items-center px-4 relative">
      
      {/* Back Link */}
      <Link
        to="/"
        className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-2 text-sm transition-colors"
      >
        <FiArrowLeft size={16} />
        Back to Home
      </Link>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-white">Connect Your Gmail</h2>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">
            DeepClean reads email headers to classify spam and OTPs. We never view or store email body contents.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl p-4 mb-6 leading-relaxed">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <FiLoader className="text-violet-500 animate-spin" size={40} />
            <div>
              <p className="text-sm font-semibold text-white">Connecting Gmail...</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[280px]">
                Please complete the Google OAuth sign-in in the secure browser window.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3.5 rounded-xl shadow-lg transition-all hover:scale-[1.02]"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="w-5 h-5" />
              Sign in with Google
            </button>
          </div>
        )}

        <div className="mt-8 text-center text-[10px] text-gray-500 leading-relaxed border-t border-gray-800/40 pt-4">
          By signing in, you authorize DeepClean to request access to read headers and trash unwanted items on your behalf.
        </div>
      </div>
    </div>
  );
}