export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center">
      <div className="bg-background pointer-events-none fixed inset-0 opacity-50" />
      <div className="from-primary/5 absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  )
}
