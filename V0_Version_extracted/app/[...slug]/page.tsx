"use client"

import { useEffect, useState } from "react"
import App from "@/src/App"

export default function CatchAllPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p>Loading PlatoVue...</p>
        </div>
      </div>
    )
  }

  return <App />
}
