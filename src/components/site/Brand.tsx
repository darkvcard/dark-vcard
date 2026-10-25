import { Link } from "@tanstack/react-router";
import icon from "@/assets/vcard-icon.png.asset.json";

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-foreground">
        <img src={icon.url} alt="vCard logo" className="h-8 w-8 object-contain" />
      </span>
      <span className="font-mono text-lg font-bold tracking-wider">
        <span className="text-neon">{"{"}</span>
        <span>vCARD</span>
        <span className="text-neon">{"}"}</span>
      </span>
    </Link>
  );
}
