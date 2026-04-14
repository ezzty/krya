---
title: Linux 维护常用命令
pubDate: 2016-06-07
author: Jin
draft: false
---

Linux命令太多，用的较少，容易忘记，且记于此，以供不时之需。

1、独立运行一个Python环境，用virtualenv，pip安装后cd到项目目录，激活命令：

`. venv/bin/activate`

2、服务器打包document文件夹到服务器default目录，然后http下载：

`tar -czvf default/document.tar.gz document解压：tar -zxvf document.tar.gz`

3、SSH可以通过scp传输文件，从桌面传输文件至ubuntu命令：

`scp -r localfile.txt username@192.168.0.1:/home/username`

4、Typecho1.0 迁移服务器出现404问题，找到domain.com.conf文件：

`include enable-php.conf修改为include enable-php-pathinfo.conf`

5、Nginx重启命令：

`sudo systemctl restart nginx`

6、清除Windows DNS cache：

`ipconfig/flushdns`

7、Windows 10快速启动：

`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp`

8、ZModem安装：

`yum install lrzsz`

# fedora或centos（来自epel）

sudo yum install nethogs -y  
18、Linux常用权限

-rw------- (600) 只有拥有者有读写权限。  
-rw-r--r-- (644) 只有拥有者有读写权限；而属组用户和其他用户只有读权限。  
-rwx------ (700) 只有拥有者有读、写、执行权限。  
-rwxr-xr-x (755) 拥有者有读、写、执行权限；而属组用户和其他用户只有读、执行权限。  
-rwx--x--x (711) 拥有者有读、写、执行权限；而属组用户和其他用户只有执行权限。  
-rw-rw-rw- (666) 所有用户都有文件读、写权限。  
-rwxrwxrwx (777) 所有用户都有读、写、执行权限  
19、删除LNMP .usr.ini文件 ：

chattr -i .user.ini
