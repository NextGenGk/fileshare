type Props = {
  value: string;
  size?: number;
  label?: string;
};

export function QrCode({ value, size = 160, label }: Props) {
  const src = `/api/public/v1/qr?url=${encodeURIComponent(value)}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={src} alt="QR code" width={size} height={size} className="rounded-md" />
      {label && (
        <p className="mono text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      )}
    </div>
  );
}
