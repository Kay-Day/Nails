// 定义视频状态常量
const VIDEO_STATES = {
  PLAYING: 'is-playing',
  PAUSED: 'is-paused',
  LOADING: 'is-loading'
};

// 当前正在播放的视频引用
let currentPlayingVideo = null;

// 播放视频的函数
const playVideo = (videoElement, playButton) => {
  if (!videoElement || !playButton) {
    console.warn('Invalid video element or play button');
    return;
  }

  // iOS 兼容：点击播放前强制静音
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    videoElement.muted = true;
  }
  // 移动端兼容：如需自动播放可强制静音（如不需要可注释掉）
  // videoElement.muted = true;

  if (videoElement.readyState >= 2) {
    if (currentPlayingVideo && currentPlayingVideo !== videoElement) {
      const oldPlayButton = currentPlayingVideo.parentElement.querySelector('[data-video-play]');
      pauseVideo(currentPlayingVideo, oldPlayButton);
    }

    // 直接同步调用 play()
    videoElement.play().then(() => {
      currentPlayingVideo = videoElement;
      Object.assign(videoElement.style, { opacity: 1 });
      Object.assign(playButton.style, { display: 'none' });
      videoElement.removeAttribute('controls');
      videoElement.classList.remove(VIDEO_STATES.PAUSED, VIDEO_STATES.LOADING);
      videoElement.classList.add(VIDEO_STATES.PLAYING);
      console.log('playVideo: 播放成功', videoElement);
    }).catch(error => {
      console.warn('Video playback failed:', error);
      handlePlaybackError(videoElement, playButton);
    });
  } else {
    console.warn('Video is not ready to play');
    videoElement.classList.add(VIDEO_STATES.LOADING);
  }
};

// 暂停视频的函数
const pauseVideo = (videoElement, playButton) => {
  if (!videoElement || !playButton) {
    console.warn('Invalid video element or play button');
    return;
  }

  try {
    videoElement.pause();
    
    if (currentPlayingVideo === videoElement) {
      currentPlayingVideo = null;
    }
    
    // 批量更新样式
    Object.assign(playButton.style, {
      display: 'flex'
    });
    
    videoElement.removeAttribute('controls');
    
    // 更新视频状态类
    videoElement.classList.remove(VIDEO_STATES.PLAYING, VIDEO_STATES.LOADING);
    videoElement.classList.add(VIDEO_STATES.PAUSED);

    console.log('pauseVideo: 暂停成功', videoElement);
    
  } catch (error) {
    console.warn('Video pause failed:', error);
  }
};

// 处理播放错误的函数
const handlePlaybackError = (videoElement, playButton) => {
  playButton.style.display = 'flex';
  videoElement.classList.remove(VIDEO_STATES.PLAYING, VIDEO_STATES.LOADING);
  videoElement.classList.add(VIDEO_STATES.PAUSED);
  currentPlayingVideo = null;
};

// 处理视频播放和暂停的函数
const handleVideoPlayPause = (containerSelector, videoSelector, playButtonSelector) => {
  // 使用缓存的选择器结果
  const containers = document.querySelectorAll(containerSelector);
  if (!containers.length) return;

  // 事件处理函数复用
  const createPlayPauseHandler = (video, playButton) => (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (video.paused) {
      playVideo(video, playButton);
    } else {
      pauseVideo(video, playButton);
    }
  };

  // 事件绑定函数复用  
  const bindVideoEvents = (video, playButton) => {
    const handler = createPlayPauseHandler(video, playButton);
    const pauseHandler = () => pauseVideo(video, playButton);
    const playingHandler = () => playVideo(video, playButton);

    // 同时监听 click 和 touchend，passive: false
    ['click', 'touchend'].forEach(eventType => {
      playButton.addEventListener(eventType, handler, { passive: false });
      video.addEventListener(eventType, handler, { passive: false });
    });
    video.addEventListener('pause', pauseHandler);
    video.addEventListener('playing', playingHandler); 

    // 返回清理函数
    return () => {
      ['click', 'touchend'].forEach(eventType => {
        playButton.removeEventListener(eventType, handler);
        video.removeEventListener(eventType, handler);
      });
      video.removeEventListener('pause', pauseHandler);
      video.removeEventListener('playing', playingHandler);
    };
  };

  // 处理每个容器
  containers.forEach(container => {
    const video = container.querySelector(videoSelector);
    const playButton = container.querySelector(playButtonSelector);

    if (video && playButton) {
      bindVideoEvents(video, playButton);
    }
  });
};

