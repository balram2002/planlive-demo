import { SellerStudio } from "@/components/seller-studio";

// This path is intentionally not linked from anywhere in the UI. Access is
// gated by a password modal (see SellerStudio) on top of that obscurity, and
// every seller-only API route independently re-checks the session cookie —
// so even a leaked/guessed URL doesn't grant access without the password.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function SellerPage() {
  return (
    <main className="min-h-screen px-4 py-6 pb-16">
      <SellerStudio />
    </main>
  );
}
