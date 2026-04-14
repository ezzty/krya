/**
 * Sintu Theme - Main JavaScript
 * Header auto-hide on scroll down, show on scroll up
 */

jQuery(document).ready(function($) {
  var mainHeader = $('.cd-auto-hide-header'),
      headerHeight = mainHeader.height();
  
  // 滚动变量
  var scrolling = false,
      previousTop = 0,
      currentTop = 0,
      scrollDelta = 10,
      scrollOffset = 150;
  
  // 滚动检测
  $(window).on('scroll', function() {
    if (!scrolling) {
      scrolling = true;
      (!window.requestAnimationFrame)
        ? setTimeout(autoHideHeader, 250)
        : requestAnimationFrame(autoHideHeader);
    }
  });
  
  // 窗口大小改变时重新计算 header 高度
  $(window).on('resize', function() {
    headerHeight = mainHeader.height();
  });
  
  function autoHideHeader() {
    var currentTop = $(window).scrollTop();
    
    // 向上滚动 - 显示 header
    if (previousTop - currentTop > scrollDelta) {
      mainHeader.removeClass('is-hidden');
    } 
    // 向下滚动且超过阈值 - 隐藏 header
    else if (currentTop - previousTop > scrollDelta && currentTop > scrollOffset) {
      mainHeader.addClass('is-hidden');
    }
    
    previousTop = currentTop;
    scrolling = false;
  }
});
