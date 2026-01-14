"use client"
import { useEffect, useMemo, useState } from "react"
import type { User } from "@/lib/auth"
import { User as UserIcon } from "lucide-react"
import { apiFetch } from "@/utils/api"
import { resolveMediaUrl } from "@/utils/media"
import { ModeToggle } from "@/components/mode-toggle"

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const [companyName, setCompanyName] = useState("")
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await apiFetch("/settings/public", { authRedirect: true })
        if (!active) return
        const name = (data?.companyName || "").toString().trim()
        setCompanyName(name)
      } catch {
        if (active) setCompanyName("")
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const hasCompanyName = companyName.length > 0

  const profilePhoto = useMemo(() => resolveMediaUrl(user.photoUrl), [user.photoUrl])

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex flex-col">
          {hasCompanyName && (
            <>
              <h1 className="text-xl font-semibold text-foreground">{companyName}</h1>
              <span className="text-xs text-muted-foreground sm:hidden">{companyName}</span>
            </>
          )}
        </div>
      </div>
      {hasCompanyName && (
        <div className="hidden flex-1 items-center justify-center text-center text-sm font-medium text-muted-foreground sm:flex">
          <span className="truncate">{companyName}</span>
        </div>
      )}
      <div className="flex items-center space-x-4">
        <ModeToggle />
        {profilePhoto ? (
          <img
            src={profilePhoto}
            alt={`${user.name} avatar`}
            className="h-10 w-10 rounded-full border border-border object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground shadow-sm">
            <UserIcon className="h-6 w-6" />
          </div>
        )}
        <div className="text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground capitalize">{user.role}</p>
        </div>
      </div>
    </header>
  )
}
