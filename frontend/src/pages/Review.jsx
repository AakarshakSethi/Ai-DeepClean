import { useState, useEffect } from "react";
import { getReviewBatch, approveAction, completeBatch } from "../api/cleanup";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiTrash2,
  FiArchive,
  FiCheck,
  FiClock,
  FiZap,
  FiCheckCircle,
  FiTrendingUp,
  FiChevronRight
} from "react-icons/fi";

function formatBytes(bytes) {
  if (!bytes) return "0.00 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function Review() {
  const userId = localStorage.getItem("deepclean_user_id");

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Track actions chosen: { [emailId]: "delete" | "archive" | "keep" | "snooze" }
  const [decisions, setDecisions] = useState({});
  const [inProgress, setInProgress] = useState({}); // { [emailId]: true } during API call
  const [batchCompleted, setBatchCompleted] = useState(false);
  const [freedStats, setFreedStats] = useState({ batchNumber: 1, freedBytes: 0 });

  const fetchBatch = async () => {
    setLoading(true);
    setError("");
    setDecisions({});
    setBatchCompleted(false);
    try {
      const res = await getReviewBatch(userId);
      setCandidates(res.candidates || []);
    } catch (e) {
      console.error(e);
      setError("Failed to fetch review batch. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatch();
  }, [userId]);

  // Execute an action for a single email
  const handleAction = async (emailId, actionType, emailSizeBytes) => {
    setInProgress((prev) => ({ ...prev, [emailId]: true }));
    try {
      await approveAction(userId, emailId, actionType);
      setDecisions((prev) => ({ ...prev, [emailId]: actionType }));
    } catch (e) {
      console.error(e);
      alert("Failed to submit action. Please try again.");
    } finally {
      setInProgress((prev) => ({ ...prev, [emailId]: false }));
    }
  };

  // Complete batch action
  const handleCompleteBatch = async () => {
    // Calculate total freed bytes from deletions
    let totalFreed = 0;
    candidates.forEach((e) => {
      if (decisions[e.id] === "delete") {
        totalFreed += e.size_bytes;
      }
    });

    try {
      const res = await completeBatch(userId, totalFreed);
      setFreedStats({
        batchNumber: res.batch_number,
        freedBytes: totalFreed
      });
      setBatchCompleted(true);
    } catch (e) {
      console.error(e);
      alert("Failed to complete batch. Please try again.");
    }
  };

  const totalCandidates = candidates.length;
  const reviewedCount = Object.keys(decisions).length;
  const progressPercent = totalCandidates > 0 ? (reviewedCount / totalCandidates) * 100 : 0;
  const allReviewed = totalCandidates > 0 && reviewedCount === totalCandidates;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
          <FiZap className="animate-bounce text-violet-500" size={36} />
          <p className="text-sm font-semibold">Generating safely cleanable candidates...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl max-w-xl mx-auto mt-10">
          <h3 className="font-bold text-lg mb-2">Error</h3>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchBatch}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Success Celebration View
  if (batchCompleted) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-10 glass-panel p-8 rounded-3xl border border-violet-500/30 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl"></div>

          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle size={36} className="animate-pulse" />
          </div>

          <h2 className="text-2xl font-extrabold text-white">Batch #{freedStats.batchNumber} Done!</h2>
          <p className="text-xs text-gray-400 mt-2">Congratulations on clearing clutter from your inbox.</p>

          <div className="my-8 bg-[#151A28] border border-gray-800 rounded-2xl p-6">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Storage Space Freed</p>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-2">
              {formatBytes(freedStats.freedBytes)}
            </h3>
            <p className="text-[10px] text-gray-400 mt-2">Cleaned 30 emails from scanned batch candidates</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={fetchBatch}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-violet-600/25 transition-all hover:scale-[1.01]"
            >
              Start Next Batch
            </button>
            <button
              onClick={() => window.location.href = "/dashboard"}
              className="flex-1 border border-gray-700 hover:bg-gray-800 text-gray-300 font-semibold py-3 rounded-xl transition-all"
            >
              Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // No candidates found
  if (totalCandidates === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-10 glass-panel p-8 rounded-3xl border border-gray-800 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-6">
            <FiCheck size={28} />
          </div>
          <h2 className="text-xl font-bold text-white">Inbox Clean!</h2>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            No safely cleanable candidates are pending right now. Sync your inbox to look for newer emails, or adjust your settings.
          </p>
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: Candidate Cards Deck */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white">Review-30 Queue</h1>
              <p className="text-xs text-gray-400 mt-1">
                AI has identified these {totalCandidates} emails as safest to clean. You decide their actions.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {candidates.map((email) => {
              const choice = decisions[email.id];
              const isLoading = inProgress[email.id];

              let cardStyle = "border-gray-850";
              if (choice === "delete") cardStyle = "border-red-500/30 bg-red-500/5";
              if (choice === "keep") cardStyle = "border-emerald-500/30 bg-emerald-500/5";
              if (choice === "archive") cardStyle = "border-amber-500/30 bg-amber-500/5";
              if (choice === "snooze") cardStyle = "border-slate-500/30 bg-slate-500/5";

              return (
                <div
                  key={email.id}
                  className={`glass-card p-5 rounded-2xl border transition-all duration-300 ${cardStyle} ${
                    choice ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="overflow-hidden flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                          Risk: {email.risk_score}/100
                        </span>
                        <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">
                          {email.category}
                        </span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-bold">
                          {formatBytes(email.size_bytes)}
                        </span>
                      </div>

                      <h3 className="text-sm md:text-base font-semibold text-white truncate">{email.subject}</h3>
                      <p className="text-xs text-gray-400 mt-1 truncate">{email.sender}</p>

                      <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"></span>
                        AI reason: {email.reason}
                      </p>
                    </div>

                    {/* Actions Deck */}
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-800">
                      {choice ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider border text-center w-full ${
                              choice === "delete"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : choice === "keep"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : choice === "archive"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                            }`}
                          >
                            Marked for {choice}
                          </span>
                          <button
                            onClick={() => {
                              const newDecisions = { ...decisions };
                              delete newDecisions[email.id];
                              setDecisions(newDecisions);
                            }}
                            className="text-xs text-violet-400 underline hover:text-white shrink-0"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:flex gap-1.5 w-full">
                          <button
                            onClick={() => handleAction(email.id, "delete", email.size_bytes)}
                            disabled={isLoading}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            title="Delete"
                          >
                            <FiTrash2 size={14} />
                            <span className="sm:inline">Delete</span>
                          </button>

                          <button
                            onClick={() => handleAction(email.id, "archive", email.size_bytes)}
                            disabled={isLoading}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 bg-amber-500/10 hover:bg-amber-500 border border-amber-500/20 text-amber-400 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            title="Archive"
                          >
                            <FiArchive size={14} />
                            <span className="sm:inline">Archive</span>
                          </button>

                          <button
                            onClick={() => handleAction(email.id, "keep", email.size_bytes)}
                            disabled={isLoading}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-400 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            title="Keep"
                          >
                            <FiCheck size={14} />
                            <span className="sm:inline">Keep</span>
                          </button>

                          <button
                            onClick={() => handleAction(email.id, "snooze", email.size_bytes)}
                            disabled={isLoading}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 bg-slate-700/35 hover:bg-slate-700 border border-slate-600/20 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            title="Snooze"
                          >
                            <FiClock size={14} />
                            <span className="sm:inline">Snooze</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Section: Progress & Summary Panel */}
        <div className="glass-panel p-6 rounded-2xl h-fit space-y-6">
          <h3 className="text-base font-bold text-white">Batch Progress</h3>

          {/* Progress gauge */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 font-medium">Reviewed Status</span>
              <span className="text-violet-400 font-bold">
                {reviewedCount} of {totalCandidates}
              </span>
            </div>
            <div className="w-full bg-[#151A28] border border-gray-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Action Tallies */}
          <div className="bg-[#151A28] border border-gray-850 rounded-xl p-4 space-y-3.5">
            <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-800 pb-2">
              Action Summary
            </h4>
            
            <div className="flex justify-between text-xs">
              <span className="text-red-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                Deletions
              </span>
              <span className="text-white font-bold">
                {Object.values(decisions).filter((v) => v === "delete").length}
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Archives
              </span>
              <span className="text-white font-bold">
                {Object.values(decisions).filter((v) => v === "archive").length}
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                Kept
              </span>
              <span className="text-white font-bold">
                {Object.values(decisions).filter((v) => v === "keep").length}
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                Snoozed
              </span>
              <span className="text-white font-bold">
                {Object.values(decisions).filter((v) => v === "snooze").length}
              </span>
            </div>
          </div>

          <button
            onClick={handleCompleteBatch}
            disabled={!allReviewed}
            className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold transition-all text-white ${
              allReviewed
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-600/25 hover:scale-[1.01]"
                : "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
            }`}
          >
            <span>Finish Batch</span>
            <FiChevronRight size={16} />
          </button>
          {!allReviewed && (
            <p className="text-[10px] text-gray-500 text-center italic">
              *Review all candidates to finish the batch and log storage metrics.
            </p>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}