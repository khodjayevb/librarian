import { useState, useEffect } from 'react';

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    console.log('Dark mode changing to:', isDark);
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    console.log('Document classes:', root.classList.toString());
  }, [isDark]);

  const toggleDarkMode = () => {
    console.log('Toggle dark mode clicked, current state:', isDark);
    setIsDark(!isDark);
  };

  return { isDark, toggleDarkMode };
};

export default useDarkMode;