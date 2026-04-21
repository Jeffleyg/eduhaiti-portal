import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar.jsx"
import TopBar from "./TopBar.jsx"
import { useSurvivalMode } from "../context/useSurvivalMode.js"

function AppShell({ role }) {
  const { disableImages, disableAnimations } = useSurvivalMode()

  return (
    <div className={`min-h-screen bg-sand text-brand-navy ${disableAnimations ? "survival-no-animations" : ""}`}>
      {disableImages ? null : <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-50" />}
      <div className="relative mx-auto flex min-h-screen max-w-7xl gap-6 px-6 py-8">
        <Sidebar role={role} />
        <div className="flex flex-1 flex-col gap-6">
          <TopBar role={role} />
          <main className="flex-1 rounded-3xl bg-white/80 p-6 shadow-xl shadow-brand-navy/10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default AppShell
