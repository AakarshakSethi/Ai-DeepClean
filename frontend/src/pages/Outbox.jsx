import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiInbox,
  FiClock,
  FiArrowLeft,
  FiPaperclip,
  FiTrash2,
  FiAlertCircle,
  FiCheckCircle
} from "react-icons/fi";

export default function Outbox() {
  const [outboxEmails, setOutboxEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchOutbox = () => {
    const history = JSON.parse(localStorage.getItem("deepclean_outbox_history") || "[]");
    setOutboxEmails(history);
  };

  useEffect(() => {
    fetchOutbox();
  }, []);

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your local outbox history?")) {
      localStorage.removeItem("deepclean_outbox_history");
      setOutboxEmails([]);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
              <FiInbox className="text-violet-400" />
              App Outbox
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                App Sent History
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Local log of all emails composed and dispatched directly via the DeepClean client.
            </p>
          </div>

          {outboxEmails.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 bg-red-950/20 border border-red-500/20 text-red-400 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <FiTrash2 size={14} />
              Clear Log History
            </button>
          )}
        </div>

        {outboxEmails.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl border border-gray-800 space-y-4 max-w-xl mx-auto mt-6">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
              <FiInbox size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Outbox is Empty</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              No locally sent messages found. Composed emails sent using the floating compose pencil on the dashboard will be logged here.
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-850 bg-gray-900/40 text-gray-400 uppercase tracking-wider select-none text-[10px] font-bold">
                    <th className="py-4 px-6">Recipient</th>
                    <th className="py-4 px-6">Subject</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850/40">
                  {outboxEmails.map((email) => (
                    <tr
                      key={email.id}
                      onClick={() => {
                        setSelectedEmail(email);
                        setShowModal(true);
                      }}
                      className="hover:bg-white/5 transition-colors cursor-pointer text-gray-300"
                    >
                      <td className="py-4 px-6 font-semibold text-white max-w-[150px] truncate">
                        {email.recipient}
                      </td>
                      <td className="py-4 px-6 font-medium text-violet-300 max-w-[200px] truncate">
                        {email.subject}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          email.status === "Sent" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {email.status === "Sent" ? <FiCheckCircle size={10} /> : <FiAlertCircle size={10} />}
                          {email.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-450 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FiClock size={12} className="text-gray-500" />
                          {email.date}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Local Outbox Details Modal (White/Clean layout like the dashboard modal) */}
        {showModal && selectedEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#FFFFFF] text-[#202124] w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl border border-gray-300">
              
              {/* Top control bar */}
              <div className="bg-[#F2F6FC] px-6 py-3.5 flex justify-between items-center border-b border-gray-250 select-none">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEmail(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <FiArrowLeft size={14} />
                  Back to List
                </button>
                <div className="text-[10px] font-bold text-gray-400 bg-gray-200/80 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                  Outbox Details
                </div>
              </div>

              {/* Main Content Area */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 bg-white">
                <div className="space-y-6">
                  {/* Header Details */}
                  <div className="border-b border-gray-150 pb-5">
                    <div className="flex justify-between items-start gap-4">
                      <h2 className="text-lg md:text-xl font-bold text-[#1a0dab] tracking-tight leading-snug">
                        {selectedEmail.subject}
                      </h2>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                        selectedEmail.status === "Sent" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                        {selectedEmail.status}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-start gap-4 mt-4 flex-wrap text-xs text-gray-650">
                      <div className="space-y-0.5">
                        <p>
                          <span className="font-bold text-[#202124]">To:</span> {selectedEmail.recipient}
                        </p>
                      </div>
                      <p className="text-gray-500 font-mono text-[11px]">{selectedEmail.date}</p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="bg-[#FFFFFF] border border-gray-200 rounded-xl p-4 md:p-6 min-h-[200px] shadow-inner text-sm text-[#202124] whitespace-pre-wrap leading-relaxed font-sans">
                    {selectedEmail.body || "(No message body)"}
                  </div>

                  {/* Attachments indicators */}
                  {selectedEmail.attachmentsCount > 0 && (
                    <div className="border-t border-gray-150 pt-5 space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <FiPaperclip size={14} className="text-gray-500" />
                        Attachments Count
                      </h4>
                      <p className="text-xs text-gray-550">
                        This message was sent with <span className="font-bold text-gray-800">{selectedEmail.attachmentsCount}</span> file attachment(s).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#F2F6FC] px-6 py-3.5 flex justify-end border-t border-gray-250">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEmail(null);
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
