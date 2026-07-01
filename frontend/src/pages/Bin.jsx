import { useState, useEffect } from "react";
import { getBinEmails } from "../api/emails";
import { approveAction } from "../api/cleanup";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiLoader,
  FiTrash2,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock
} from "react-icons/fi";

export default function Bin() {
  const userId = localStorage.getItem("deepclean_user_id");
  const [deletedEmails, setDeletedEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  const fetchBinEmails = async () => {
    setLoading(true);
    try {
      const data = await getBinEmails(userId);
      setDeletedEmails(data.emails || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBinEmails();
  }, [userId]);

  const handleRestore = async (emailId) => {
    setRestoringId(emailId);
    try {
      // Call restore action on backend
      await approveAction(userId, emailId, "restore");
      alert("Email restored successfully! It has been moved back to your Gmail Inbox.");
      // Refresh list
      await fetchBinEmails();
    } catch (e) {
      console.error(e);
      alert("Failed to restore email. Please try again.");
    } finally {
      setRestoringId(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "0 KB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            Bin / Trash
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Deleted Items
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Items in the Bin are permanently deleted by Google after 30 days. You can restore them back to your inbox before then.
          </p>
        </div>

        {/* Info Warn banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
          <FiAlertTriangle className="shrink-0 text-amber-400 mt-0.5" size={16} />
          <div>
            <span className="font-bold">30-Day Auto-Purge Policy:</span> The emails listed below have been trashed in your Gmail account. They will be permanently deleted from your Google storage automatically after 30 days.
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-gray-400">
            <FiLoader className="animate-spin text-violet-500 mb-4" size={28} />
            <p className="text-sm">Loading bin items...</p>
          </div>
        ) : deletedEmails.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl border border-gray-800 space-y-4 max-w-xl mx-auto mt-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <FiCheckCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Bin is Empty!</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              No deleted emails found in your local trash history. Any emails you delete on the Dashboard or surveys will appear here.
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#151A28] border-b border-gray-850 text-gray-400 font-bold">
                    <th className="p-4 w-1/2">Subject & Sender</th>
                    <th className="p-4 text-center">Remaining Days</th>
                    <th className="p-4 text-center">Size</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850">
                  {deletedEmails.map((email) => {
                    const isRestoring = restoringId === email.id;
                    const isWarningDays = email.days_left <= 7;
                    
                    return (
                      <tr key={email.id} className="hover:bg-gray-800/35 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white truncate max-w-xs md:max-w-md">{email.subject}</p>
                          <p className="text-gray-405 text-[11px] mt-0.5 truncate max-w-xs md:max-w-md">{email.sender}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                              isWarningDays
                                ? "bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                            }`}
                          >
                            <FiClock size={10} />
                            {email.days_left} days left
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-450 font-semibold font-mono">
                          {formatBytes(email.size_bytes)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleRestore(email.id)}
                            disabled={isRestoring}
                            className="bg-violet-600/15 hover:bg-violet-600 border border-violet-500/25 text-violet-400 hover:text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ml-auto"
                          >
                            <FiRefreshCw size={12} className={isRestoring ? "animate-spin" : ""} />
                            {isRestoring ? "Restoring..." : "Restore"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
