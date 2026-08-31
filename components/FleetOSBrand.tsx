import Image from "next/image";

type FleetOSBrandProps = {
  variant?: "sidebar" | "header" | "login" | "footer";
  showPoweredBy?: boolean;
};

export default function FleetOSBrand({
  variant = "header",
  showPoweredBy = true,
}: FleetOSBrandProps) {
  if (variant === "login") {
    return (
      <div className="flex flex-col items-center text-center">
        <Image
          src="/branding/platinum-logo.png"
          alt="Platinum Digital Services LLC"
          width={190}
          height={110}
          priority
          className="h-auto w-[170px] object-contain"
        />

        <div className="mt-4 text-3xl font-bold tracking-[0.18em] text-slate-950">
          FLEETOS
        </div>

        {showPoweredBy && (
          <div className="mt-1 text-sm font-medium text-blue-600">
            by Platinum Digital Services LLC
          </div>
        )}

        <div className="mt-4 text-sm text-slate-500">
          Fleet Operations &amp; Financial Management Platform
        </div>
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1">
          <Image
            src="/branding/platinum-logo.png"
            alt="Platinum Digital Services LLC"
            width={80}
            height={50}
            priority
            className="h-auto w-full object-contain"
          />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-bold tracking-[0.18em] text-white">
            FLEETOS
          </div>

          {showPoweredBy && (
            <div className="mt-0.5 text-[9px] font-medium text-sky-400">
              by Platinum Digital Services LLC
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <Image
          src="/branding/platinum-logo.png"
          alt="Platinum Digital Services LLC"
          width={32}
          height={20}
          className="h-auto w-7 object-contain"
        />

        <span>
          Powered by Platinum Digital Services LLC
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Image
        src="/branding/platinum-logo.png"
        alt="Platinum Digital Services LLC"
        width={70}
        height={42}
        priority
        className="h-auto w-14 object-contain"
      />

      <div>
        <div className="text-sm font-bold tracking-[0.18em] text-slate-950">
          FLEETOS
        </div>

        {showPoweredBy && (
          <div className="text-[10px] font-medium text-blue-600">
            by Platinum Digital Services LLC
          </div>
        )}
      </div>
    </div>
  );
}