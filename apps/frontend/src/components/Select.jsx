import React from "react"
import * as Select from "@radix-ui/react-select"
import { ChevronDown, Check } from "lucide-react"

function SelectComponent({
  value,
  onValueChange,
  options = [],
  placeholder = "Selecione...",
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}) {
  const NULL_SENTINEL = "__NULL__"

  const handleValueChange = (v) => {
    if (!onValueChange) return
    onValueChange(v === NULL_SENTINEL ? "" : v)
  }

  return (
    <Select.Root value={value ?? ""} onValueChange={handleValueChange} disabled={disabled}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={`inline-flex h-11 w-full items-center justify-between rounded-2xl border border-brand-navy/10 bg-white px-3 text-sm text-brand-navy shadow-sm transition-colors hover:border-brand-navy/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="ml-2 text-brand-navy/50">
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-50 overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-xl shadow-brand-navy/10"
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <SelectItem key={String(option.value)} value={option.value === "" ? NULL_SENTINEL : option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

const SelectItem = React.forwardRef(function SelectItem({ children, ...props }, ref) {
  return (
    <Select.Item
      ref={ref}
      {...props}
      className="relative flex cursor-pointer select-none items-center rounded-xl px-3 py-2 text-sm text-brand-navy outline-none data-[highlighted]:bg-brand-navy/5 data-[state=checked]:bg-brand-sky/20"
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="ml-auto text-brand-blue">
        <Check size={16} />
      </Select.ItemIndicator>
    </Select.Item>
  )
})

export default SelectComponent