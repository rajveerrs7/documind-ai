// Auth layout — minimal, no sidebar or navigation
// Just a centered content area for login/register pages

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen">{children}</main>;
}
