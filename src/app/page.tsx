import { Suspense } from "react";
import { DiscoverExperience } from "@/components/discover-experience";
import { BrandFooter } from "@/components/brand-footer";

export default function DiscoverPage() {
  return (
    <div className="animate-page-in mx-auto max-w-lg px-4 py-4">
      <Suspense fallback={<div className="skeleton h-64" />}>
        <DiscoverExperience basePath="/" />
      </Suspense>
      <BrandFooter links={[{ href: "/backstage-92k4x7", label: "Seller? Go live" }]} />
    </div>
  );
}