// 点击声音图标>切换视频静音状态的函数
const toggleMuteVideo = (videoElement, muteButton) => {
  try {
    // 缓存 DOM 查询结果
    const icons = {
      volume: muteButton.querySelector('.supicon-volume'),
      mute: muteButton.querySelector('.supicon-mute')
    };

    // 检查必要元素是否存在
    if (!icons.volume || !icons.mute) {
      console.warn('Mute icons not found');
      return;
    }

    // 切换静音状态
    videoElement.muted = !videoElement.muted;

    // 使用对象映射简化显示逻辑
    const displayStates = videoElement.muted 
      ? { volume: 'none', mute: 'block' }
      : { volume: 'block', mute: 'none' };

    // 批量更新显示状态
    Object.entries(icons).forEach(([type, icon]) => {
      icon.style.display = displayStates[type];
    });

  } catch (error) {
    console.warn('Failed to toggle video mute state:', error);
  }
};

// 处理静音按钮的点击事件
const handleMuteButtonClick = (muteButtonSelector, videoContainer, videoSelector) => {
  const muteButtons = document.querySelectorAll(muteButtonSelector);
  muteButtons.forEach(muteButton => {
    // 同时监听 click 和 touchend 事件
    ['click', 'touchend'].forEach(eventType => {
      muteButton.addEventListener(eventType, (e) => {
        // 阻止事件冒泡和默认行为
        e.preventDefault();
        e.stopPropagation();
        
        const video = muteButton.closest(videoContainer)?.querySelector(videoSelector);
        if (!video) {
          console.warn('Video element not found for mute button');
          return;
        }

        try {
          toggleMuteVideo(video, muteButton);
        } catch (error) {
          console.warn('Failed to toggle video mute state:', error);
        }
      }, { passive: false }); // 设置 passive: false 以允许阻止默认行为
    });
  });
};

// 初始化 sticky video 功能的函数
// 初始化 sticky video 功能的函数
// 参数说明:
// iconSelector - 视频图标选择器
// iconShow - 显示图标的类名
// closeButtonSelector - 关闭按钮选择器 
// delayStorageKey - localStorage存储延迟时间的key
const initStickyVideo = (iconSelector, iconShow, closeButtonSelector, delayStorageKey) => {
  // 定义时间常量,用于计算延迟时间
  const MILLISECONDS_PER_SECOND = 1000;
  const MILLISECONDS_PER_HOUR = 3600000;

  // 获取视频图标元素
  const section = document.querySelector(iconSelector);
  if (!section) return;

  try {
    // 从localStorage获取延迟时间
    const delay = window.localStorage.getItem(delayStorageKey);
    // 判断是否应该显示视频:没有延迟时间或当前时间已超过延迟时间
    const shouldShow = !delay || Date.now() >= Number(delay);

    if (shouldShow) {
      // 获取延迟显示的秒数
      const showAfterSeconds = Number(section.dataset.showAfter) || 0;
      // 延迟指定时间后显示视频图标
      setTimeout(() => {
        section.classList.add(iconShow);
      }, showAfterSeconds * MILLISECONDS_PER_SECOND);
    }

    // 获取关闭按钮元素
    const closeBtn = section.querySelector(closeButtonSelector);
    if (!closeBtn) return;

    // 监听关闭按钮点击事件
    closeBtn.addEventListener('click', () => {
      // 隐藏视频图标
      section.classList.remove(iconShow);
      section.style.display = 'none';
      
      // 暂停视频并移除控件
      const video = section.querySelector('video');
      if (video) {
        video.pause();
        video.removeAttribute('controls');
      }

      // 计算下次显示时间并存储到localStorage
      const closingDelayInHours = Number(section.dataset.closingDelay) || 0;
      const nextShowTime = Date.now() + (closingDelayInHours * MILLISECONDS_PER_HOUR);
      window.localStorage.setItem(delayStorageKey, nextShowTime);

      // 添加调试信息,显示下次显示时间
      const nextShowDate = new Date(nextShowTime);
      console.log('Next show time:', nextShowDate.toLocaleString(), 
        `(${closingDelayInHours} hours from now)`);
    });

  } catch (error) {
    // localStorage操作失败时输出警告
    console.warn('LocalStorage operation failed:', error);
  }
};


