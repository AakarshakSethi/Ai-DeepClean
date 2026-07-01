import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { searchEmails } from "../api/search";
import { approveAction } from "../api/cleanup";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiSearch,
  FiAlertCircle,
  FiRotateCcw,
  FiMail,
  FiClock,
  FiCheckCircle,
  FiLoader
} from "react-icons/fi";

function formatBytes(bytes) {
  if (!bytes) return "0.00 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function Search() {
  const userId = localStorage.getItem("deepclean_user_id");
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Extract query from URL parameters if navigated from topbar
  const runUrlSearch = async (searchQuery) => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await searchEmails(userId, searchQuery);
      setResults(res);
    } catch (e) {
      console.error(e);
      setError("Search query failed. Please make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) {
      setQuery(q);
      runUrlSearch(q);
    }
  }, [location.search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      runUrlSearch(query.trim());
    }
  };

  const handleRestore = async (emailId, subject) => {
    try {
      await approveAction(userId, emailId, "restore");
      setSuccessMsg(`"${subject}" was restored successfully!`);
      
      // Remove email from deleted notices list in state
      if (results && results.deleted_notice) {
        const updatedNotices = results.deleted_notice.filter((n) => n.id !== emailId);
        
        // Find the restored email data in notices
        const restoredEmail = results.deleted_notice.find((n) => n.id === emailId);
        let updatedMatches = [...(results.matches || [])];
        if (restoredEmail) {
          updatedMatches.push({
            id: restoredEmail.id,
            subject: restoredEmail.subject,
            sender: restoredEmail.sender || "Unknown",
            date: restoredEmail.date || "Just now",
            category: restoredEmail.category || "uncategorized",
            size_bytes: restoredEmail.size_bytes || 0
          });
        }

        setResults({
          ...results,
          deleted_notice: updatedNotices,
          matches: updatedMatches
        });
      }
      
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      console.error(e);
      alert("Failed to restore email. Please try again.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">AI Search</h1>
          <p className="text-xs text-gray-400 mt-1">
            Search your synced email archives in plain English. Learn if matching emails were deleted.
          </p>
        </div>

        {/* Search bar inside the page */}
        <form onSubmit={handleSearchSubmit} className="glass-panel p-4 rounded-2xl border border-gray-800">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search e.g. 'Myntra invoices', 'Facebook notifications', 'LinkedIn OTPs'..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#151A28] border border-[#2E3B52] rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-gray-500 outline-none focus:border-violet-500 transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all hover:scale-[1.01]"
            >
              Search
            </button>
          </div>
        </form>

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl p-4 flex items-center gap-2">
            <FiCheckCircle size={16} />
            {successMsg}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl p-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
            <FiLoader className="animate-spin text-violet-500" size={28} />
            <p className="text-xs">Analyzing archives...</p>
          </div>
        ) : (
          results && (
            <div className="space-y-6">
              
              {/* Deleted Notices Alert Banners */}
              {results.deleted_notice && results.deleted_notice.length > 0 && (
                <div className="space-y-3">
                  {results.deleted_notice.map((notice) => (
                    <div
                      key={notice.id}
                      className="glass-panel p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <FiAlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                        <div>
                          <p className="font-bold text-white">Deleted Mail Detected</p>
                          <p className="text-gray-400 mt-1">
                            "{notice.subject}" was deleted.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRestore(notice.id, notice.subject)}
                        className="flex items-center gap-1 bg-red-650 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-xl transition-all"
                      >
                        <FiRotateCcw size={12} />
                        Restore Mail
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Active matches list */}
              <div className="glass-panel p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-white border-b border-gray-800 pb-3 mb-4 flex justify-between">
                  <span>Search Matches</span>
                  <span className="text-xs text-gray-400 font-normal">
                    {results.matches ? results.matches.length : 0} items found
                  </span>
                </h3>

                <div className="space-y-3">
                  {results.matches && results.matches.length > 0 ? (
                    results.matches.map((email) => (
                      <div
                        key={email.id}
                        className="glass-card p-4 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="overflow-hidden flex-1">
                          <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                          <p className="text-xs text-gray-400 mt-1 truncate">{email.sender}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded font-bold">
                              {email.category}
                            </span>
                            {email.size_bytes > 0 && (
                              <span className="text-[10px] text-gray-500">
                                {formatBytes(email.size_bytes)}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500">•</span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <FiClock size={10} />
                              {email.date}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500 text-xs">
                      No active emails matched your search. Try searching for other senders or keywords.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}