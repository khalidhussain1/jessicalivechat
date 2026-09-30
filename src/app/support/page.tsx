import { SupportChat } from "@/components/SupportChat";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function SupportPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col md:mx-auto md:max-w-2xl md:px-6 md:py-16">
      <div className="hidden md:block">
        <h1 className="text-3xl font-medium text-foreground">🎮 Game Support</h1>
        <p className="mt-2 text-sm text-text-dim">
          Chat with Jessica for account help, bug reports, or general questions.
        </p>
      </div>

      <div className="flex flex-1 flex-col md:mt-8">
        <InstallPrompt />
        <SupportChat />
      </div>
    </div>
  );
}