// 添加处理点击空白区域的函数
const handleOutsideClick = (event, stickyVideoSelector, videoSelector, playButtonSelector, iconSelector) => {
  const stickyVideo = document.querySelector(stickyVideoSelector);
  const video = document.querySelector(videoSelector);
  const playButton = document.querySelector(playButtonSelector);
  const iconplay = document.querySelector(iconSelector);
  const videoWrapper = document.querySelector('.sticky-video_wrapper-play');
  const videoCard = document.querySelector('.sticky-video_wrapper-card');
  const productCard = document.querySelector('.video-wrapper-product');

  // 检查点击是否在视频区域、链接区域或产品区域之外
  if (stickyVideo.classList.contains('sticky-video_wrapper-show') && 
      !videoWrapper.contains(event.target) && 
      !videoCard?.contains(event.target) && 
      !productCard?.contains(event.target)) {
    
    playButton.style.display = 'block'; // 显示播放按钮
    video.pause(); // 暂停视频
    video.removeAttribute('controls'); // 移除控件
    stickyVideo.classList.remove('sticky-video_wrapper-show'); // 移除 show 类
    iconplay.style.display = 'block'; // 显示小图标
  }
};
// 处理小视频图标的点击事件的函数（放大视频）
const handlePlayButtonIconClick = (
  iconSelector,
  iconSelectorBtn,
  videoSelector,
  stickyVideoSelector,
  playButtonSelector,
  muteButtonSelector
) => {
  // 一次性获取所有需要的元素
  const elements = {
    iconplay: document.querySelector(iconSelector),
    iconplayBtn: document.querySelector(iconSelectorBtn), 
    video: document.querySelector(videoSelector),
    stickyvideo: document.querySelector(stickyVideoSelector)
  };

  // 检查所有必需元素是否存在
  if (!Object.values(elements).every(el => el)) return;

  const { iconplay, iconplayBtn, video, stickyvideo } = elements;

  // 使用事件委托处理点击事件
  const handleGlobalClick = (event) => {
    // 如果视频未显示,则不需要处理
    if (!stickyvideo.classList.contains('sticky-video_wrapper-show')) return;

    const clickedElement = event.target;
    const isOutsideClick = ![
      '.sticky-video_wrapper-play',
      '.sticky-video_wrapper-card',
      '.video-wrapper-product'
    ].some(selector => 
      stickyvideo.querySelector(selector)?.contains(clickedElement)
    ) && !iconplayBtn.contains(clickedElement);

    if (isOutsideClick) {
      const playButton = document.querySelector(playButtonSelector);
      // 批量更新状态
      Object.assign(playButton.style, { display: 'block' });
      Object.assign(iconplay.style, { display: 'block' });
      
      video.pause();
      video.removeAttribute('controls');
      stickyvideo.classList.remove('sticky-video_wrapper-show');
    }
  };

  // 只添加一次全局点击监听
  document.addEventListener('click', handleGlobalClick);

  // 小图标点击事件
  iconplayBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    stickyvideo.classList.add('sticky-video_wrapper-show');
    iconplay.style.display = 'none';
    playVideo(video, document.querySelector(playButtonSelector));
  });
};

// 添加 sup-icon-btn_zoom 按钮的点击事件处理程序(缩小视频)
const handleZoomButtonClick = (
  zoomButtonSelector,
  videoSelector,
  stickyVideoSelector,
  playButtonSelector,
  iconSelector
) => {
  const zoomButton = document.querySelector(zoomButtonSelector);
  if (!zoomButton) return;

  zoomButton.addEventListener('click', () => {
    // 一次性获取所有需要的元素
    const elements = {
      video: document.querySelector(videoSelector),
      stickyVideo: document.querySelector(stickyVideoSelector), 
      playButton: document.querySelector(playButtonSelector),
      iconplay: document.querySelector(iconSelector)
    };

    // 检查所有元素是否存在
    if (Object.values(elements).every(el => el)) {
      const { video, stickyVideo, playButton, iconplay } = elements;
      
      // 批量更新元素状态
      playButton.style.display = 'block';
      iconplay.style.display = 'block';
      
      // 处理视频
      video.pause();
      video.removeAttribute('controls');
      
      // 更新容器类
      stickyVideo.classList.remove('sticky-video_wrapper-show');
    }
  });
};

