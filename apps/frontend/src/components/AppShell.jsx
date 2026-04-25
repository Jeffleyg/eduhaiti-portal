import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar.jsx"
import TopBar from "./TopBar.jsx"
import { useSurvivalMode } from "../context/useSurvivalMode.js"

function AppShell({ role }) {
  const { disableImages, disableAnimations } = useSurvivalMode()

  return (
    <div className={`min-h-screen bg-sand text-brand-navy ${disableAnimations ? "survival-no-animations" : ""}`}>
      {disableImages ? null : <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-50" />}
      <div className="relative mx-auto flex min-h-screen max-w-7xl gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:gap-6 lg:px-6 lg:py-8">
        <Sidebar role={role} />
        <div className="flex flex-1 flex-col gap-6">
          <TopBar role={role} />
          <main className="surface-panel flex-1 p-4 sm:p-5 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default AppShell
