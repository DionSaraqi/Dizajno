"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminIndexPage() {
  const router = useRouter();
  // /admin lands on the suppliers list by default — the moderation queues and
  // audit log are reached via the tab strip.
  useEffect(() => {
    router.replace("/admin/suppliers");
  }, [router]);
  return null;
}
