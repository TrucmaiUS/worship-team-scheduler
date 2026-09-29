import Image from "next/image";

export function Avatar({ name, imgUrl, className = "" }: { name?: string, imgUrl?: string | null, className?: string }) {
  if (imgUrl) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-center rounded-full border-2 border-brand-black bg-brand-black ${className}`}>
        <Image src={imgUrl} alt={name || "Avatar"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
      </div>
    );
  }
  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getBgColor = (name: string) => {
    if (!name) return "bg-brand-black";
    const colors = ["bg-brand-pink", "bg-brand-blue", "bg-brand-red", "bg-brand-yellow"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const bgColor = getBgColor(name || "");
  const initials = getInitials(name || "");

  return (
    <div className={`flex items-center justify-center rounded-full border-2 border-brand-black text-brand-white font-bold ${bgColor} ${className}`}>
      {initials}
    </div>
  );
}
