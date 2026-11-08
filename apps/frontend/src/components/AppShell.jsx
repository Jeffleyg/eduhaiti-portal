import React, { useState, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar.jsx"
import CorporateHeader from "./CorporateHeader.jsx"
import TopBar from "./TopBar.jsx"
import { useSurvivalMode } from "../context/useSurvivalMode.js"

function AppShell({ role }) {
  const { disableImages, disableAnimations } = useSurvivalMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Fecha o menu lateral automaticamente sempre que a rota mudar
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Acessibilidade: trava a rolagem de fundo e fecha a gaveta ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }

    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <div
      className={`min-h-screen bg-sand text-brand-navy flex flex-col ${
        disableAnimations ? "survival-no-animations" : ""
      }`}
    >
      {/* Background sutil do tema (desativado em modo de economia extrema) */}
      {!disableImages && (
        <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-50" />
      )}

      {/* Cabeçalho Institucional do Topo */}
      <CorporateHeader />

      {/* Container Principal */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:gap-6 lg:px-6 lg:py-8">
        
        {/* ================= NAVEGAÇÃO DESKTOP ================= */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6">
            <Sidebar role={role} />
          </div>
        </aside>

        {/* ================= NAVEGAÇÃO MOBILE (DRAWER OFF-CANVAS) ================= */}
        {/* Fundo escuro (Backdrop) com detecção de clique fora */}
        {mobileMenuOpen && (
          <div
            className={`fixed inset-0 z-40 bg-brand-navy/60 lg:hidden ${
              disableAnimations ? "" : "backdrop-blur-xs transition-opacity duration-200"
            }`}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Gaveta deslizante */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navegação Principal"
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sand shadow-2xl lg:hidden ${
            disableAnimations
              ? ""
              : "transition-transform duration-200 ease-out"
          } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {/* Cabeçalho do Drawer com botão fechar */}
          <div className="flex items-center justify-between border-b border-brand-navy/10 px-5 py-4">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-navy/70">
              Navegação
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-navy/70 hover:bg-brand-navy/10 hover:text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy"
              aria-label="Fechar navegação"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Conteúdo da Sidebar no mobile */}
          <div className="flex-1 overflow-y-auto p-4">
            <Sidebar role={role} />
          </div>
        </div>

        {/* ================= ÁREA DE CONTEÚDO E TOPBAR ================= */}
        <div className="flex flex-1 flex-col gap-4 sm:gap-6 min-w-0">
          {/* Barra de Acesso Rápido / Menu em Telas Menores */}
          <div className="lg:hidden flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-navy/15 bg-white/90 px-3.5 py-2.5 text-sm font-semibold text-brand-navy shadow-xs hover:bg-white active:bg-sand focus:outline-none focus:ring-2 focus:ring-brand-navy min-h-[44px]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Menu</span>
            </button>

            <span className="text-xs font-semibold uppercase tracking-wider text-brand-navy/60">
              {role}
            </span>
          </div>

          {/* TopBar corporativa original */}
          <TopBar role={role} onMenuToggle={() => setMobileMenuOpen(true)} />

          {/* Painel de Conteúdo das Páginas (Outlet) */}
          <main className="surface-panel flex-1 p-4 sm:p-5 lg:p-6 min-w-0 overflow-x-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default AppShell