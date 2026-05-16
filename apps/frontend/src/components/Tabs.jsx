import React, { useState } from "react"
import { ChevronDown } from "lucide-react"

/**
 * Tabs component for switching between content sections
 */
export function Tabs({ tabs, defaultTab = 0, onTabChange, className = "" }) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const handleTabChange = (index) => {
    setActiveTab(index)
    onTabChange?.(index)
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        className="flex border-b border-gray-200 gap-md overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`tabpanel-${index}`}
            onClick={() => handleTabChange(index)}
            className={`px-lg py-md text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === index
                ? "border-brand-red text-brand-red"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.icon && <span className="inline-block mr-md">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-lg">
        {tabs.map((tab, index) => (
          <div
            key={index}
            id={`tabpanel-${index}`}
            role="tabpanel"
            aria-labelledby={`tab-${index}`}
            hidden={activeTab !== index}
            className="animate-fade-in"
          >
            {activeTab === index && tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Accordion component for collapsible content sections
 */
export function Accordion({ items, defaultOpen = [], className = "" }) {
  const [openItems, setOpenItems] = useState(defaultOpen)

  const toggleItem = (id) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className={`space-y-md ${className}`}>
      {items.map((item, index) => (
        <div key={item.id || index} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleItem(item.id || index)}
            className="w-full px-lg py-md flex items-center justify-between hover:bg-gray-50 transition-colors"
            aria-expanded={openItems.includes(item.id || index)}
            aria-controls={`accordion-${item.id || index}`}
          >
            <span className="text-left font-semibold text-ink">{item.title}</span>
            <ChevronDown
              size={20}
              className={`transition-transform ${
                openItems.includes(item.id || index) ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
          {openItems.includes(item.id || index) && (
            <div
              id={`accordion-${item.id || index}`}
              className="px-lg py-md border-t border-gray-200 bg-gray-50 animate-slide-down"
            >
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
