export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ width: size, height: size }}>
      <img src="/finmei-logo.png" alt="" className="h-full w-full object-contain dark:hidden" />
      <img src="/finmei-logo-dark.png" alt="" className="hidden h-full w-full object-contain dark:block" />
    </span>
  );
}
export function Logo() {
  return (
    <span className="inline-flex">
      <img src="/finmei-logo.png" alt="FINMEI Financial" className="h-12 w-auto max-w-[190px] object-contain dark:hidden" />
      <img src="/finmei-logo-dark.png" alt="FINMEI Financial" className="hidden h-12 w-auto max-w-[190px] object-contain dark:block" />
    </span>
  );
}
