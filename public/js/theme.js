/**
 * Theme Manager - 暗黑模式主题管理
 * 提供主题初始化、切换、持久化功能
 */

(function() {
  const html = document.documentElement;
  
  /**
   * 设置主题
   * @param {string} theme - 'dark' 或 'light'
   */
  function setTheme(theme) {
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
      html.style.colorScheme = 'dark';
    } else {
      html.removeAttribute('data-theme');
      html.style.colorScheme = 'light';
    }
    localStorage.setItem('theme', theme);
  }
  
  /**
   * 获取当前主题
   * @returns {string} 'dark' 或 'light'
   */
  function getTheme() {
    return localStorage.getItem('theme') || 
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  
  /**
   * 切换主题
   */
  function toggleTheme() {
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    return newTheme;
  }
  
  /**
   * 初始化主题（页面加载时调用）
   */
  function initTheme() {
    const theme = getTheme();
    setTheme(theme);
  }
  
  // 暴露到全局
  window.ThemeManager = { setTheme, getTheme, toggleTheme, initTheme };
  
  // 自动初始化
  initTheme();
})();
