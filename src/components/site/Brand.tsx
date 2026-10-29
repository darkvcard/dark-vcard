import { Link } from "@tanstack/react-router";

export function Brand({ src = "/logo.png" }: { src?: string }) {
  return (
    <Link to="/" className="flex items-center">
      <img
        src={src}
        alt="vCard"
        className="h-10 w-auto object-contain"
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.src.endsWith("/logo-trans.png")) img.src = "/logo-trans.png";
        }}
      />
    </Link>
  );
}
