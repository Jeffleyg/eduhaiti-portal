import { useEffect, useMemo, useState } from "react"
import { SurvivalModeContext } from "./SurvivalModeStore.js"

function readConnectionSnapshot() {
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection ||
    null

  if (!connection) {
    return {
      effectiveType: "unknown",
      saveData: false,
      downlink: 0,
    }
  }

  return {
    effectiveType: connection.effectiveType || "unknown",
    saveData: Boolean(connection.saveData),
    downlink: Number(connection.downlink || 0),
  }
}

export function SurvivalModeProvider({ children }) {
  const [batteryLevel, setBatteryLevel] = useState(1)
  const [isCharging, setIsCharging] = useState(false)
  const [connection, setConnection] = useState(() => readConnectionSnapshot())

  useEffect(() => {
    let mounted = true
    let batteryRef = null

    const syncBattery = (battery) => {
      if (!mounted) {
        return
      }

      setBatteryLevel(typeof battery.level === "number" ? battery.level : 1)
      setIsCharging(Boolean(battery.charging))
    }

    if (typeof navigator.getBattery === "function") {
      navigator
        .getBattery()
        .then((battery) => {
          if (!mounted) {
            return
          }

          batteryRef = battery
          syncBattery(battery)

          const handleBatteryChange = () => syncBattery(battery)
          battery.addEventListener("levelchange", handleBatteryChange)
          battery.addEventListener("chargingchange", handleBatteryChange)

          return () => {
            battery.removeEventListener("levelchange", handleBatteryChange)
            battery.removeEventListener("chargingchange", handleBatteryChange)
          }
        })
        .catch(() => {
          setBatteryLevel(1)
          setIsCharging(false)
        })
    }

    return () => {
      mounted = false
      if (batteryRef) {
        batteryRef.onlevelchange = null
        batteryRef.onchargingchange = null
      }
    }
  }, [])

  useEffect(() => {
    const connectionApi =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null

    const updateConnection = () => {
      setConnection(readConnectionSnapshot())
    }

    updateConnection()

    if (connectionApi && typeof connectionApi.addEventListener === "function") {
      connectionApi.addEventListener("change", updateConnection)
    }

    window.addEventListener("online", updateConnection)
    window.addEventListener("offline", updateConnection)

    return () => {
      if (connectionApi && typeof connectionApi.removeEventListener === "function") {
        connectionApi.removeEventListener("change", updateConnection)
      }
      window.removeEventListener("online", updateConnection)
      window.removeEventListener("offline", updateConnection)
    }
  }, [])

  const value = useMemo(() => {
    const isLowBattery = batteryLevel <= 0.2
    const is2G = connection.effectiveType === "2g" || connection.effectiveType === "slow-2g"
    const isSurvivalMode = isLowBattery || is2G

    return {
      batteryLevel,
      isCharging,
      effectiveType: connection.effectiveType,
      is2G,
      isLowBattery,
      isSurvivalMode,
      disableImages: isSurvivalMode,
      disableAnimations: isSurvivalMode,
      disableBackgroundSync: isSurvivalMode,
    }
  }, [batteryLevel, isCharging, connection.effectiveType])

  return <SurvivalModeContext.Provider value={value}>{children}</SurvivalModeContext.Provider>
}
