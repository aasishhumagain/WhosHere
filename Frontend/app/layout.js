import "./globals.css";

export const metadata = {
  title: "WhosHere",
  description: "Face-recognition attendance management for students and administrators.",
};

const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  const storageKey = "whoshere-theme";
  const root = document.documentElement;
  const savedTheme = window.localStorage.getItem(storageKey);
  const resolvedTheme =
    savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[--background] text-[--foreground]">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
