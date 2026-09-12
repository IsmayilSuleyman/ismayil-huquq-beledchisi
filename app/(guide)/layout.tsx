import { PageBackground } from "@/components/PageBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileTabBar } from "@/components/MobileTabBar";

// The guide's chrome: drifting orbs behind the page, the phone tab bar and
// the theme switch. The gazette section under /gazette has its own layout.
export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageBackground />
      <div className="relative z-10 min-h-screen">{children}</div>
      <MobileTabBar />
      <ThemeToggle />
    </>
  );
}
