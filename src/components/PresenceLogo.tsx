import logoPresence from "@/assets/presence-logo.png";

type PresenceLogoProps = {
  compact?: boolean;
  className?: string;
};

export function PresenceLogo({ compact = false, className = "" }: PresenceLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-lg shadow-crimson/10">
        <img
          src={logoPresence}
          alt=""
          width={1024}
          height={1024}
          className="size-full object-contain"
        />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-[0.35em] text-gold">
            Bootcamp 2026
          </span>
          <span className="block font-display text-2xl tracking-wide text-white">
            Registre des présences
          </span>
        </span>
      )}
    </div>
  );
}