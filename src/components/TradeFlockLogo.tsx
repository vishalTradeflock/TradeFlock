import { cn } from "@/lib/utils";

type TradeFlockLogoProps = {
  className?: string;
};

export default function TradeFlockLogo({ className }: TradeFlockLogoProps) {
  return (
    <span
      className={cn(
        "font-serif font-semibold tracking-tight text-neutral-950",
        className,
      )}
    >
      TradeFlock
      <span className="ml-1 align-top font-sans text-[10px] font-bold tracking-[0.2em] text-[#c41e3a] sm:text-[11px]">
        USA
      </span>
    </span>
  );
}
