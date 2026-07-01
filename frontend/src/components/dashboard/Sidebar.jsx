import { useLocation, Link } from "react-router-dom";
import {
  FiInbox,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiCheckSquare,
  FiX,
  FiAward,
  FiBell
} from "react-icons/fi";
import { useEffect, useState } from "react";
import { getPlan } from "../../api/billing";

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const [planInfo, setPlanInfo] = useState({ plan: "free" });
  const userId = localStorage.getItem("deepclean_user_id");
  const userEmail = localStorage.getItem("deepclean_user_email") || "User";

  useEffect(() => {
    if (userId) {
      getPlan(userId)
        .then((data) => {
          if (!data.error) setPlanInfo(data);
        })
        .catch(() => {});
    }
  }, [userId, location.pathname]);

  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: FiInbox },
    { name: "Review-30", path: "/review", icon: FiTrash2 },
    { name: "Bin", path: "/bin", icon: FiTrash2 },
    { name: "AI Search", path: "/search", icon: FiSearch },
    { name: "Surveys", path: "/survey", icon: FiCheckSquare },
    { name: "Unsubscribe", path: "/unsubscribe", icon: FiBell, badge: true },
    { name: "Settings", path: "/settings", icon: FiSettings },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#111827] border-r border-[#2A3042] flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-6 border-b border-[#2A3042] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-500 to-indigo-500 text-transparent bg-clip-text">
              DeepClean
            </span>
            <span className="text-xs bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded font-medium">
              AI
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">for Gmail Inbox</p>
        </div>

        {/* Close Button on Mobile */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setIsOpen(false)}
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Menu Options */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)} // Close drawer on navigation
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-violet-600/90 text-white font-medium shadow-md shadow-violet-600/25 border border-violet-500/20"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className={isActive ? "text-white" : "text-gray-400"} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-1 animate-pulse"></span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-[#2A3042] p-5 space-y-4">
        {/* User profile & Plan status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300">
            {userEmail[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{userEmail}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FiAward className="text-violet-400" size={12} />
              <span className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">
                {planInfo.plan === "pro" ? "Pro Plan" : "Free Plan"}
              </span>
            </div>
          </div>
        </div>

        {/* Gmail status check */}
        <div className="bg-[#151A28] border border-[#2A3042] rounded-xl p-3">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            Gmail Status
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-emerald-400 font-medium">Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
}