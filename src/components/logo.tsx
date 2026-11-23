export function LogoMark({ size = 28 }: { size?: number }) {
  return <img src="/finmei-logo.png" alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
}
export function Logo() {
  return (
    <img src="/finmei-logo.png" alt="FINMEI Financial" className="h-12 w-auto max-w-[190px] object-contain" />
  );
}
