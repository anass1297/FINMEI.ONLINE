export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ width: size, height: size }}>
      <img src="/finmei-logo-light.png" alt="" className="h-full w-full object-contain" />
    </span>
  );
}
export function Logo() {
  return (
    <span className="inline-flex items-center justify-center">
      <img src="/finmei-logo-light.png" alt="FINMEI Financial" className="h-20 w-auto max-w-[210px] object-contain" />
    </span>
  );
}
