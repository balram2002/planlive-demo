import Link from "next/link";
import { SellerStudio } from "@/components/seller-studio";

export default function SellerPage() {
  return (
    <main className="min-h-screen px-4 py-6 pb-16">
      <div className="mx-auto mb-6 flex max-w-lg items-center justify-between">
        <span className="text-sm font-bold tracking-tight">liveWAB demo</span>
        <Link
          href="/discover"
          className="text-xs font-medium text-primary"
        >
          Buyer view →
        </Link>
      </div>
      <SellerStudio />
    </main>
  );
}
