"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SupplierPortalIndexPage() {
  const router = useRouter();
  const params = useParams<{ supplierId: string }>();
  // The portal home tab is Products — saves an extra click.
  useEffect(() => {
    router.replace(`/supplier/${params.supplierId}/products`);
  }, [params.supplierId, router]);
  return null;
}
