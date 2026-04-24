import "./globals.css";

export const metadata = {
  title: "WhosHere",
  description: "Face-recognition attendance management for students and administrators.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[--background] text-[--foreground]">{children}</body>
    </html>
  );
}
