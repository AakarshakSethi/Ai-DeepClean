import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { connectGmail } from "../api/auth";
import { FiMail, FiArrowLeft, FiLoader } from "react-icons/fi";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter a valid Gmail address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Connect to backend Gmail connection oauth endpoint
      const data = await connectGmail(email.trim());
      if (data.error) {
        setError(data.error);
      } else {
        // Save user info to localStorage
        localStorage.setItem("deepclean_user_id", data.user_id);
        localStorage.setItem("deepclean_user_email", email.trim());
        localStorage.setItem("deepclean_user_plan", data.plan);
        // Redirect to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Failed to connect Gmail. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
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
                Please complete the Google OAuth sign-in in the local browser window that just popped up.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Gmail Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <FiMail size={18} />
                </div>
                <input
                  type="email"
                  id="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#151A28] border border-[#2E3B52] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-violet-600/25 transition-all hover:scale-[1.01]"
            >
              Sign In & Connect Gmail
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-[10px] text-gray-500 leading-relaxed border-t border-gray-800/40 pt-4">
          By signing in, you authorize DeepClean to request access to read headers and trash unwanted items on your behalf.
        </div>
      </div>
    </div>
  );
}