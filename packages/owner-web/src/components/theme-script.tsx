export function ThemeScript() {
  const script = `
    (function(){
      try {
        var saved = localStorage.getItem('owner-theme');
        var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var dark = saved ? saved === 'dark' : systemDark;
        document.documentElement.classList.toggle('dark', dark);
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}


