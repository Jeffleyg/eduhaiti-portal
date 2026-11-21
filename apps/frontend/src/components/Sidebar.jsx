import React, { useState } from "react"
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext.jsx"
import { isExactNavItem, navForRole, roleLabelKey } from "./navigation.js"
import BrandLogo from "./BrandLogo.jsx"

/**
 * Role navigation. `variant="drawer"` is the mobile off-canvas version: no
 * collapse toggle and no fixed viewport height (the drawer scrolls itself).
 */
function Sidebar({ role, variant = "panel" }) {
  const { t } = useTranslation()
  const [collapsedState, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()
  const inDrawer = variant === "drawer"
  const collapsed = inDrawer ? false : collapsedState
  const navItems = navForRole(role)

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <aside
      aria-label={t("mainNavigation")}
      className={
        inDrawer
          ? "flex h-full flex-col gap-5"
          : `glass-panel sticky top-6 flex h-[calc(100vh-3rem)] flex-col gap-5 overflow-hidden rounded-3xl px-4 py-5 transition-[width] duration-200 ${
              collapsed ? "w-16" : "w-64 xl:w-72"
            }`
      }
    >
      {/* Collapsed (32px of usable width): symbol above the expand button. */}
      <div className={`flex shrink-0 gap-2 ${collapsed ? "flex-col items-center" : "items-center justify-between"}`}>
        <div className="flex min-w-0 items-center gap-3">
          {collapsed ? (
            <BrandLogo variant="mark" alt={t("brand")} className="h-8 shrink-0" />
          ) : (
            <div className="min-w-0">
              <h2>
                <BrandLogo alt={t("brand")} className="h-8" />
              </h2>
              <p className="mt-1 truncate pl-0.5 text-xs font-medium text-brand-navy/70">{t(roleLabelKey(role))}</p>
            </div>
          )}
        </div>

        {!inDrawer ? (
          <button
            type="button"
            onClick={() => setCollapsed((s) => !s)}
            className="rounded-full p-1 text-brand-navy/70 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1 pt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={isExactNavItem(item.to)}
            title={collapsed ? t(item.labelKey) : undefined}
            aria-label={collapsed ? t(item.labelKey) : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky ${
                isActive ? "bg-brand-navy text-white shadow-sm" : "text-brand-navy/90 hover:bg-white/60"
              } ${collapsed ? "justify-center px-0" : ""}`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed ? <span className="truncate">{t(item.labelKey)}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-brand-navy/10 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-brand-navy/70 transition-colors hover:bg-brand-red/10 hover:text-brand-red focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? t("logout") : undefined}
          aria-label={collapsed ? t("logout") : undefined}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {!collapsed ? t("logout") : null}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
