"use client";

import type { User } from "@/lib/auth";

interface DashboardHeaderProps {
  user: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Bienvenido, {user.name}</h1>
      </div>
    </header>
  );
}