//悬停鼠标播放视频  
const hoverVideoPlay = (wrapperSelector, hoverPlay) => {
  if (!hoverPlay) return;

  const wrappers = document.querySelectorAll(wrapperSelector);
  wrappers.forEach(wrapper => {
    const video = wrapper.querySelector('video');
    if (!video) return;

    wrapper.addEventListener('mouseover', () => video.play());
    wrapper.addEventListener('mouseout', () => video.pause());
  });
};
//悬停鼠标播放视频结束

// 处理幻灯片内容的显示和隐藏
function handleSlideContent(content, isActive = false) {
  if (!content) return;
  
  if (isActive) {
    // 显示内容
    content.style.cssText = `
      opacity: 1;
      visibility: visible;
      animation: fadeInUp 1s forwards;
    `;
  } else {
    // 完全隐藏内容
    content.style.cssText = `
      opacity: 0;
      visibility: hidden;
      animation: none;
    `;
  }
}

// 处理幻灯片视频的播放和暂停
function handleSlideVideo(video, isActive = false) {
  if (!video) return;

  if (isActive) {
    video.play().catch(() => {});
  } else if (!video.paused) {
    video.pause();
  }
  // video.muted = true;
}

// 主函数 - 接收选择器作为参数
function handleSlideChange(swiperInstance, contentSelector = '.sup-videoslide-big-oneplay_slide_content--inner') {
  if (!swiperInstance?.slides) return;

  // 处理所有幻灯片
  swiperInstance.slides.forEach(slide => {
    const video = slide.querySelector('video');
    const content = slide.querySelector(contentSelector);
    
    handleSlideVideo(video, false);
    handleSlideContent(content, false);
  });

  // 处理当前幻灯片
  const currentSlide = swiperInstance.slides[swiperInstance.activeIndex];
  if (currentSlide) {
    const video = currentSlide.querySelector('video');
    const content = currentSlide.querySelector(contentSelector);
    
    handleSlideVideo(video, true);
    handleSlideContent(content, true);
  }
}

// 复制文字
function copyCode(e, textClass) {
  var $this = e.currentTarget; // 使用 e.currentTarget 以确保获取到正确的元素
  var textElement = $this.querySelector(textClass);
  var originalText = textElement.innerText;

  copyToClipboard($this.getAttribute('data-code'));
  textElement.innerText = 'Copied!';
  $this.classList.add('copied'); // 添加 copied 类

  setTimeout(function () {
    textElement.innerText = originalText;
    $this.classList.remove('copied'); // 移除 copied 类
  }, 2000);
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Text copied successfully');
    }).catch(err => {
      // Fallback handling
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  } catch (error) {
    console.warn('Copy operation failed:', error);
  }
}

// 更新视频进度条的函数
const updateProgressBar = (videoElement, progressBar) => {
  if (!videoElement || !progressBar) return;
  if (isNaN(videoElement.duration)) return;
  
  // 使用requestAnimationFrame来优化动画性能
  requestAnimationFrame(() => {
    const progress = (videoElement.currentTime / videoElement.duration) * 100;
    // 修改为直接设置宽度
    progressBar.style.width = `${progress}%`;
  });
};

// 初始化所有视频的进度条
const initializeVideoProgress = () => {
  const videoContainers = document.querySelectorAll('.video-container');
  
  videoContainers.forEach(container => {
    const video = container.querySelector('video');
    const progressContainer = container.querySelector('.video-progress-container');
    const progressBar = progressContainer?.querySelector('.video-progress-bar');
    
    if (video && progressContainer && progressBar) {
      // 设置初始样式
      progressBar.style.width = '0%';
      
      // 添加新的事件监听器，使用防抖来减少更新频率
      let frameId;
      video.addEventListener('timeupdate', () => {
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          updateProgressBar(video, progressBar);
        });
      });
      
      // 监听进度条点击事件
      progressContainer.addEventListener('click', (event) => {
        event.stopPropagation();
        const rect = progressContainer.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const progress = (clickX / rect.width) * 100;
        
        // 使用宽度计算来设置进度
        progressBar.style.width = `${progress}%`;
        video.currentTime = (progress / 100) * video.duration;
      });

      // 监听视频加载完成事件
      video.addEventListener('loadedmetadata', () => {
        progressBar.style.width = '0%';
      });
    }
  });
};

document.addEventListener('DOMContentLoaded', initializeVideoProgress);