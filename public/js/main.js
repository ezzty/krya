/**
 * Sintu Theme - Main JavaScript
 * Header auto-hide on scroll down, show on scroll up
 */

(function() {
  // 检测 CSS scroll-state 支持，如果支持则跳过 JS 绑定（避免重复监听）
  if (CSS.supports('container-type', 'scroll-state')) {
    console.log('✅ CSS scroll-state 支持，已由纯 CSS 处理导航栏隐藏');
    return;
  }
  
  console.log('ℹ️ CSS scroll-state 不支持，使用 JS fallback 方案');
  
  const mainHeader = document.querySelector('.cd-auto-hide-header');
  if (!mainHeader) return;
  
  let headerHeight = mainHeader.offsetHeight;
  
  // 滚动变量
  let previousTop = 0,
      currentTop = 0,
      scrollDelta = 10,
      scrollOffset = 150,
      scrolling = false;
  
  // 滚动检测
  function onScroll() {
    if (!scrolling) {
      scrolling = true;
      requestAnimationFrame(autoHideHeader);
    }
  }
  
  // 窗口大小改变时重新计算 header 高度
  function onResize() {
    headerHeight = mainHeader.offsetHeight;
  }
  
  function autoHideHeader() {
    currentTop = window.scrollY;
    
    // 向上滚动 - 显示 header
    if (previousTop - currentTop > scrollDelta) {
      mainHeader.classList.remove('is-hidden');
    } 
    // 向下滚动且超过阈值 - 隐藏 header
    else if (currentTop - previousTop > scrollDelta && currentTop > scrollOffset) {
      mainHeader.classList.add('is-hidden');
    }
    
    previousTop = currentTop;
    scrolling = false;
  }
  
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
})();
