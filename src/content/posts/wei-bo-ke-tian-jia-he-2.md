---
title: 为博客添加SSL和HTTP/2
pubDate: 2016-10-17
author: Jin
draft: false
---

服务器环境为阿里云ECS Ubuntu14.04+LNMP1.3-full，SSL采用阿里云提供的免费Symantec Basic DV SSL CA.

阿里云ECS Ubuntu 14.04自带的OpenSSL是2014年的版本，不支持HTTP/2，多次升级都不能成功，于是采用简单粗暴的方法，直接在14.04基础上升级系统内核为Ubuntu 16.04.

升级之后，打开网站显示502错误，搜到[小岑博客](https://www.crazycen.com/linux/2335.html)的解决方案:

1、 启动 php-fpm，缺少 libicui18n.so.52:

安装 libicu52\_52.1-3ubuntu0.4\_amd64.deb 即可，deb下载地址：<http://packages.ubuntu.com/trusty/amd64/libicu52/download>

```
dpkg -i libicu52_52.1-3ubuntu0.4_amd64.deb
```

2、启动 php-fpm，缺少 librtmp.so.0：

```
locate librtmp.so
```

/usr/lib/x86\_64-linux-gnu/librtmp.so

/usr/lib/x86\_64-linux-gnu/librtmp.so.1

```
sudo ln -s /usr/lib/x86_64-linux-gnu/librtmp.so /usr/lib/librtmp.so.0
```

3、apt-get upgrade 出现 libicu52:i386 的依赖问题

```
apt-get -f upgrade
```

解决502问题之后查看openssl版本：

```
nginx -V
```

依然是build with旧版openssl（runing wiht新版openssl），HTTP/2还是没有生效，升级Nginx.

```
cd lnmp1.3-full
```

```
./upgrade.sh nginx
```

最后重启服务，ok！
